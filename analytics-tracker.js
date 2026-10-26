/**
 * First-party analytics. Random visitor identity expires after 180 days.
 * No IP, fingerprint, form values, URL queries, or cross-site identity is stored.
 */
(function () {
  'use strict';
  const script = document.currentScript;
  const endpoint = (script?.dataset.analyticsEndpoint || '').replace(/\/$/, '');
  const safeStorage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* Storage may be blocked. */ } },
  };
  const disabled = () => navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true
    || safeStorage.get('portfolio_analytics_optout') === '1';
  const optout = document.querySelector('#analyticsOptout');
  function updatePrivacyButton() {
    if (!optout) return;
    optout.disabled = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
    optout.textContent = optout.disabled ? 'ปิดตามการตั้งค่าความเป็นส่วนตัวของเบราว์เซอร์' : disabled() ? 'เปิดสถิติการใช้งานนิรนาม' : 'ปิดสถิติการใช้งานบนเครื่องนี้';
  }
  if (optout) optout.addEventListener('click', () => {
    safeStorage.set('portfolio_analytics_optout', safeStorage.get('portfolio_analytics_optout') === '1' ? '0' : '1');
    if (disabled()) safeStorage.remove('portfolio_analytics_visitor');
    location.reload();
  });
  updatePrivacyButton();
  if (!endpoint || disabled()) return;
  const sessionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const VISITOR_KEY = 'portfolio_analytics_visitor';
  let visitor;
  try { visitor = JSON.parse(safeStorage.get(VISITOR_KEY)); } catch { visitor = null; }
  if (!visitor || !/^[a-zA-Z0-9-]{16,80}$/.test(visitor.id || '') || !Number.isFinite(visitor.expiresAt) || visitor.expiresAt < Date.now()) {
    visitor = { id: crypto.randomUUID(), expiresAt: Date.now() + 180 * 86400_000 };
  }
  const persistentVisitor = safeStorage.set(VISITOR_KEY, JSON.stringify(visitor));
  let referrer = null;
  try { referrer = document.referrer ? new URL(document.referrer).origin : null; } catch { /* No source available. */ }
  let ended = false;
  let sequence = 0;
  let inFlight = false;
  let currentSection = null;
  let currentProject = null;
  let page;
  let lastTick = performance.now();
  let lastActivity = lastTick;
  let flushTimer;
  const dirty = new Map();
  let events = [];
  const sectionNames = { hero: 'หน้าแรก', about: 'เกี่ยวกับ', 'echo-glove': 'Echo Glove — โครงงานเด่น', achievements: 'ผลงานและรางวัล', contact: 'ติดต่อ' };
  const sections = [...document.querySelectorAll('body > section[id]')].filter((el) => sectionNames[el.id]);
  const path = () => location.pathname.slice(0, 500);
  function touch(view) {
    if (!view) return;
    view.revision = (view.revision || 0) + 1;
    dirty.set(view.id, view);
  }
  function newView(kind, title, targetPath = path()) {
    const view = { id: crypto.randomUUID(), kind, title: String(title).slice(0, 160), path: targetPath,
      startedAt: new Date().toISOString(), activeSeconds: 0, activeMs: 0, maxScroll: 0, milestones: new Set() };
    touch(view);
    return view;
  }
  function finish(view) {
    if (view && !view.endedAt) { view.endedAt = new Date().toISOString(); touch(view); }
  }
  function event(type, label, target = '', percentage = null) {
    if (ended || disabled()) return;
    events.push({ id: crypto.randomUUID(), viewId: page.id, type, label: String(label).slice(0, 160),
      target: String(target).slice(0, 300), path: path(), at: new Date().toISOString(), percentage });
    if (events.length > 200) events.shift();
    if (!flushTimer) flushTimer = window.setTimeout(() => { flushTimer = null; send('heartbeat'); }, 1800);
  }
  function tick() {
    const now = performance.now();
    const delta = Math.min(5000, Math.max(0, now - lastTick));
    lastTick = now;
    if (ended || document.visibilityState === 'hidden' || now - lastActivity > 60_000) return;
    for (const view of [page, currentProject || currentSection]) {
      if (!view) continue;
      view.activeMs += delta;
      const seconds = Math.floor(view.activeMs / 1000);
      if (seconds !== view.activeSeconds) { view.activeSeconds = seconds; touch(view); }
    }
  }
  function selectSection() {
    if (ended || currentProject || document.visibilityState === 'hidden') return;
    tick();
    const middle = innerHeight * 0.45;
    const section = sections.find((el) => { const rect = el.getBoundingClientRect(); return rect.top <= middle && rect.bottom > middle; });
    if (!section || currentSection?.sectionId === section.id) return;
    finish(currentSection);
    currentSection = newView('section', sectionNames[section.id], path());
    currentSection.sectionId = section.id;
  }
  function measureScroll() {
    if (ended || currentProject || document.visibilityState === 'hidden') return;
    const scrollable = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    // 100% means the viewport has reached the bottom. A non-scrollable page is fully visible.
    const percent = scrollable < 1 ? 100 : Math.min(100, Math.floor((Math.max(0, scrollY) + 2) / scrollable * 100));
    if (percent > page.maxScroll) { page.maxScroll = percent; touch(page); }
    for (const milestone of [25, 50, 75, 100]) {
      if (percent >= milestone && !page.milestones.has(milestone)) {
        page.milestones.add(milestone);
        event('scroll', 'เลื่อนหน้า ' + milestone + '%', '', milestone);
      }
    }
  }
  function snapshot(view) {
    return { id: view.id, kind: view.kind, title: view.title, path: view.path, startedAt: view.startedAt,
      endedAt: view.endedAt || null, activeSeconds: view.activeSeconds, maxScroll: view.maxScroll };
  }
  async function send(type, beacon = false) {
    if ((ended && type !== 'end') || disabled() || (inFlight && !beacon)) return;
    tick();
    const selection = [...dirty.values()].slice(0, 20);
    const revisions = selection.map((view) => [view.id, view.revision]);
    const batch = events.slice(0, 15);
    const body = JSON.stringify({ version: 2, type, reason: type === 'end' ? 'pagehide' : null,
      sequence: ++sequence, sessionId, startedAt, visitorId: persistentVisitor ? visitor.id : null, persistentVisitor,
      path: path(), referrer, language: navigator.language || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      screen: window.screen.width + 'x' + window.screen.height, deviceHints: { tablet: /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 },
      views: selection.map(snapshot), events: batch });
    if (beacon && navigator.sendBeacon) {
      if (navigator.sendBeacon(endpoint + '/api/collect', new Blob([body], { type: 'text/plain' }))) return;
    }
    inFlight = true;
    try {
      const response = await fetch(endpoint + '/api/collect', { method: 'POST', mode: 'cors', keepalive: true,
        headers: { 'Content-Type': 'text/plain' }, body });
      if (!response.ok) return;
      const ids = new Set(batch.map((item) => item.id));
      events = events.filter((item) => !ids.has(item.id));
      for (const [id, revision] of revisions) { if (dirty.get(id)?.revision === revision) dirty.delete(id); }
    } catch { /* Retry cumulative views and event IDs on the next heartbeat. */ }
    finally { inFlight = false; }
  }
  page = newView('page', document.title);
  selectSection();
  measureScroll();
  send('start');
  const tickTimer = window.setInterval(tick, 1000);
  const heartbeatTimer = window.setInterval(() => { selectSection(); send('heartbeat'); }, 15_000);
  for (const name of ['pointerdown', 'keydown', 'scroll', 'touchstart']) {
    document.addEventListener(name, () => { tick(); lastActivity = performance.now(); }, { passive: true });
  }
  let scrollQueued = false;
  window.addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { scrollQueued = false; selectSection(); measureScroll(); });
  }, { passive: true });
  window.addEventListener('resize', () => { selectSection(); measureScroll(); });
  document.addEventListener('visibilitychange', () => {
    tick();
    if (document.visibilityState === 'hidden') send('heartbeat', true);
    else { lastTick = performance.now(); lastActivity = lastTick; send('heartbeat'); }
  });
  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target.closest('a, button, [data-target], [data-filter], [data-analytics-label]') : null;
    if (!target || target.closest('#analyticsPrivacy') || target.closest('form, input, textarea, [contenteditable]')) return;
    let destination = target.dataset.target || target.dataset.filter || '';
    if (target.tagName === 'A') {
      try {
        const url = new URL(target.getAttribute('href'), location.href);
        destination = ['http:', 'https:'].includes(url.protocol)
          ? (url.origin === location.origin ? url.pathname + (/^#[a-zA-Z0-9_-]+$/.test(url.hash) ? url.hash : '') : url.origin + url.pathname)
          : url.protocol.replace(':', '');
      } catch { destination = ''; }
    }
    const label = target.dataset.analyticsLabel || target.getAttribute('aria-label') || target.getAttribute('title')
      || target.textContent.trim().replace(/\s+/g, ' ').slice(0, 120) || target.id || 'ปุ่มไม่มีชื่อ';
    event('click', label, destination);
  }, true);
  // Events from the real modal opener capture the exact project, including badges and galleries.
  document.addEventListener('portfolio:analytics', (e) => {
    const detail = e.detail || {};
    tick();
    if (detail.type === 'project_open' && detail.title) {
      if (currentProject?.title === detail.title && currentProject.modalId === detail.modalId) return;
      finish(currentSection);
      currentSection = null;
      finish(currentProject);
      currentProject = newView('project', detail.title);
      currentProject.modalId = detail.modalId;
      event('project_open', detail.title, detail.modalId || '');
    } else if (detail.type === 'project_close') {
      finish(currentProject);
      currentProject = null;
      selectSection();
    } else if (detail.type === 'gallery') event('click', detail.title || 'เปลี่ยนภาพผลงาน', detail.target || '');
  });
  window.addEventListener('pagehide', () => {
    tick();
    finish(page); finish(currentSection); finish(currentProject);
    send('end', true);
    ended = true;
  });
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    ended = false;
    page.endedAt = null;
    if (currentSection) currentSection.endedAt = null;
    if (currentProject) currentProject.endedAt = null;
    lastTick = performance.now(); lastActivity = lastTick;
    touch(page); send('start');
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'portfolio_analytics_optout' && disabled()) {
      ended = true;
      window.clearInterval(tickTimer); window.clearInterval(heartbeatTimer);
      events = []; dirty.clear();
    }
  });
}());
