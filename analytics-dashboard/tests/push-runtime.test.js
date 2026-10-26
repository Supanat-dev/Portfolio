import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('Web Push runs inside the real Workers runtime, including the outbound HTTP request', async (t) => {
  const bundled = await build({
    stdin: { contents: `import worker from './src/index.js';
      import { buildPushPayload } from '@block65/webcrypto-web-push';
      export default { async fetch(request, env, ctx) {
        if (new URL(request.url).pathname === '/crypto-check') {
          try {
            const body = await request.json();
            const payload = await buildPushPayload({data:'runtime-test'}, body.subscription, body.vapid);
            return Response.json({ ok: true, size: payload.body.byteLength });
          } catch (error) { return Response.json({ name: error.name, message: error.message }, { status: 500 }); }
        }
        return worker.fetch(request, env, ctx);
      } }`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), sourcefile: 'push-runtime-harness.js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
  });
  const sent = [];
  let providerStatus = 201;
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundled.outputFiles[0].text,
    compatibilityDate: '2026-10-25', d1Databases: ['DB'],
    bindings: { ADMIN_TOKEN: 'runtime-qa-token', ALLOWED_ORIGINS: 'https://portfolio.example' },
    outboundService: async (request) => {
      sent.push({ url: request.url, encoding: request.headers.get('Content-Encoding'), body: await request.arrayBuffer() });
      return new Response('', { status: providerStatus, headers: providerStatus === 302 ? { Location: 'https://untrusted.example/' } : {} });
    },
  }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  const migration = readFileSync(new URL('../migrations/0001_create_sessions.sql', import.meta.url), 'utf8');
  await db.batch(migration.split(';').map((sql) => sql.trim()).filter(Boolean).map((sql) => db.prepare(sql)));
  const api = (path, body) => mf.dispatchFetch('https://analytics.example' + path, {
    method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer runtime-qa-token', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const configResponse = await api('/api/push/setup', {});
  const config = await configResponse.json();
  assert.equal(configResponse.status, 200, JSON.stringify(config));
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/runtime-test', keys: {
    p256dh: Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url'),
    auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url'),
  } };
  // Test-only keys, independent of the application or owner's real credentials.
  const signer = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const vapid = { subject: 'https://analytics.example',
    publicKey: Buffer.from(await crypto.subtle.exportKey('raw', signer.publicKey)).toString('base64url'),
    privateKey: (await crypto.subtle.exportKey('jwk', signer.privateKey)).d };
  const cryptoResponse = await api('/crypto-check', { subscription, vapid });
  const cryptoResult = await cryptoResponse.json();
  assert.equal(cryptoResponse.status, 200, JSON.stringify(cryptoResult));
  assert.equal((await api('/api/push/subscribe', { publicKey: config.publicKey, subscription })).status, 200);
  const testResponse = await api('/api/push/test', { endpoint: subscription.endpoint });
  assert.equal(testResponse.status, 200, await testResponse.text());
  assert.equal(sent.length, 1);
  assert.equal(sent[0].encoding, 'aes128gcm');
  assert.equal(sent[0].body.byteLength, 4096);
  // A redirected provider must never receive a follow-up at another origin.
  providerStatus = 302;
  const redirectResponse = await api('/api/push/test', { endpoint: subscription.endpoint });
  assert.equal(redirectResponse.status, 502);
  assert.equal((await redirectResponse.json()).code, 'PUSH_REDIRECT_REJECTED');
  assert.equal(sent.length, 2);
  assert.ok(sent.every((message) => message.url === subscription.endpoint));
  providerStatus = 410;
  const expiredResponse = await api('/api/push/test', { endpoint: subscription.endpoint });
  assert.equal(expiredResponse.status, 502);
  assert.equal((await expiredResponse.json()).code, 'PUSH_SUBSCRIPTION_EXPIRED');
  const status = await (await api('/api/push/status', { endpoint: subscription.endpoint })).json();
  assert.equal(status.registered, false);
});
