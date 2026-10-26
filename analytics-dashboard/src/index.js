import { classifyClient, safePath, sourceInfo } from './analytics.js';
import { ensureExtendedSchema } from './schema.js';
import { handlePush, notifyVisit } from './push.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
const safeText = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) || null : null;
const validId = (value) => typeof value === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(value);
const integer = (value, max = 86400) => Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));
const authorized = (request, env) => Boolean(env.ADMIN_TOKEN) && request.headers.get('Authorization') === `Bearer ${env.ADMIN_TOKEN}`;
function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  return (env.ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).includes(origin) ? origin : null;
}
const corsHeaders = (origin) => ({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' });
function timestamp(value, now) {
  const date = Date.parse(value);
  return Number.isFinite(date) && Math.abs(date - Date.parse(now)) < 86400_000 ? new Date(date).toISOString() : now;
}
function timeRange(url, column = 's.started_at') {
  const raw = url.searchParams.get('range');
  const days = raw === 'all' ? null : [1, 7, 30, 90].includes(Number(raw)) ? Number(raw) : 7;
  return { clause: days ? ` AND datetime(${column}) >= datetime('now', ?)` : '', values: days ? [`-${days} days`] : [] };
}

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid JSON');
  let total = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 60000) { await reader.cancel(); throw new Error('Body too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function collect(request, env, ctx) {
  const origin = allowedOrigin(request, env);
  if (!origin) return json({ error: 'Origin not allowed' }, 403);
  const cors = corsHeaders(origin);
  if (request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1') return json({ ok: true, ignored: true }, 202, cors);
  let body;
  try { body = await readBody(request); }
  catch (error) { return json({ error: 'Invalid request body' }, error.message === 'Body too large' ? 413 : 400, cors); }
  if (!body || !validId(body.sessionId)) return json({ error: 'Invalid session id' }, 400, cors);
  if (!['start', 'heartbeat', 'end'].includes(body.type)) return json({ error: 'Invalid event type' }, 400, cors);
  const extended = body.version === 2;
  if (extended && (!Array.isArray(body.views) || body.views.length > 20 || !Array.isArray(body.events) || body.events.length > 15)) return json({ error: 'Invalid batch' }, 400, cors);
  if (extended) await ensureExtendedSchema(env.DB);
  const now = new Date().toISOString();
  const path = safePath(body.path);
  const { source, referrer } = sourceInfo(body.referrer, origin);
  const ua = safeText(request.headers.get('User-Agent'), 500);
  const cf = request.cf || {};
  const statements = [];
  // Insert on heartbeat too, so losing the first network request never loses a visit.
  statements.push(env.DB.prepare(`INSERT INTO sessions (
    session_id, started_at, last_seen_at, ended_at, duration_seconds, status, end_reason,
    path, referrer, language, timezone, screen, user_agent, country
  ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id) DO UPDATE SET last_seen_at = excluded.last_seen_at,
    ended_at = excluded.ended_at, status = excluded.status, end_reason = excluded.end_reason,
    duration_seconds = MAX(0, unixepoch(excluded.last_seen_at) - unixepoch(sessions.started_at)), path = excluded.path
  ${extended ? `WHERE COALESCE((SELECT last_sequence FROM analytics_session_details WHERE session_id = excluded.session_id), -1) < ?` : ''}`)
    .bind(body.sessionId, extended ? timestamp(body.startedAt, now) : now, now,
      body.type === 'end' ? now : null, body.type === 'end' ? 'ended' : 'active',
      body.type === 'end' ? safeText(body.reason, 60) : null, path, referrer,
      safeText(body.language, 40), safeText(body.timezone, 80), safeText(body.screen, 40), ua,
      safeText(cf.country, 8), ...(extended ? [integer(body.sequence, Number.MAX_SAFE_INTEGER)] : [])));
  if (extended) {
    const visitorId = validId(body.visitorId) && body.persistentVisitor === true ? body.visitorId : null;
    if (visitorId) statements.push(env.DB.prepare(`INSERT INTO analytics_visitors VALUES (?, ?, ?, ?)
      ON CONFLICT(visitor_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`).bind(visitorId, body.sessionId, now, now));
    const client = classifyClient(ua || '', body.deviceHints || {});
    statements.push(env.DB.prepare(`INSERT INTO analytics_session_details (
      session_id, visitor_id, visitor_type, browser, os, device, source, city, region, region_code, country, last_sequence
    ) VALUES (?, ?, CASE WHEN ? IS NULL THEN 'unknown'
      WHEN (SELECT first_session_id FROM analytics_visitors WHERE visitor_id = ?) = ? THEN 'new' ELSE 'returning' END,
      ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET last_sequence = MAX(last_sequence, excluded.last_sequence)`)
      .bind(body.sessionId, visitorId, visitorId, visitorId, body.sessionId, client.browser, client.os, client.device,
        source, safeText(cf.city, 100), safeText(cf.region, 100), safeText(cf.regionCode, 20), safeText(cf.country, 8), integer(body.sequence, Number.MAX_SAFE_INTEGER)));
    for (const view of body.views) {
      if (!view || !validId(view.id) || !['page', 'section', 'project'].includes(view.kind)) continue;
      statements.push(env.DB.prepare(`INSERT INTO analytics_views (
        view_id, session_id, kind, path, title, started_at, ended_at, active_seconds, max_scroll
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(view_id) DO UPDATE SET active_seconds = MAX(analytics_views.active_seconds, excluded.active_seconds),
        max_scroll = MAX(analytics_views.max_scroll, excluded.max_scroll), ended_at = COALESCE(excluded.ended_at, analytics_views.ended_at)
      WHERE analytics_views.session_id = excluded.session_id`)
        .bind(view.id, body.sessionId, view.kind, safePath(view.path), safeText(view.title, 160) || 'ไม่มีชื่อ',
          timestamp(view.startedAt, now), view.endedAt ? timestamp(view.endedAt, now) : null, integer(view.activeSeconds), integer(view.maxScroll, 100)));
    }
    for (const event of body.events) {
      if (!event || !validId(event.id) || !['click', 'project_open', 'scroll'].includes(event.type)) continue;
      statements.push(env.DB.prepare(`INSERT OR IGNORE INTO analytics_events (
        event_id, session_id, view_id, type, label, target, path, occurred_at, percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(event.id, body.sessionId, validId(event.viewId) ? event.viewId : null, event.type,
          safeText(event.label, 160), safeText(event.target, 300), safePath(event.path), timestamp(event.at, now),
          event.type === 'scroll' ? integer(event.percentage, 100) : null));
    }
  }
  await env.DB.batch(statements);
  if (extended && body.type !== 'end' && ctx?.waitUntil) {
    ctx.waitUntil(notifyVisit(env, { sessionId: body.sessionId, now, dashboardOrigin: new URL(request.url).origin }).catch(() => {}));
  }
  return json({ ok: true }, 202, cors);
}

const SESSION_COLUMNS = `s.*, d.visitor_id, d.visitor_type, d.browser, d.os, d.device, d.source, d.city, d.region, d.region_code,
  (SELECT COUNT(*) FROM analytics_views v WHERE v.session_id = s.session_id AND v.kind = 'page') AS page_views,
  (SELECT MAX(max_scroll) FROM analytics_views v WHERE v.session_id = s.session_id AND v.kind = 'page') AS max_scroll`;
async function sessions(request, env) {
  if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401);
  await ensureExtendedSchema(env.DB);
  const url = new URL(request.url);
  const range = timeRange(url);
  const limit = Math.min(Math.max(Math.floor(Number(url.searchParams.get('limit')) || 100), 1), 250);
  await env.DB.prepare(`UPDATE sessions SET status = 'ended', ended_at = COALESCE(ended_at, last_seen_at),
    duration_seconds = MAX(0, unixepoch(last_seen_at) - unixepoch(started_at)), end_reason = COALESCE(end_reason, 'timeout')
    WHERE status = 'active' AND datetime(last_seen_at) < datetime('now', '-45 seconds')`).run();
  const query = (sql, values = range.values) => env.DB.prepare(sql).bind(...values);
  const from = `FROM sessions s LEFT JOIN analytics_session_details d ON s.session_id = d.session_id WHERE 1 = 1 ${range.clause}`;
  const results = await env.DB.batch([
    query(`SELECT COUNT(*) AS total, SUM(s.status = 'active') AS active, ROUND(AVG(s.duration_seconds)) AS avg_duration,
      SUM(date(s.started_at, '+7 hours') = date('now', '+7 hours')) AS today,
      COUNT(DISTINCT d.visitor_id) AS unique_visitors, SUM(d.visitor_type = 'new') AS new_visits,
      SUM(d.visitor_type = 'returning') AS returning_visits ${from}`),
    query(`SELECT ${SESSION_COLUMNS} ${from} ORDER BY s.started_at DESC LIMIT ?`, [...range.values, limit]),
    query(`SELECT COALESCE(d.source, 'ข้อมูลเดิม / ไม่ทราบ') AS name, COUNT(*) AS count ${from} GROUP BY name ORDER BY count DESC LIMIT 12`),
    query(`SELECT d.browser AS name, COUNT(*) AS count ${from} AND d.browser IS NOT NULL GROUP BY name ORDER BY count DESC`),
    query(`SELECT d.os AS name, COUNT(*) AS count ${from} AND d.os IS NOT NULL GROUP BY name ORDER BY count DESC`),
    query(`SELECT d.device AS name, COUNT(*) AS count ${from} AND d.device IS NOT NULL GROUP BY name ORDER BY count DESC`),
    query(`SELECT v.kind, v.path, v.title, COUNT(*) AS views, SUM(v.active_seconds) AS active_seconds,
      ROUND(AVG(v.active_seconds)) AS average_seconds, MAX(v.max_scroll) AS max_scroll
      FROM analytics_views v JOIN sessions s ON s.session_id = v.session_id WHERE 1 = 1 ${range.clause}
      GROUP BY v.kind, v.path, v.title ORDER BY views DESC LIMIT 100`),
    query(`SELECT e.type, e.label, e.target, COUNT(*) AS count FROM analytics_events e
      JOIN sessions s ON s.session_id = e.session_id WHERE e.type IN ('click', 'project_open') ${range.clause}
      GROUP BY e.type, e.label, e.target ORDER BY count DESC LIMIT 30`),
    query(`SELECT milestone, COUNT(*) AS reached,
      (SELECT COUNT(*) FROM analytics_views v JOIN sessions s ON s.session_id = v.session_id WHERE v.kind = 'page' ${range.clause}) AS total
      FROM (SELECT 25 AS milestone UNION ALL SELECT 50 UNION ALL SELECT 75 UNION ALL SELECT 100) m
      JOIN analytics_views v ON v.max_scroll >= m.milestone JOIN sessions s ON s.session_id = v.session_id
      WHERE v.kind = 'page' ${range.clause} GROUP BY milestone ORDER BY milestone`, [...range.values, ...range.values]),
    env.DB.prepare('SELECT rowid AS cursor FROM sessions ORDER BY rowid DESC LIMIT 1'),
  ]);
  return json({ summary: results[0].results?.[0] || {}, sessions: results[1].results || [],
    sources: results[2].results || [], browsers: results[3].results || [], os: results[4].results || [], devices: results[5].results || [],
    content: results[6].results || [], interactions: results[7].results || [], scroll: results[8].results || [],
    latestCursor: results[9].results?.[0]?.cursor || 0, generatedAt: new Date().toISOString() });
}
async function sessionDetail(request, env, sessionId) {
  if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401);
  if (!validId(sessionId)) return json({ error: 'Invalid session id' }, 400);
  await ensureExtendedSchema(env.DB);
  const results = await env.DB.batch([
    env.DB.prepare(`SELECT ${SESSION_COLUMNS} FROM sessions s LEFT JOIN analytics_session_details d ON s.session_id = d.session_id WHERE s.session_id = ?`).bind(sessionId),
    env.DB.prepare('SELECT * FROM analytics_views WHERE session_id = ? ORDER BY started_at LIMIT 500').bind(sessionId),
    env.DB.prepare('SELECT * FROM analytics_events WHERE session_id = ? ORDER BY occurred_at LIMIT 501').bind(sessionId),
  ]);
  if (!results[0].results?.length) return json({ error: 'Session not found' }, 404);
  return json({ session: results[0].results[0], views: results[1].results, events: results[2].results.slice(0, 500), truncated: results[2].results.length > 500 });
}
async function newVisits(request, env) {
  if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401);
  await ensureExtendedSchema(env.DB);
  const after = integer(new URL(request.url).searchParams.get('after'), Number.MAX_SAFE_INTEGER);
  const result = await env.DB.prepare(`SELECT s.rowid AS cursor, s.session_id, s.started_at, d.city, s.country, d.source, d.device
    FROM sessions s LEFT JOIN analytics_session_details d ON d.session_id = s.session_id WHERE s.rowid > ? ORDER BY s.rowid LIMIT 51`).bind(after).all();
  const visits = (result.results || []).slice(0, 50);
  return json({ visits, cursor: visits.at(-1)?.cursor || after, hasMore: (result.results || []).length > 50 });
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/collect' && request.method === 'OPTIONS') {
      const origin = allowedOrigin(request, env);
      return origin ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : json({ error: 'Origin not allowed' }, 403);
    }
    try {
      if (url.pathname === '/api/collect' && request.method === 'POST') return await collect(request, env, ctx);
      if (url.pathname === '/api/sessions' && request.method === 'GET') return await sessions(request, env);
      if (url.pathname.startsWith('/api/sessions/') && request.method === 'GET') return await sessionDetail(request, env, url.pathname.split('/').at(-1));
      if (url.pathname === '/api/visits' && request.method === 'GET') return await newVisits(request, env);
      if (url.pathname.startsWith('/api/push/')) {
        if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401);
        await ensureExtendedSchema(env.DB);
        return await handlePush(request, env, { json, readBody });
      }
      if (url.pathname === '/api/health') return json({ ok: true, service: 'portfolio-analytics', version: 2 });
      if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('Analytics request failed', error.name);
      const origin = allowedOrigin(request, env);
      return json({ error: 'Analytics temporarily unavailable' }, 503, origin ? corsHeaders(origin) : {});
    }
  },
};
