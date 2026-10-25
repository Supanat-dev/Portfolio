/**
 * Privacy-friendly portfolio analytics.
 *
 * The visitor id is scoped to the current browser tab and is never stored in a
 * cookie or localStorage. Set data-analytics-endpoint on this script tag to the
 * deployed collector URL, for example https://portfolio-analytics.example.workers.dev.
 */
(function () {
  'use strict';

  const script = document.currentScript;
  const endpoint = (script?.dataset.analyticsEndpoint || '').replace(/\/$/, '');

  if (!endpoint || navigator.doNotTrack === '1') return;

  const storageKey = 'portfolio_analytics_session';
  const existingSession = sessionStorage.getItem(storageKey);
  const sessionId = existingSession || crypto.randomUUID();
  sessionStorage.setItem(storageKey, sessionId);

  let ended = false;
  let heartbeatTimer;

  function payload(type, reason) {
    return JSON.stringify({
      type,
      reason: reason || null,
      sessionId,
      path: location.pathname + location.search + location.hash,
      referrer: document.referrer || null,
      language: navigator.language || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      screen: `${window.screen.width}x${window.screen.height}`,
    });
  }

  function send(type, reason, useBeacon) {
    if (ended && type !== 'end') return;
    const body = payload(type, reason);

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(`${endpoint}/api/collect`, new Blob([body], { type: 'application/json' }));
      return;
    }

    fetch(`${endpoint}/api/collect`, {
      method: 'POST',
      mode: 'cors',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {
      // Analytics must never interrupt the portfolio experience.
    });
  }

  send(existingSession ? 'heartbeat' : 'start');
  heartbeatTimer = window.setInterval(() => send('heartbeat'), 15_000);

  window.addEventListener('hashchange', () => send('heartbeat'));
  window.addEventListener('pagehide', () => {
    ended = true;
    window.clearInterval(heartbeatTimer);
    send('end', 'pagehide', true);
  });
}());
