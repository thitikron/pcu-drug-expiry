/**
 * ══════════════════════════════════════════════
 * PCU Drug Expiry System – Google Apps Script
 * Backend API + Database (Google Sheets)
 * รพ.แม่แตง
 * ══════════════════════════════════════════════
 */

// ── CONFIG ────────────────────────────────────
const CFG = {
  // Sheet ID ที่เก็บ DB ของระบบ (ว่างไว้ = สร้างอัตโนมัติ)
  DB_SHEET_ID: '',

  // Sheet ยา/วัคซีน ของ รพ. (Read-Only)
  REF_SHEET_ID: '1s1lLGVusOknCfRsPXqTjieLCnv4SnCED6nrQa-2T1vE',

  HOSPITAL_NAME: 'รพ.แม่แตง',
  LOGO_URL:      'https://www.maetaeng.go.th/assets/3-DPQvDzlj.png',

  // MOPH Notify – กลุ่ม รพ.สต.
  LINE_CLIENT_KEY: '534c582c6f40bcaaa1ffe8a7685d4a5bd7ec7c8a',
  LINE_SECRET_KEY: 'HZOKTJYRCDUMVQRZ7VZ2ABJ3QWSA',
  MOPH_URL:        'https://morpromt2f.moph.go.th/api/notify/send',

  NOTIFY_DAYS:   [7, 30, 90, 180],
  SESSION_HOURS: 8,

  // GitHub Pages URL (แก้หลัง deploy)
  WEB_URL: 'https://YOUR_GITHUB_USERNAME.github.io/pcu-drug-expiry',
};

// ── CORS Headers ──────────────────────────────
function setCORS(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON);
}

// ── MAIN ENTRY ────────────────────────────────
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || '';
    const token  = body.token  || '';

    // Public actions (no auth)
    if (action === 'login')   return res(actionLogin(body));
    if (action === 'setup')   return res(actionSetup());
    if (action === 'getRef')  return res(actionGetRef(body));

    // Auth required
    const sess = checkSession(token);
    if (!sess) return resErr('กรุณาเข้าสู่ระบบใหม่');

    // Log every action
    writeLog(sess, action, JSON.stringify(body).substring(0, 200));

    const h = {
      'logout':         () => actionLogout(token),
      'getStats':       () => actionGetStats(sess),
      'getItems':       () => actionGetItems(body, sess),
      'getItem':        () => actionGetItem(body, sess),
      'saveItem':       () => actionSaveItem(body, sess),
      'deleteItem':     () => actionDeleteItem(body, sess),
      'getReport':      () => actionGetReport(body, sess),
      // Exchange
      'saveExchange':   () => actionSaveExchange(body, sess),
      'getExchanges':   () => actionGetExchanges(body, sess),
      'approveExchange':() => actionApproveExchange(body, sess),
      // Admin
      'getPcuList':     () => adminGetPcuList(sess),
      'savePcu':        () => adminSavePcu(body, sess),
      'deletePcu':      () => adminDeletePcu(body, sess),
      'getUsers':       () => adminGetUsers(sess),
      'saveUser':       () => adminSaveUser(body, sess),
      'deleteUser':     () => adminDeleteUser(body, sess),
      'getLogs':        () => adminGetLogs(body, sess),
      'sendTestNotify': () => actionSendTest(sess),
    };

    if (h[action]) return res(h[action]());
    return resErr('Unknown action: ' + action);

  } catch(err) {
    Logger.log('ERROR: ' + err.stack);
    return resErr(err.message);
  }
}

function doGet(e) {
  // Health check
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, system: 'PCU Drug Expiry', time: new Date().toISOString() })
  ).setMimeType(ContentService.MimeType.JSON);
}

function res(data) {
  return setCORS(ContentService.createTextOutput(
    JSON.stringify({ ok: true, data })
  ));
}
function resErr(msg) {
  return setCORS(ContentService.createTextOutput(
    JSON.stringify({ ok: false, error: msg })
  ));
}
