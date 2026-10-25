const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
const TOKEN_STORAGE_KEY = 'portfolio_admin_token';
const state = { token: localStorage.getItem(TOKEN_STORAGE_KEY) || '', timer: null };

const elements = {
  loginShell: document.querySelector('#loginShell'),
  dashboard: document.querySelector('#dashboard'),
  loginForm: document.querySelector('#loginForm'),
  loginError: document.querySelector('#loginError'),
  token: document.querySelector('#token'),
  range: document.querySelector('#rangeSelect'),
  refresh: document.querySelector('#refreshButton'),
  logout: document.querySelector('#logoutButton'),
  updated: document.querySelector('#lastUpdated'),
  active: document.querySelector('#activeStat'),
  today: document.querySelector('#todayStat'),
  total: document.querySelector('#totalStat'),
  average: document.querySelector('#averageStat'),
  count: document.querySelector('#resultCount'),
  rows: document.querySelector('#sessionRows'),
  empty: document.querySelector('#emptyState'),
  table: document.querySelector('#tableWrap'),
};

function dateParts(value) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: BANGKOK_TIME_ZONE }).format(date),
    time: new Intl.DateTimeFormat('th-TH', { timeStyle: 'medium', hour12: false, timeZone: BANGKOK_TIME_ZONE }).format(date),
  };
}

function duration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  if (seconds < 60) return `${seconds} วินาที`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60) return `${minutes} นาที ${remainder} วิ`;
  return `${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`;
}

function deviceName(userAgent = '') {
  if (/ipad|tablet/i.test(userAgent)) return 'Tablet';
  if (/mobile|iphone|android/i.test(userAgent)) return 'Mobile';
  return 'Desktop';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function render(data) {
  const summary = data.summary || {};
  const sessions = data.sessions || [];
  elements.active.textContent = Number(summary.active || 0).toLocaleString('th-TH');
  elements.today.textContent = Number(summary.today || 0).toLocaleString('th-TH');
  elements.total.textContent = Number(summary.total || 0).toLocaleString('th-TH');
  elements.average.textContent = duration(summary.avg_duration || 0);
  elements.count.textContent = `${sessions.length.toLocaleString('th-TH')} รายการ`;
  elements.updated.textContent = `อัปเดตล่าสุด ${dateParts(data.generatedAt).time} น.`;
  elements.empty.hidden = sessions.length > 0;
  elements.table.hidden = sessions.length === 0;

  elements.rows.innerHTML = sessions.map((session) => {
    const started = dateParts(session.started_at);
    const ended = session.ended_at ? dateParts(session.ended_at).time : '—';
    const active = session.status === 'active';
    return `<tr>
      <td><span class="status ${active ? 'online' : ''}"><i></i>${active ? 'ออนไลน์' : 'สิ้นสุดแล้ว'}</span></td>
      <td>${started.date}</td>
      <td class="mono">${started.time}</td>
      <td class="mono">${ended}</td>
      <td>${duration(session.duration_seconds)}</td>
      <td>${escapeHtml(session.country || 'ไม่ทราบ')}</td>
      <td>${deviceName(session.user_agent)}<small class="sub-cell">${escapeHtml(session.screen || '—')}</small></td>
      <td class="path-cell" title="${escapeHtml(session.path)}">${escapeHtml(session.path)}</td>
    </tr>`;
  }).join('');
}

async function loadData(showError = true) {
  if (!state.token) return;
  elements.refresh.classList.add('spinning');
  try {
    const response = await fetch(`/api/sessions?range=${encodeURIComponent(elements.range.value)}&limit=200`, {
      headers: { Authorization: `Bearer ${state.token}` },
      cache: 'no-store',
    });
    if (response.status === 401) throw new Error('รหัสผ่านไม่ถูกต้อง');
    if (!response.ok) throw new Error('ไม่สามารถโหลดข้อมูลได้');
    const data = await response.json();
    localStorage.setItem(TOKEN_STORAGE_KEY, state.token);
    elements.loginShell.hidden = true;
    elements.dashboard.hidden = false;
    elements.loginError.textContent = '';
    render(data);
    window.clearInterval(state.timer);
    state.timer = window.setInterval(() => loadData(false), 15_000);
  } catch (error) {
    if (showError) elements.loginError.textContent = error.message;
    if (error.message.includes('รหัสผ่าน')) logout(false);
  } finally {
    elements.refresh.classList.remove('spinning');
  }
}

function logout(clearError = true) {
  state.token = '';
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.clearInterval(state.timer);
  elements.dashboard.hidden = true;
  elements.loginShell.hidden = false;
  elements.token.value = '';
  if (clearError) elements.loginError.textContent = '';
  elements.token.focus();
}

elements.loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  state.token = elements.token.value.trim();
  loadData(true);
});
elements.range.addEventListener('change', () => loadData(true));
elements.refresh.addEventListener('click', () => loadData(true));
elements.logout.addEventListener('click', () => logout());

if (state.token) loadData(false);
