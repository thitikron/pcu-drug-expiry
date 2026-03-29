/**
 * Database.gs – Google Sheets CRUD
 * Fix: preserve leading zeros in pcu_code
 * Fix: ensure data saves correctly to sheet
 */

// ── Helpers ───────────────────────────────────
function uid()  { return Utilities.getUuid().replace(/-/g,'').slice(0,16); }
function now()  { return Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd HH:mm:ss'); }
function today(){ return Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd'); }
function sha256(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0'+(b&0xFF).toString(16)).slice(-2)).join('');
}

// ── Spreadsheet ───────────────────────────────
function getDB() {
  const p = PropertiesService.getScriptProperties();
  let id  = CFG.DB_SHEET_ID || p.getProperty('DB_ID');
  if (!id) {
    const ss = SpreadsheetApp.create('PCU Drug Expiry DB – ' + CFG.HOSPITAL_NAME);
    id = ss.getId();
    p.setProperty('DB_ID', id);
    _initSheets(ss);
    return ss;
  }
  return SpreadsheetApp.openById(id);
}

function sheet(name) {
  const ss = getDB();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function _initSheets(ss) {
  const defs = {
    PCU_LIST:    ['id','pcu_code','pcu_name','phone','address','is_active','created_at'],
    PCU_USERS:   ['id','pcu_id','username','password_hash','display_name','role','last_login','is_active','created_at'],
    DRUG_EXPIRY: ['id','pcu_id','item_type','drug_code','drug_name','dosage_form',
                  'vaccine_group','lot_number','expiry_date','quantity','unit',
                  'notes','notified_days','created_by','is_active','created_at','updated_at'],
    EXCHANGES:   ['id','drug_id','pcu_id','drug_name','days_to_expiry','ratio',
                  'quantity','requested_by','status','approved_by','note','created_at','updated_at'],
    SESSIONS:    ['token','user_id','pcu_id','pcu_name','display_name','role','expires_at'],
    LOGS:        ['id','timestamp','pcu_id','pcu_name','username','action','detail'],
  };
  for (const [name, cols] of Object.entries(defs)) {
    let sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(cols);
      sh.getRange(1,1,1,cols.length)
        .setBackground('#1e40af').setFontColor('#fff').setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  }
  // Format pcu_code column as text to preserve leading zeros
  const pcuSh = ss.getSheetByName('PCU_LIST');
  if (pcuSh) pcuSh.getRange('B:B').setNumberFormat('@');

  const def = ss.getSheetByName('Sheet1');
  if (def) try { ss.deleteSheet(def); } catch(e){}

  // Admin PCU + User เริ่มต้น
  const pcuId  = uid();
  const userId = uid();
  _appendText('PCU_LIST',  [pcuId,'ADMIN',CFG.HOSPITAL_NAME,'','',1,now()]);
  _append('PCU_USERS', [userId,pcuId,'admin',sha256('admin1234'),
                        'ผู้ดูแลระบบ','superadmin','',1,now()]);
}

function actionSetup() {
  const ss = getDB();
  // Ensure pcu_code column is text format
  const pcuSh = ss.getSheetByName('PCU_LIST');
  if (pcuSh) pcuSh.getRange('B:B').setNumberFormat('@');
  return {
    message:  'Setup complete',
    db_url:   ss.getUrl(),
    db_id:    ss.getId(),
    web_url:  CFG.WEB_URL,
  };
}

// ── CRUD ──────────────────────────────────────
function _rows(sheetName) {
  const sh   = sheet(sheetName);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const h = data[0];
  return data.slice(1).map(r => {
    const o = {};
    h.forEach((k,i) => { o[k] = (r[i] === null || r[i] === undefined) ? '' : String(r[i]); });
    return o;
  });
}

function _find(sheetName, field, val) {
  return _rows(sheetName).find(r => String(r[field]) === String(val)) || null;
}

// _append: ใช้สำหรับข้อมูลทั่วไป
function _append(sheetName, values) {
  sheet(sheetName).appendRow(values);
}

// _appendText: ใช้เมื่อต้องการเก็บ text (เช่น pcu_code ที่มี leading zero)
function _appendText(sheetName, values) {
  const sh  = sheet(sheetName);
  const row = sh.getLastRow() + 1;
  const r   = sh.getRange(row, 1, 1, values.length);
  // ตั้ง format เป็น text ก่อน แล้วค่อยใส่ค่า
  r.setNumberFormat('@');
  r.setValues([values.map(v => v === null || v === undefined ? '' : String(v))]);
}

function _update(sheetName, idVal, updates) {
  const sh   = sheet(sheetName);
  const data = sh.getDataRange().getValues();
  const h    = data[0];
  const idC  = h.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idC]) === String(idVal)) {
      for (const [k,v] of Object.entries(updates)) {
        const c = h.indexOf(k);
        if (c >= 0) {
          const cell = sh.getRange(i+1, c+1);
          // ถ้าเป็น pcu_code ให้ format เป็น text
          if (k === 'pcu_code') {
            cell.setNumberFormat('@');
            cell.setValue(String(v));
          } else {
            cell.setValue(v === null || v === undefined ? '' : v);
          }
        }
      }
      return true;
    }
  }
  return false;
}

function _query(sheetName, fn) {
  return _rows(sheetName).filter(fn);
}
