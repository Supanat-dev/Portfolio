const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origin || !configured.includes(origin)) return null;
  return origin;
}

function corsHeaders(origin) {
  return origin ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  } : {};
}

function isAuthorized(request, env) {
  const auth = request.headers.get('Authorization') || '';
  return Boolean(env.ADMIN_TOKEN) && auth === `Bearer ${env.ADMIN_TOKEN}`;
}

function validSessionId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(value);
}

function safeText(value, maxLength) {
  if (typeof value !== 'string') return null;
  return value.trim().slice(0, maxLength) || null;
}

function parseRange(value) {
  if (value === 'all') return null;
  const days = Number(value || 7);
  return [1, 7, 30, 90].includes(days) ? days : 7;
}

async function collect(request, env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return json({ error: 'Origin not allowed' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, corsHeaders(origin));
  }

  if (!validSessionId(body.sessionId)) {
    return json({ error: 'Invalid session id' }, 400, corsHeaders(origin));
  }

  const type = ['start', 'heartbeat', 'end'].includes(body.type) ? body.type : null;
  if (!type) return json({ error: 'Invalid event type' }, 400, corsHeaders(origin));

  const now = new Date().toISOString();
  const path = safeText(body.path, 500) || '/';
  const referrer = safeText(body.referrer, 800);
  const language = safeText(body.language, 40);
  const timezone = safeText(body.timezone, 80);
  const screen = safeText(body.screen, 40);
  const userAgent = safeText(request.headers.get('User-Agent'), 500);
  const country = safeText(request.cf?.country, 8);

  if (type === 'start') {
    await env.DB.prepare(`
      INSERT INTO sessions (
        session_id, started_at, last_seen_at, status, path, referrer,
        language, timezone, screen, user_agent, country
      ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        status = 'active',
        path = excluded.path
    `).bind(
      body.sessionId, now, now, path, referrer, language,
      timezone, screen, userAgent, country,
    ).run();
  } else {
    await env.DB.prepare(`
      UPDATE sessions SET
        last_seen_at = ?,
        ended_at = CASE WHEN ? = 'end' THEN ? ELSE ended_at END,
        duration_seconds = MAX(0, unixepoch(?) - unixepoch(started_at)),
        status = CASE WHEN ? = 'end' THEN 'ended' ELSE 'active' END,
        end_reason = CASE WHEN ? = 'end' THEN ? ELSE end_reason END,
        path = ?
      WHERE session_id = ?
    `).bind(
      now, type, now, now, type, type, safeText(body.reason, 60), path, body.sessionId,
    ).run();
  }

  return json({ ok: true }, 202, corsHeaders(origin));
}

async function sessions(request, env) {
  if (!isAuthorized(request, env)) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get('range'));
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 250);
  const rangeClause = range ? 'AND datetime(started_at) >= datetime(\'now\', ?)' : '';
  const rangeValue = range ? `-${range} days` : null;

  await env.DB.prepare(`
    UPDATE sessions SET
      status = 'ended',
      ended_at = COALESCE(ended_at, last_seen_at),
      duration_seconds = MAX(0, unixepoch(last_seen_at) - unixepoch(started_at)),
      end_reason = COALESCE(end_reason, 'timeout')
    WHERE status = 'active' AND datetime(last_seen_at) < datetime('now', '-45 seconds')
  `).run();

  const summarySql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
      ROUND(AVG(duration_seconds)) AS avg_duration,
      SUM(CASE WHEN date(started_at) = date('now') THEN 1 ELSE 0 END) AS today
    FROM sessions
    WHERE 1 = 1 ${rangeClause}
  `;
  const listSql = `
    SELECT session_id, started_at, last_seen_at, ended_at, duration_seconds,
      status, end_reason, path, referrer, language, timezone, screen,
      user_agent, country
    FROM sessions
    WHERE 1 = 1 ${rangeClause}
    ORDER BY started_at DESC
    LIMIT ?
  `;

  const summaryStatement = range
    ? env.DB.prepare(summarySql).bind(rangeValue)
    : env.DB.prepare(summarySql);
  const listStatement = range
    ? env.DB.prepare(listSql).bind(rangeValue, limit)
    : env.DB.prepare(listSql).bind(limit);
  const [summaryResult, listResult] = await env.DB.batch([summaryStatement, listStatement]);

  return json({
    summary: summaryResult.results?.[0] || { total: 0, active: 0, avg_duration: 0, today: 0 },
    sessions: listResult.results || [],
    generatedAt: new Date().toISOString(),
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/collect' && request.method === 'OPTIONS') {
      const origin = allowedOrigin(request, env);
      return origin
        ? new Response(null, { status: 204, headers: corsHeaders(origin) })
        : json({ error: 'Origin not allowed' }, 403);
    }

    if (url.pathname === '/api/collect' && request.method === 'POST') {
      return collect(request, env);
    }

    if (url.pathname === '/api/sessions' && request.method === 'GET') {
      return sessions(request, env);
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'portfolio-analytics' });
    }

    return env.ASSETS.fetch(request);
  },
};
