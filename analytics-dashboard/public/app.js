const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
const TOKEN_KEY = 'portfolio_admin_token';
const storage = {
  get(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Memory login still works. */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* Storage blocked. */ } },
};
const state = { token: storage.get(TOKEN_KEY), timer: null, busy: false, detail: null, generation: 0 };
const ids = ['loginShell', 'dashboard', 'loginForm', 'loginError', 'token', 'rangeSelect', 'refreshButton', 'logoutButton',
  'lastUpdated', 'activeStat', 'todayStat', 'totalStat', 'averageStat', 'uniqueStat', 'newStat', 'returningStat',
  'resultCount', 'sessionRows', 'emptyState', 'tableWrap', 'sourcesList', 'browsersList', 'osList', 'devicesList',
  'scrollStats', 'contentRows', 'interactionsList', 'sessionDialog', 'detailContent', 'closeDetail',
  'dashboardMessage'];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const number = (value) => Number(value || 0).toLocaleString('th-TH');
const kinds = { page: 'หน้าเว็บ', section: 'ส่วนของหน้า', project: 'ผลงาน / แกลเลอรี' };
const visitorTypes = { new: 'ครั้งแรก', returning: 'กลับมาอีกครั้ง', unknown: 'ไม่สามารถระบุซ้ำได้' };
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function dateParts(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { date: '—', time: '—' };
  return {
    date: new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: BANGKOK_TIME_ZONE }).format(date),
    time: new Intl.DateTimeFormat('th-TH', { timeStyle: 'medium', hour12: false, timeZone: BANGKOK_TIME_ZONE }).format(date),
  };
}
function duration(value) {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  if (seconds < 60) return seconds + ' วินาที';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' นาที ' + seconds % 60 + ' วิ';
  return Math.floor(seconds / 3600) + ' ชม. ' + Math.floor(seconds % 3600 / 60) + ' นาที';
}
function locationName(session) {
  return [...new Set([session.city, session.region, session.country].filter(Boolean))].join(', ') || 'ไม่ทราบ';
}
function breakdown(target, items, label = (item) => item.name) {
  const maximum = Math.max(1, ...items.map((item) => item.count));
  target.innerHTML = items.length ? items.map((item) => '<div class="breakdown-item"><div><span>' + escapeHtml(label(item))
    + '</span><strong>' + number(item.count) + '</strong></div><div class="bar-track"><i style="width:'
    + Math.round(Number(item.count) / maximum * 100) + '%"></i></div></div>').join('')
    : '<p class="no-data">ยังไม่มีข้อมูลหลังอัปเดต</p>';
}
function render(data) {
  const s = data.summary || {};
  for (const [id, value] of Object.entries({ activeStat: s.active, todayStat: s.today, totalStat: s.total,
    uniqueStat: s.unique_visitors, newStat: s.new_visits, returningStat: s.returning_visits })) el[id].textContent = number(value);
  el.averageStat.textContent = duration(s.avg_duration);
  el.lastUpdated.textContent = 'อัปเดตล่าสุด ' + dateParts(data.generatedAt).time + ' น.';
  const sessions = data.sessions || [];
  el.resultCount.textContent = number(sessions.length) + ' รายการล่าสุด';
  el.emptyState.hidden = sessions.length > 0;
  el.tableWrap.hidden = sessions.length === 0;
  el.sessionRows.innerHTML = sessions.map((session) => {
    const start = dateParts(session.started_at);
    return '<tr><td><span class="status ' + (session.status === 'active' ? 'online' : '') + '"><i></i>'
      + (session.status === 'active' ? 'ออนไลน์' : 'สิ้นสุดแล้ว') + '</span><small class="sub-cell">'
      + (visitorTypes[session.visitor_type] || 'ข้อมูลเดิม') + '</small><button class="action-button detail-button" data-session="'
      + escapeHtml(session.session_id) + '">ดูกิจกรรม</button></td><td class="activity-preview">'
      + escapeHtml(session.project_preview || (session.visitor_type ? 'ยังไม่มีการเปิดผลงานที่บันทึกไว้' : 'ไม่มีรายละเอียดก่อนอัปเดต'))
      + '<small class="sub-cell">เปิดผลงาน ' + number(session.project_count) + ' ครั้ง · คลิก ' + number(session.click_count) + ' ครั้ง</small>'
      + (session.last_click ? '<small class="last-click">คลิกล่าสุด: ' + escapeHtml(session.last_click) + '</small>' : '')
      + '</td><td>' + start.date + '</td><td class="mono">' + start.time
      + '</td><td class="mono">' + (session.ended_at ? dateParts(session.ended_at).time : '—') + '</td><td>' + duration(session.duration_seconds)
      + '</td><td>' + escapeHtml(locationName(session)) + '<small class="sub-cell">โดยประมาณจากเครือข่าย</small></td><td>'
      + escapeHtml([session.browser, session.os, session.device].filter(Boolean).join(' / ') || 'ข้อมูลเดิม') + '<small class="sub-cell">'
      + escapeHtml(session.screen || '—') + '</small></td><td>' + escapeHtml(session.source || 'ข้อมูลเดิม / ไม่ทราบ') + '</td><td class="path-cell">'
      + escapeHtml(session.path) + '<small class="sub-cell">' + number(session.page_views) + ' หน้า · '
      + (session.max_scroll == null ? 'ยังไม่มีข้อมูลเลื่อน' : 'เลื่อน ' + session.max_scroll + '%') + '</small></td></tr>';
  }).join('');
  breakdown(el.sourcesList, data.sources || []);
  breakdown(el.browsersList, data.browsers || []);
  breakdown(el.osList, data.os || []);
  breakdown(el.devicesList, data.devices || []);
  breakdown(el.interactionsList, data.interactions || [], (item) => (item.type === 'project_open' ? 'เปิดผลงาน · ' : 'คลิก · ') + (item.label || 'ไม่มีชื่อ'));
  const scroll = data.scroll || [];
  const totalPages = (data.content || []).filter((item) => item.kind === 'page').reduce((sum, item) => sum + item.views, 0);
  el.scrollStats.innerHTML = [25, 50, 75, 100].map((milestone) => {
    const item = scroll.find((row) => row.milestone === milestone);
    const reached = item?.reached || 0;
    const total = item?.total || totalPages;
    const percent = total ? Math.round(reached / total * 100) : 0;
    return '<article><span>เลื่อนถึง ' + milestone + '%</span><strong>' + number(reached) + ' ครั้ง</strong><small>'
      + percent + '% ของการเปิดหน้า</small><div class="bar-track"><i style="width:' + percent + '%"></i></div></article>';
  }).join('');
  el.contentRows.innerHTML = (data.content || []).map((item) => '<tr><td class="content-title">' + escapeHtml(item.title)
    + '<small class="sub-cell">' + escapeHtml(item.path) + '</small></td><td>' + kinds[item.kind] + '</td><td>'
    + number(item.views) + '</td><td>' + duration(item.active_seconds) + '</td><td>' + duration(item.average_seconds) + '</td></tr>').join('')
    || '<tr><td colspan="5" class="no-data">ข้อมูลรายละเอียดจะเริ่มบันทึกหลังอัปเดตนี้</td></tr>';
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, cache: 'no-store', headers: { Authorization: 'Bearer ' + state.token,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  if (response.status === 401) { clearLogin(); throw new Error('รหัสผ่านไม่ถูกต้องหรือเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่'); }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const error = new Error(detail.message || (response.status === 503 ? 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' : 'ทำรายการไม่สำเร็จ กรุณาลองใหม่'));
    error.code = detail.code;
    throw error;
  }
  return response.json();
}
async function loadData() {
  if (!state.token || state.busy) return;
  const generation = state.generation;
  state.busy = true;
  el.refreshButton.classList.add('spinning');
  try {
    const data = await api('/api/sessions?range=' + encodeURIComponent(el.rangeSelect.value) + '&limit=200');
    if (generation !== state.generation) return;
    storage.set(TOKEN_KEY, state.token);
    el.token.value = '';
    el.loginShell.hidden = true;
    el.dashboard.hidden = false;
    el.loginError.textContent = '';
    el.dashboardMessage.textContent = '';
    render(data);
    if (state.detail && el.sessionDialog.open) await loadDetail(state.detail, false);
  } catch (error) {
    (el.dashboard.hidden ? el.loginError : el.dashboardMessage).textContent = error.message;
  } finally {
    state.busy = false;
    el.refreshButton.classList.remove('spinning');
    window.clearTimeout(state.timer);
    if (state.token) state.timer = window.setTimeout(loadData, 15_000);
  }
}
function clearLogin() {
  state.generation++; state.token = ''; state.detail = null;
  storage.remove(TOKEN_KEY);
  window.clearTimeout(state.timer);
  el.sessionDialog.close();
  el.detailContent.replaceChildren(); el.sessionRows.replaceChildren();
  el.dashboard.hidden = true; el.loginShell.hidden = false;
  el.token.value = ''; el.loginError.textContent = '';
}
async function loadDetail(id, show = true) {
  if (show) {
    state.detail = id;
    el.detailContent.textContent = 'กำลังโหลด…';
    if (!el.sessionDialog.open) el.sessionDialog.showModal();
  }
  try {
    const data = await api('/api/sessions/' + encodeURIComponent(id));
    if (state.detail !== id || !el.sessionDialog.open) return;
    const s = data.session;
    const visitor = s.visitor_id ? s.visitor_id.slice(0, 8) + '…' : 'ไม่เก็บรหัสถาวร / ข้อมูลเดิม';
    const start = dateParts(s.started_at);
    let html = '<div class="detail-summary"><p>เข้า ' + start.date + ' ' + start.time + ' · ' + duration(s.duration_seconds)
      + '</p><p>' + escapeHtml([s.browser, s.os, s.device].filter(Boolean).join(' / ')) + '</p><p>แหล่งที่มา: '
      + escapeHtml(s.source || 'ข้อมูลเดิม / ไม่ทราบ') + '</p><p>ตำแหน่งประมาณ: ' + escapeHtml(locationName(s))
      + '</p><p class="panel-note">เมือง/ภูมิภาคอาจคลาดเคลื่อนจาก VPN หรือเครือข่ายมือถือ ไม่ใช่ GPS หรือที่อยู่จริง</p>'
      + '<p>ผู้ชม: ' + escapeHtml(visitorTypes[s.visitor_type] || 'ข้อมูลเดิม') + ' · รหัสสุ่ม ' + escapeHtml(visitor) + '</p></div>'
      + '<p>เปิดผลงาน ' + number(s.project_count) + ' ครั้ง · คลิกปุ่ม/ลิงก์ ' + number(s.click_count) + ' ครั้ง</p>'
      + '<h3>สิ่งที่เปิดดูและเวลาที่ใช้งาน</h3><div class="table-wrap"><table><thead><tr><th>เริ่มดู</th><th>เนื้อหา</th><th>ประเภท</th><th>เวลาใช้งาน</th><th>เลื่อนลึกสุด</th></tr></thead><tbody>';
    html += data.views.map((v) => '<tr><td class="mono">' + dateParts(v.started_at).time + '</td><td class="content-title">'
      + escapeHtml(v.title) + '</td><td>' + kinds[v.kind] + '</td><td>' + duration(v.active_seconds) + '</td><td>'
      + (v.kind === 'page' ? v.max_scroll + '%' : '—') + '</td></tr>').join('') || '<tr><td colspan="5">ไม่มีรายละเอียดก่อนอัปเดต</td></tr>';
    html += '</tbody></table></div><h3>ลำดับการคลิกและการเลื่อน</h3><ol class="timeline">';
    html += data.events.map((e) => '<li><time>' + dateParts(e.occurred_at).time + '</time><div><strong>'
      + escapeHtml(e.label || e.type) + '</strong>' + (e.target ? '<small>' + escapeHtml(e.target) + '</small>' : '') + '</div></li>').join('')
      || '<li>ยังไม่มีการคลิกหรือเลื่อนที่บันทึกไว้</li>';
    el.detailContent.innerHTML = html + '</ol>' + (data.truncated ? '<p>แสดง 500 เหตุการณ์แรก</p>' : '');
  } catch (error) { el.detailContent.textContent = error.message; }
}
// Retire subscriptions and the old notification worker when this browser next visits.
async function retireNotifications() {
  storage.remove('portfolio_push_key');
  if (!('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      const worker = reg.active || reg.waiting || reg.installing;
      if (!worker || new URL(worker.scriptURL).origin !== location.origin
        || new URL(worker.scriptURL).pathname !== '/sw.js') continue;
      try { const sub = await reg.pushManager?.getSubscription(); if (sub) await sub.unsubscribe(); } catch { /* Sending is already disabled server-side. */ }
      try {
        const notifications = await reg.getNotifications();
        notifications.forEach((notification) => notification.close());
      } catch { /* Still unregister when closing notifications is unavailable. */ }
      await reg.unregister();
    }
  } catch { /* Cleanup must never block the dashboard. */ }
}
retireNotifications();
el.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  state.token = el.token.value.trim();
  await loadData();
});
el.rangeSelect.addEventListener('change', loadData);
el.refreshButton.addEventListener('click', loadData);
el.logoutButton.addEventListener('click', clearLogin);
el.sessionRows.addEventListener('click', (event) => {
  const button = event.target.closest('[data-session]');
  if (button) loadDetail(button.dataset.session);
});
el.closeDetail.addEventListener('click', () => el.sessionDialog.close());
el.sessionDialog.addEventListener('close', () => { state.detail = null; });
if (state.token) {
  loadData().then(() => {
    if (!el.dashboard.hidden) {
      const initial = new URL(location.href).searchParams.get('session');
      if (initial && /^[a-zA-Z0-9-]{16,80}$/.test(initial)) loadDetail(initial);
    }
  });
}
