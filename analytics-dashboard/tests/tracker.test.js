import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../../analytics-tracker.js', import.meta.url), 'utf8');
const settle = () => new Promise((resolve) => setImmediate(resolve));

function tracker({ saved = new Map(), dnt = '0', gpc = false, blocked = false, rejectFirst = false } = {}) {
  let now = 0;
  const sent = [], beacons = [], windowListeners = {}, documentListeners = {}, timers = [];
  const section = { id: 'hero', getBoundingClientRect: () => ({ top: 0, bottom: 5000 }) };
  const document = {
    title: 'Portfolio', visibilityState: 'visible', referrer: 'https://github.com/user?secret=x',
    currentScript: { dataset: { analyticsEndpoint: 'https://collector.example' } },
    documentElement: { scrollHeight: 5000 }, querySelector: () => null, querySelectorAll: () => [section],
    addEventListener: (name, callback) => (documentListeners[name] ||= []).push(callback),
  };
  const window = { screen: { width: 1280, height: 800 },
    setInterval: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearInterval() {}, addEventListener: (name, callback) => (windowListeners[name] ||= []).push(callback),
  };
  const ctx = { document, window, crypto, Blob, Date, Intl, URL, Uint8Array, Set, Map, console,
    Element: class Element {}, performance: { now: () => now },
    localStorage: { getItem: (key) => { if (blocked) throw new Error(); return saved.get(key) || null; },
      setItem: (key, value) => { if (blocked) throw new Error(); saved.set(key, value); }, removeItem: (key) => saved.delete(key) },
    navigator: { doNotTrack: dnt, globalPrivacyControl: gpc, language: 'th-TH', maxTouchPoints: 0,
      userAgent: 'Chrome/140', sendBeacon: (url, blob) => { beacons.push(blob); return true; } },
    location: { pathname: '/Portfolio/', href: 'https://portfolio.example/Portfolio/?private=x', reload() {} },
    innerHeight: 1000, scrollY: 0, requestAnimationFrame: (callback) => callback(),
    fetch: async (url, options) => { sent.push(JSON.parse(options.body)); return { ok: !(rejectFirst && sent.length === 1) }; },
  };
  runInNewContext(source, ctx);
  return { ctx, sent, beacons, saved,
    emitWindow: (name, detail = {}) => (windowListeners[name] || []).forEach((cb) => cb(detail)),
    emitDocument: (name, detail = {}) => (documentListeners[name] || []).forEach((cb) => cb(detail)),
    advance(ms) { now += ms; for (const t of timers.filter((t) => t.delay === 1000)) t.callback(); },
    heartbeat() { for (const t of timers.filter((t) => t.delay === 15000)) t.callback(); },
  };
}
test('random visitor persists across documents; each opening has its own session and strips source queries', async () => {
  const one = tracker(); await settle();
  const two = tracker({ saved: one.saved }); await settle();
  assert.equal(one.sent[0].visitorId, two.sent[0].visitorId);
  assert.notEqual(one.sent[0].sessionId, two.sent[0].sessionId);
  assert.equal(one.sent[0].referrer, 'https://github.com');
  assert.equal(one.sent[0].path, '/Portfolio/');
});
test('DNT, GPC and opt-out send nothing; blocked storage stays anonymous', async () => {
  assert.equal(tracker({ dnt: '1' }).sent.length, 0);
  assert.equal(tracker({ gpc: true }).sent.length, 0);
  assert.equal(tracker({ saved: new Map([['portfolio_analytics_optout', '1']]) }).sent.length, 0);
  const blocked = tracker({ blocked: true }); await settle();
  assert.equal(blocked.sent[0].persistentVisitor, false); assert.equal(blocked.sent[0].visitorId, null);
});
test('active time stops in hidden tabs and after idle, then resumes on activity', async () => {
  const t = tracker(); await settle();
  for (let i = 0; i < 5; i++) t.advance(1000);
  t.ctx.document.visibilityState = 'hidden'; t.advance(1000);
  t.ctx.document.visibilityState = 'visible';
  t.heartbeat(); await settle();
  assert.equal(t.sent.at(-1).views.find((v) => v.kind === 'page').activeSeconds, 5);
  for (let i = 0; i < 70; i++) t.advance(1000);
  t.heartbeat(); await settle();
  const before = t.sent.at(-1).views.find((v) => v.kind === 'page').activeSeconds;
  assert.ok(before <= 60);
  t.emitDocument('pointerdown'); t.advance(1000); t.heartbeat(); await settle();
  assert.equal(t.sent.at(-1).views.find((v) => v.kind === 'page').activeSeconds, before + 1);
});
test('scroll milestones fire once, modal time is separate, failed requests retry event IDs', async () => {
  const t = tracker({ rejectFirst: true }); await settle();
  t.ctx.scrollY = 4000; t.emitWindow('scroll'); t.emitWindow('scroll');
  t.emitDocument('portfolio:analytics', { detail: { type: 'project_open', title: 'Echo Glove', modalId: 'poster' } });
  t.emitDocument('portfolio:analytics', { detail: { type: 'project_open', title: 'Echo Glove', modalId: 'poster' } });
  for (let i = 0; i < 4; i++) t.advance(1000);
  t.heartbeat(); await settle();
  const body = t.sent.at(-1);
  assert.deepEqual(body.events.filter((e) => e.type === 'scroll').map((e) => e.percentage), [25, 50, 75, 100]);
  assert.equal(body.events.filter((e) => e.type === 'project_open').length, 1);
  assert.equal(body.views.find((v) => v.kind === 'project').activeSeconds, 4);
  assert.equal(body.views.find((v) => v.kind === 'section').activeSeconds, 0);
  t.emitWindow('pagehide'); await settle();
  const end = JSON.parse(await t.beacons.at(-1).text());
  assert.equal(end.type, 'end'); assert.ok(end.sequence > body.sequence);
});
test('expired visitor IDs are replaced', async () => {
  const old = crypto.randomUUID();
  const t = tracker({ saved: new Map([['portfolio_analytics_visitor', JSON.stringify({ id: old, expiresAt: Date.now() - 10 })]]) });
  await settle(); assert.notEqual(t.sent[0].visitorId, old);
});
