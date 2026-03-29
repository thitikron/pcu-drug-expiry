/**
 * Auth.gs – Login / Session / Logs
 */

function actionLogin(body) {
  const { username, password } = body;
  if (!username || !password) throw new Error('กรุณากรอก Username และ Password');

  const user = _find('PCU_USERS','username', username.trim());
  if (!user || user.is_active != 1) throw new Error('ไม่พบ Username นี้ในระบบ');
  if (user.password_hash !== sha256(password)) throw new Error('Password ไม่ถูกต้อง');

  const pcu = _find('PCU_LIST','id', user.pcu_id);
  if (!pcu || pcu.is_active != 1) throw new Error('ไม่พบ รพ.สต. ที่สังกัด');

  // สร้าง token
  const token = uid() + uid();
  const exp   = new Date(Date.now() + CFG.SESSION_HOURS * 3600000);
  const expStr = Utilities.formatDate(exp,'Asia/Bangkok','yyyy-MM-dd HH:mm:ss');
  _append('SESSIONS',[token, user.id, user.pcu_id, pcu.pcu_name,
                      user.display_name, user.role, expStr]);
  _update('PCU_USERS', user.id, { last_login: now() });

  writeLog(
    { pcu_id: user.pcu_id, pcu_name: pcu.pcu_name,
      display_name: user.display_name },
    'login', 'เข้าสู่ระบบ'
  );

  return {
    token,
    role:         user.role,
    display_name: user.display_name,
    pcu_name:     pcu.pcu_name,
    pcu_code:     pcu.pcu_code,
    pcu_id:       user.pcu_id,
  };
}

function checkSession(token) {
  if (!token) return null;
  const s = _find('SESSIONS','token', token);
  if (!s) return null;
  if (new Date(s.expires_at) < new Date()) return null;
  return s;
}

function actionLogout(token) {
  _update('SESSIONS', token, { expires_at: '2000-01-01 00:00:00' });
  return { ok: true };
}

// ── LOGS ──────────────────────────────────────
function writeLog(sess, action, detail) {
  try {
    _append('LOGS',[uid(), now(),
      sess.pcu_id   || '',
      sess.pcu_name || '',
      sess.display_name || sess.username || '',
      action, (detail||'').substring(0,300)
    ]);
  } catch(e) { Logger.log('Log error: '+e); }
}

function adminGetLogs(body, sess) {
  if (!['admin','superadmin'].includes(sess.role)) throw new Error('ไม่มีสิทธิ์');
  let logs = _rows('LOGS').reverse(); // ล่าสุดก่อน
  if (body.pcu_id) logs = logs.filter(l => l.pcu_id === body.pcu_id);
  if (body.limit)  logs = logs.slice(0, parseInt(body.limit));
  else             logs = logs.slice(0, 100);
  return logs;
}
