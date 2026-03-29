/**
 * api.js – API helper + session management
 */
const SESSION_KEY = 'pcu_session';

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
  catch(e) { return null; }
}
function setSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
function requireAuth() {
  const s = getSession();
  if (!s || !s.token) { window.location.href = 'index.html'; return null; }
  return s;
}
function requireAdmin() {
  const s = requireAuth();
  if (!s) return null;
  if (!['admin','superadmin'].includes(s.role)) {
    window.location.href = 'dashboard.html'; return null;
  }
  return s;
}

async function api(action, data = {}) {
  const sess = getSession();
  const body = { action, ...data, token: sess ? sess.token : '' };
  try {
    const r = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const json = await r.json();
    if (json.error === 'กรุณาเข้าสู่ระบบใหม่') {
      clearSession();
      window.location.href = 'index.html';
      return null;
    }
    return json;
  } catch(e) {
    console.error('API Error:', e);
    return { ok: false, error: e.message };
  }
}

// ── Utilities ─────────────────────────────────
function thaiDate(str) {
  if (!str) return '-';
  const m = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
             'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const d = new Date(str);
  return d.getDate()+' '+m[d.getMonth()+1]+' '+(d.getFullYear()+543);
}

function daysLeft(expStr) {
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.ceil((new Date(expStr) - t) / 86400000);
}

function statusBadge(d) {
  if (d < 0)    return `<span class="badge expired">หมดอายุแล้ว</span>`;
  if (d === 0)  return `<span class="badge expired">หมดวันนี้!</span>`;
  if (d <= 7)   return `<span class="badge w1">🚨 อีก ${d} วัน</span>`;
  if (d <= 30)  return `<span class="badge m1">🔴 อีก ${d} วัน</span>`;
  if (d <= 90)  return `<span class="badge m3">🟠 อีก ${d} วัน</span>`;
  if (d <= 180) return `<span class="badge m6">🟡 อีก ${d} วัน</span>`;
  return `<span class="badge ok">✅ อีก ${d} วัน</span>`;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s||'');
  return d.innerHTML;
}

function toast(msg, type='ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = (type==='ok'?'✅ ':type==='err'?'❌ ':'⚠️ ') + msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showLoader(show) {
  const el = document.getElementById('loader');
  if (el) el.style.display = show ? 'flex' : 'none';
}
