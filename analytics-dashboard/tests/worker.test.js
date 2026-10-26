import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';
import { classifyClient, sourceInfo, safePath } from '../src/analytics.js';
import { ensureExtendedSchema } from '../src/schema.js';
import { notifyVisit, validSubscription } from '../src/push.js';

class D1 {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.sqlite.exec(readFileSync(new URL('../migrations/0001_create_sessions.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) {
    const db = this.sqlite;
    let values = [];
    const statement = {
      sql,
      bind(...args) { values = args; return statement; },
      async all() { return { results: db.prepare(sql).all(...values).map((r) => ({ ...r })) }; },
      async run() { const r = db.prepare(sql).run(...values); return { meta: { changes: Number(r.changes) } }; },
      async execute() {
        if (/^\s*(SELECT|WITH)/i.test(sql)) return statement.all();
        return statement.run();
      },
    };
    return statement;
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try {
      const result = [];
      for (const s of statements) result.push(await s.execute());
      this.sqlite.exec('COMMIT');
      return result;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}
const origin = 'https://supanat-dev.github.io';
const envFor = () => ({ DB: new D1(), ADMIN_TOKEN: 'test-only-token-not-a-production-secret', ALLOWED_ORIGINS: origin });
const base = 'https://analytics.example';
function request(path, env, options = {}) {
  return worker.fetch(new Request(base + path, { ...options, headers: { Authorization: `Bearer ${env.ADMIN_TOKEN}`, ...options.headers } }), env);
}
function visit(sessionId = crypto.randomUUID(), visitorId = crypto.randomUUID()) {
  return { version: 2, type: 'start', sessionId, visitorId, persistentVisitor: true, startedAt: new Date(Date.now() - 30000).toISOString(),
    sequence: 1, path: '/Portfolio/?private=hidden#about', referrer: 'https://www.google.com/search?q=private',
    language: 'th-TH', screen: '1920x1080', timezone: 'Asia/Bangkok',
    views: [{ id: crypto.randomUUID(), kind: 'page', title: 'Portfolio', path: '/Portfolio/?secret=x', startedAt: new Date().toISOString(), activeSeconds: 20, maxScroll: 75 }],
    events: [{ id: crypto.randomUUID(), type: 'project_open', label: 'Echo Glove', path: '/Portfolio/', at: new Date().toISOString() }] };
}
function collect(env, body, extra = {}) {
  const req = new Request(base + '/api/collect', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0', ...extra }, body: JSON.stringify(body) });
  Object.defineProperty(req, 'cf', { value: { city: 'Bangkok', region: 'Bangkok', regionCode: '10', country: 'TH', latitude: '13.7', longitude: '100.5' } });
  return worker.fetch(req, env);
}

test('upgrade preserves old sessions; protected APIs require the owner token', async () => {
  const env = envFor();
  env.DB.sqlite.exec("INSERT INTO sessions (session_id, started_at, last_seen_at) VALUES ('legacy-session-001', datetime('now'), datetime('now'))");
  assert.equal((await worker.fetch(new Request(base + '/api/sessions'), env)).status, 401);
  assert.equal((await worker.fetch(new Request(base + '/api/push/setup', { method: 'POST' }), env)).status, 401);
  const data = await (await request('/api/sessions?range=all', env)).json();
  assert.equal(data.summary.total, 1);
  assert.equal(data.sessions[0].visitor_type, null);
  await ensureExtendedSchema(env.DB);
  assert.equal((await request('/api/sessions?range=7', env)).status, 200);
});
test('collects device, approximate city, source, views, clicks and scroll; strips query data', async () => {
  const env = envFor(); const body = visit();
  const response = await collect(env, body);
  assert.equal(response.status, 202);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  const data = await (await request('/api/sessions?range=7', env)).json();
  const s = data.sessions[0];
  assert.equal(s.browser, 'Edge'); assert.equal(s.os, 'Windows'); assert.equal(s.device, 'Desktop');
  assert.equal(s.source, 'Google'); assert.equal(s.city, 'Bangkok'); assert.equal(s.visitor_type, 'new');
  assert.equal(s.path, '/Portfolio/'); assert.equal(s.referrer, 'https://www.google.com');
  assert.equal(data.content[0].active_seconds, 20); assert.equal(data.content[0].path, '/Portfolio/');
  assert.equal(data.scroll.length, 3); assert.equal(data.scroll[2].milestone, 75);
  assert.equal(data.interactions[0].label, 'Echo Glove');
  assert.equal(JSON.stringify(data).includes('13.7'), false);
  const detail = await (await request('/api/sessions/' + body.sessionId, env)).json();
  assert.equal(detail.events.length, 1); assert.equal(detail.views.length, 1);
});
test('same random visitor returning in another document is returning, not another unique visitor', async () => {
  const env = envFor(); const first = visit();
  await collect(env, first);
  await collect(env, visit(crypto.randomUUID(), first.visitorId));
  const data = await (await request('/api/sessions?range=all', env)).json();
  assert.equal(data.summary.unique_visitors, 1);
  assert.equal(data.summary.new_visits, 1); assert.equal(data.summary.returning_visits, 1);
});
test('blocked persistent storage is marked unknown and not fingerprinted', async () => {
  const env = envFor(); const body = visit(); body.persistentVisitor = false;
  await collect(env, body);
  const data = await (await request('/api/sessions', env)).json();
  assert.equal(data.sessions[0].visitor_type, 'unknown'); assert.equal(data.sessions[0].visitor_id, null);
});
test('retry, duplicate events and reordered heartbeats do not duplicate or reopen an ended visit', async () => {
  const env = envFor(); const body = visit();
  await collect(env, body); await collect(env, body);
  body.type = 'end'; body.sequence = 3; body.views[0].activeSeconds = 25;
  await collect(env, body);
  body.type = 'heartbeat'; body.sequence = 2; body.views[0].activeSeconds = 10;
  await collect(env, body);
  const detail = await (await request('/api/sessions/' + body.sessionId, env)).json();
  assert.equal(detail.session.status, 'ended'); assert.equal(detail.events.length, 1);
  assert.equal(detail.views[0].active_seconds, 25);
});
test('a missed start is repaired by heartbeat; old tracker still works', async () => {
  const env = envFor(); const body = visit(); body.type = 'heartbeat';
  assert.equal((await collect(env, body)).status, 202);
  const old = { type: 'heartbeat', sessionId: crypto.randomUUID(), path: '/Portfolio/' };
  assert.equal((await collect(env, old)).status, 202);
  assert.equal((await (await request('/api/sessions', env)).json()).summary.total, 2);
});
test('DNT/GPC, rejected origins, malformed and oversized batches never write visits', async () => {
  const env = envFor();
  assert.equal((await collect(env, visit(), { DNT: '1' })).status, 202);
  assert.equal((await collect(env, visit(), { 'Sec-GPC': '1' })).status, 202);
  assert.equal((await collect(env, visit(), { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await collect(env, null)).status, 400);
  const big = visit(); big.views = Array(21).fill(big.views[0]);
  assert.equal((await collect(env, big)).status, 400);
  big.views = []; big.noise = 'x'.repeat(60001);
  assert.equal((await collect(env, big)).status, 413);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
});
test('new visit cursor is independent of date filter and paginated without replay', async () => {
  const env = envFor(); const first = visit(); await collect(env, first);
  const before = await (await request('/api/sessions?range=1', env)).json();
  await collect(env, visit());
  const changes = await (await request('/api/visits?after=' + before.latestCursor, env)).json();
  assert.equal(changes.visits.length, 1);
  assert.equal((await (await request('/api/visits?after=' + changes.cursor, env)).json()).visits.length, 0);
});
test('Thai today includes a session after local midnight but before UTC midnight', async () => {
  const env = envFor(); await ensureExtendedSchema(env.DB);
  const thaiDate = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const midnight = new Date(thaiDate + 'T00:01:00+07:00').toISOString();
  env.DB.sqlite.prepare('INSERT INTO sessions (session_id, started_at, last_seen_at) VALUES (?, ?, ?)').run('bangkok-midnight-0001', midnight, midnight);
  const data = await (await request('/api/sessions?range=all', env)).json();
  assert.equal(data.summary.today, 1);
});
test('browser and OS detection covers iPhone, Android tablet and iPad desktop UA', () => {
  assert.deepEqual(classifyClient('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1'), { browser: 'Safari', os: 'iOS', device: 'Mobile' });
  assert.equal(classifyClient('Mozilla/5.0 (Linux; Android 15; Tablet) Chrome/140.0 Safari/537.36').device, 'Tablet');
  assert.equal(classifyClient('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1', { tablet: true }).os, 'iOS');
  assert.equal(sourceInfo('https://l.facebook.com/path?fbclid=secret', origin).source, 'Facebook');
  assert.equal(sourceInfo('https://github.com/name', origin).source, 'GitHub');
  assert.equal(sourceInfo('', origin).referrer, null);
  assert.equal(safePath('//example.com'), '/');
});
const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
async function subscription() {
  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { endpoint: 'https://fcm.googleapis.com/fcm/send/test-device', expirationTime: null,
    keys: { p256dh: b64(await crypto.subtle.exportKey('raw', keys.publicKey)), auth: b64(crypto.getRandomValues(new Uint8Array(16))) } };
}
test('push setup keeps private key server-side and encrypted; repeat setup keeps identity', async () => {
  const env = envFor();
  const first = await (await request('/api/push/setup', env, { method: 'POST' })).json();
  const second = await (await request('/api/push/setup', env, { method: 'POST' })).json();
  assert.equal(first.publicKey, second.publicKey); assert.equal(Object.keys(first).length, 1);
  const row = env.DB.sqlite.prepare('SELECT * FROM analytics_push_config').get();
  assert.ok(row.encrypted_private_key.length > 43);
  assert.equal((await worker.fetch(new Request(base + '/api/push/config'), env)).status, 401);
});
test('push sends encrypted payload once per session and removes expired subscriptions', async () => {
  const env = envFor(); const body = visit(); await collect(env, body);
  const config = await (await request('/api/push/setup', env, { method: 'POST' })).json();
  const sub = await subscription(); assert.equal(validSubscription(sub), true);
  assert.equal(validSubscription({ ...sub, endpoint: 'https://127.0.0.1/admin' }), false);
  assert.equal((await request('/api/push/subscribe', env, { method: 'POST', body: JSON.stringify({ subscription: sub, publicKey: config.publicKey }) })).status, 200);
  let sends = 0;
  const transport = async (url, payload) => {
    sends++; assert.equal(url, sub.endpoint); assert.equal(payload.headers['content-encoding'], 'aes128gcm');
    assert.match(payload.headers.authorization, /^vapid /); assert.equal(payload.body.byteLength, 4096);
    assert.equal(new TextDecoder().decode(payload.body).includes('sessionId'), false);
    return new Response('', { status: 201 });
  };
  const args = { sessionId: body.sessionId, now: new Date().toISOString(), dashboardOrigin: base };
  await notifyVisit(env, args, transport); await notifyVisit(env, args, transport);
  assert.equal(sends, 1);
  const second = visit(); await collect(env, second);
  await notifyVisit(env, { ...args, sessionId: second.sessionId }, async () => new Response('', { status: 410 }));
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM analytics_push_subscriptions').get().n, 0);
});
test('rotating owner password invalidates old token and lets push re-enroll with new keys', async () => {
  const env = envFor(); const oldToken = env.ADMIN_TOKEN;
  const first = await (await request('/api/push/setup', env, { method: 'POST' })).json();
  env.ADMIN_TOKEN = 'another-test-token-not-a-production-secret';
  assert.equal((await worker.fetch(new Request(base + '/api/push/config', { headers: { Authorization: 'Bearer ' + oldToken } }), env)).status, 401);
  const second = await (await request('/api/push/setup', env, { method: 'POST' })).json();
  assert.notEqual(first.publicKey, second.publicKey);
});
