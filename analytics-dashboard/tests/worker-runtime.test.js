import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('Workers runtime serves analytics and retires every notification endpoint without sending', async (t) => {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('../src/index.js', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
  });
  let outbound = 0;
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundled.outputFiles[0].text, compatibilityDate: '2026-10-25',
    d1Databases: ['DB'], bindings: { ADMIN_TOKEN: 'runtime-qa-token', ALLOWED_ORIGINS: 'https://portfolio.example' },
    outboundService: async () => { outbound++; return new Response('', { status: 500 }); },
  }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  const migration = readFileSync(new URL('../migrations/0001_create_sessions.sql', import.meta.url), 'utf8');
  await db.batch(migration.split(';').map((sql) => sql.trim()).filter(Boolean).map((sql) => db.prepare(sql)));
  const api = (path, body) => mf.dispatchFetch('https://analytics.example' + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer runtime-qa-token', 'Content-Type': 'application/json', Origin: 'https://portfolio.example' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const visit = { version: 2, type: 'start', sessionId: crypto.randomUUID(), sequence: 1,
    startedAt: new Date().toISOString(), path: '/Portfolio/', persistentVisitor: false, views: [], events: [] };
  assert.equal((await api('/api/collect', visit)).status, 202);
  const summary = await (await api('/api/sessions')).json();
  assert.equal(summary.summary.total, 1);
  for (const path of ['/api/push/config', '/api/push/setup', '/api/push/subscribe', '/api/push/status', '/api/push/test', '/api/visits']) {
    assert.equal((await api(path, {})).status, 410);
  }
  assert.equal(outbound, 0);
});
