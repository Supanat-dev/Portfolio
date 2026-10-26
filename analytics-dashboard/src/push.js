import { buildPushPayload } from '@block65/webcrypto-web-push';

const encode = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = (value) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function wrappingKey(env) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`portfolio-push-v1:${env.ADMIN_TOKEN}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function readKeys(env) {
  const result = await env.DB.prepare('SELECT * FROM analytics_push_config WHERE id = 1').all();
  const row = result.results?.[0];
  if (!row) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(row.iv) }, await wrappingKey(env), decode(row.encrypted_private_key));
    return { publicKey: row.public_key, privateKey: new TextDecoder().decode(plain) };
  } catch { return null; } // After ADMIN_TOKEN rotation the owner can re-enable push.
}
async function setup(env) {
  const existing = await readKeys(env);
  if (existing) return existing;
  const previous = (await env.DB.prepare('SELECT public_key FROM analytics_push_config WHERE id = 1').all()).results?.[0];
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = encode(await crypto.subtle.exportKey('raw', pair.publicKey));
  const { d: privateKey } = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await wrappingKey(env), new TextEncoder().encode(privateKey));
  // Compare-and-swap prevents simultaneous devices from replacing each other's keys.
  if (previous) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM analytics_push_subscriptions WHERE EXISTS (SELECT 1 FROM analytics_push_config WHERE public_key = ?)').bind(previous.public_key),
      env.DB.prepare('UPDATE analytics_push_config SET public_key = ?, encrypted_private_key = ?, iv = ? WHERE public_key = ?')
        .bind(publicKey, encode(encrypted), encode(iv), previous.public_key),
    ]);
  } else {
    await env.DB.prepare('INSERT OR IGNORE INTO analytics_push_config VALUES (1, ?, ?, ?)').bind(publicKey, encode(encrypted), encode(iv)).run();
  }
  return readKeys(env);
}
export function validSubscription(subscription) {
  try {
    const url = new URL(subscription.endpoint);
    const host = url.hostname;
    const approved = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
      || host.endsWith('.push.apple.com') || host.endsWith('.notify.windows.com');
    return approved && url.protocol === 'https:' && !url.username && !url.password && !url.port
      && subscription.endpoint.length < 2000 && /^[\w-]{87}$/.test(subscription.keys?.p256dh || '')
      && /^[\w-]{22}$/.test(subscription.keys?.auth || '');
  } catch { return false; }
}
class PushDeliveryError extends Error {
  constructor(code, providerStatus = null) { super(code); this.code = code; this.providerStatus = providerStatus; }
}
const pushErrorMessages = {
  PUSH_ENCRYPTION_FAILED: 'เตรียมข้อความแจ้งเตือนไม่สำเร็จ กรุณาปิดแล้วเปิดรับแจ้งเตือนอีกครั้ง',
  PUSH_TIMEOUT: 'บริการแจ้งเตือนตอบกลับช้า กรุณากดส่งทดสอบอีกครั้ง',
  PUSH_NETWORK_FAILED: 'เชื่อมต่อบริการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  PUSH_SUBSCRIPTION_EXPIRED: 'การรับแจ้งเตือนเครื่องนี้หมดอายุ กรุณากดรับแจ้งเตือนใหม่',
  PUSH_AUTH_REJECTED: 'บริการแจ้งเตือนปฏิเสธกุญแจ กรุณาปิดแล้วเปิดรับแจ้งเตือนอีกครั้ง',
  PUSH_RATE_LIMITED: 'ส่งทดสอบถี่เกินไป รอสักครู่แล้วลองใหม่',
  PUSH_REDIRECT_REJECTED: 'บริการแจ้งเตือนเปลี่ยนที่อยู่ กรุณาปิดแล้วเปิดรับแจ้งเตือนใหม่',
  PUSH_PROVIDER_REJECTED: 'บริการแจ้งเตือนไม่รับข้อความ กรุณาลองใหม่อีกครั้ง',
};
async function deliver(env, subscription, keys, origin, data, transport = fetch) {
  let payload;
  try {
    payload = await buildPushPayload({ data: JSON.stringify(data), options: { ttl: 300, urgency: 'high' } }, subscription,
      { ...keys, subject: origin });
  } catch { throw new PushDeliveryError('PUSH_ENCRYPTION_FAILED'); }
  let response;
  try {
    // Workers supports follow/manual, not redirect:error. Never forward a signed
    // push request to a redirect target: inspect the original response instead.
    response = await transport(subscription.endpoint, { ...payload, redirect: 'manual', signal: AbortSignal.timeout(8000) });
  } catch (error) {
    throw new PushDeliveryError(['TimeoutError', 'AbortError'].includes(error.name) ? 'PUSH_TIMEOUT' : 'PUSH_NETWORK_FAILED');
  }
  if ([404, 410].includes(response.status)) {
    await env.DB.prepare('DELETE FROM analytics_push_subscriptions WHERE endpoint = ?').bind(subscription.endpoint).run();
  }
  if (!response.ok) {
    const code = [404, 410].includes(response.status) ? 'PUSH_SUBSCRIPTION_EXPIRED'
      : [401, 403].includes(response.status) ? 'PUSH_AUTH_REJECTED'
        : response.status === 429 ? 'PUSH_RATE_LIMITED'
          : response.status >= 300 && response.status < 400 ? 'PUSH_REDIRECT_REJECTED' : 'PUSH_PROVIDER_REJECTED';
    throw new PushDeliveryError(code, response.status);
  }
  return true;
}
export async function handlePush(request, env, { json, readBody }) {
  const path = new URL(request.url).pathname;
  const origin = new URL(request.url).origin;
  if (path === '/api/push/config' && request.method === 'GET') {
    const keys = await readKeys(env);
    return json({ publicKey: keys?.publicKey || null, configured: Boolean(keys) });
  }
  if (path === '/api/push/setup' && request.method === 'POST') {
    const keys = await setup(env);
    return json({ publicKey: keys.publicKey });
  }
  if (path === '/api/push/subscribe' && request.method === 'POST') {
    const body = await readBody(request);
    if (!validSubscription(body?.subscription)) return json({ error: 'Invalid push subscription' }, 400);
    const keys = await readKeys(env);
    if (!keys || body.publicKey !== keys.publicKey) return json({ error: 'Push key changed; subscribe again' }, 409);
    const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM analytics_push_subscriptions WHERE endpoint != ?').bind(body.subscription.endpoint).all();
    if (count.results[0].total >= 10) return json({ error: 'Maximum 10 devices' }, 409);
    await env.DB.prepare('INSERT OR REPLACE INTO analytics_push_subscriptions VALUES (?, ?, ?)')
      .bind(body.subscription.endpoint, JSON.stringify(body.subscription), new Date().toISOString()).run();
    return json({ ok: true });
  }
  if (path === '/api/push/unsubscribe' && request.method === 'POST') {
    const body = await readBody(request);
    await env.DB.prepare('DELETE FROM analytics_push_subscriptions WHERE endpoint = ?').bind(String(body?.endpoint || '')).run();
    return json({ ok: true });
  }
  if (path === '/api/push/status' && request.method === 'POST') {
    const body = await readBody(request);
    const result = await env.DB.prepare('SELECT 1 FROM analytics_push_subscriptions WHERE endpoint = ?').bind(String(body?.endpoint || '')).all();
    return json({ registered: Boolean(result.results?.length) });
  }
  if (path === '/api/push/test' && request.method === 'POST') {
    const body = await readBody(request);
    const result = await env.DB.prepare('SELECT subscription FROM analytics_push_subscriptions WHERE endpoint = ?').bind(String(body?.endpoint || '')).all();
    const keys = await readKeys(env);
    if (!keys || !result.results?.length) return json({ error: 'Subscribe first' }, 409);
    try {
      await deliver(env, JSON.parse(result.results[0].subscription), keys, origin,
        { title: 'Portfolio Pulse', body: 'รับแจ้งเตือนบนเครื่องนี้สำเร็จ', url: '/', tag: 'portfolio-push-test' });
      return json({ ok: true });
    } catch (error) {
      if (!(error instanceof PushDeliveryError)) throw error;
      return json({ ok: false, code: error.code, message: pushErrorMessages[error.code], providerStatus: error.providerStatus }, 502);
    }
  }
  return json({ error: 'Not found' }, 404);
}

export async function notifyVisit(env, { sessionId, now, dashboardOrigin }, transport = fetch) {
  const subscriptions = await env.DB.prepare('SELECT subscription FROM analytics_push_subscriptions LIMIT 10').all();
  if (!subscriptions.results?.length) return;
  const keys = await readKeys(env);
  if (!keys) return;
  // Claim once per session. A failed delivery can retry on a later heartbeat.
  const claim = await env.DB.prepare(`INSERT INTO analytics_notifications VALUES (?, 'sending', ?)
    ON CONFLICT(session_id) DO UPDATE SET state = 'sending', updated_at = excluded.updated_at
    WHERE analytics_notifications.state != 'sent' AND datetime(analytics_notifications.updated_at) < datetime('now', '-60 seconds')`)
    .bind(sessionId, now).run();
  if (!claim.meta?.changes) return;
  let delivered = false;
  const results = await Promise.allSettled(subscriptions.results.map(async (row) => {
    const subscription = JSON.parse(row.subscription);
    if (!validSubscription(subscription)) return false;
    return deliver(env, subscription, keys, dashboardOrigin, {
      title: 'มีผู้เข้าชมเว็บพอร์ต', body: 'เปิด Portfolio Pulse เพื่อดูรายละเอียดการเข้าชม',
      url: `/?session=${encodeURIComponent(sessionId)}`, tag: `portfolio-visit-${sessionId}`,
    }, transport);
  }));
  delivered = results.some((result) => result.status === 'fulfilled' && result.value);
  await env.DB.prepare('UPDATE analytics_notifications SET state = ?, updated_at = ? WHERE session_id = ?')
    .bind(delivered ? 'sent' : 'failed', new Date().toISOString(), sessionId).run();
}
