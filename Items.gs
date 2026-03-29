/**
 * Items.gs – Drug/Vaccine CRUD + Admin
 * Fix: adminSavePcu uses _appendText to preserve leading zeros
 */

// ── Stats ──────────────────────────────────────
function actionGetStats(sess) {
  const t    = today();
  const dL   = e => Math.ceil((new Date(e)-new Date(t))/86400000);
  const all  = _query('DRUG_EXPIRY', r =>
    r.is_active == 1 && r.pcu_id === sess.pcu_id);
  return {
    total:   all.length,
    drug:    all.filter(r=>r.item_type==='drug').length,
    vaccine: all.filter(r=>r.item_type==='vaccine').length,
    expired: all.filter(r=>dL(r.expiry_date)<0).length,
    d7:      all.filter(r=>{const d=dL(r.expiry_date);return d>=0&&d<=7}).length,
    d30:     all.filter(r=>{const d=dL(r.expiry_date);return d>=0&&d<=30}).length,
    d90:     all.filter(r=>{const d=dL(r.expiry_date);return d>=0&&d<=90}).length,
    d180:    all.filter(r=>{const d=dL(r.expiry_date);return d>=0&&d<=180}).length,
  };
}

function actionGetItems(body, sess) {
  const { filter='all', type='drug', q='' } = body;
  const t  = today();
  const dL = e => Math.ceil((new Date(e)-new Date(t))/86400000);

  let rows = _query('DRUG_EXPIRY', r =>
    r.is_active == 1 && r.pcu_id === sess.pcu_id && r.item_type === type);

  if (filter==='expired') rows=rows.filter(r=>dL(r.expiry_date)<0);
  else if(filter==='w1')  rows=rows.filter(r=>{const d=dL(r.expiry_date);return d>=0&&d<=7});
  else if(filter==='m1')  rows=rows.filter(r=>{const d=dL(r.expiry_date);return d>=0&&d<=30});
  else if(filter==='m3')  rows=rows.filter(r=>{const d=dL(r.expiry_date);return d>=0&&d<=90});
  else if(filter==='m6')  rows=rows.filter(r=>{const d=dL(r.expiry_date);return d>=0&&d<=180});

  if (q) {
    const ql = q.toLowerCase();
    rows = rows.filter(r =>
      r.drug_name.toLowerCase().includes(ql) ||
      (r.lot_number||'').toLowerCase().includes(ql));
  }

  return rows
    .map(r => ({ ...r, days_left: dL(r.expiry_date) }))
    .sort((a,b) => new Date(a.expiry_date)-new Date(b.expiry_date));
}

function actionGetItem(body, sess) {
  const r = _find('DRUG_EXPIRY','id', body.id);
  if (!r || r.pcu_id !== sess.pcu_id) throw new Error('ไม่พบข้อมูล');
  return r;
}

function actionSaveItem(body, sess) {
  const { id, item_type, drug_code, drug_name, dosage_form,
          vaccine_group, lot_number, expiry_date, quantity, unit, notes } = body;
  if (!drug_name)   throw new Error('กรุณาระบุชื่อ');
  if (!expiry_date) throw new Error('กรุณาระบุวันหมดอายุ');
  if (item_type==='drug' && !dosage_form)   throw new Error('กรุณาเลือกรูปแบบยา');
  if (item_type==='vaccine' && !vaccine_group) throw new Error('กรุณาเลือกกลุ่มวัคซีน');

  if (id) {
    _update('DRUG_EXPIRY', id, {
      item_type, drug_code, drug_name, dosage_form, vaccine_group,
      lot_number, expiry_date, quantity: quantity||'', unit: unit||'',
      notes, notified_days:'', updated_at: now()
    });
    writeLog(sess,'edit_item', drug_name);
    return { message: 'แก้ไขรายการสำเร็จ' };
  } else {
    _append('DRUG_EXPIRY',[
      uid(), sess.pcu_id, item_type||'drug',
      drug_code||'', drug_name,
      dosage_form||'', vaccine_group||'',
      lot_number||'', expiry_date,
      quantity||'', unit||'', notes||'',
      '', sess.display_name, 1, now(), now()
    ]);
    writeLog(sess,'add_item', drug_name);
    return { message: 'เพิ่มรายการสำเร็จ' };
  }
}

function actionDeleteItem(body, sess) {
  const r = _find('DRUG_EXPIRY','id', body.id);
  if (!r || r.pcu_id !== sess.pcu_id) throw new Error('ไม่พบข้อมูล');
  _update('DRUG_EXPIRY', body.id, { is_active: 0 });
  writeLog(sess,'delete_item', r.drug_name);
  return { message: 'ลบสำเร็จ' };
}

function actionGetReport(body, sess) {
  const { period='180', type='all' } = body;
  const t    = today();
  const days = parseInt(period);
  const dL   = e => Math.ceil((new Date(e)-new Date(t))/86400000);
  let rows = _query('DRUG_EXPIRY', r => {
    if (r.is_active!=1 || r.pcu_id!==sess.pcu_id) return false;
    const d = dL(r.expiry_date);
    return d>=0 && d<=days;
  });
  if (type!=='all') rows = rows.filter(r=>r.item_type===type);
  return rows
    .map(r => ({ ...r, days_left: dL(r.expiry_date) }))
    .sort((a,b) => new Date(a.expiry_date)-new Date(b.expiry_date));
}

// ── Exchange ──────────────────────────────────
function actionSaveExchange(body, sess) {
  const { drug_id, quantity, note } = body;
  const drug = _find('DRUG_EXPIRY','id', drug_id);
  if (!drug || drug.pcu_id !== sess.pcu_id) throw new Error('ไม่พบรายการยา');
  const t    = today();
  const days = Math.ceil((new Date(drug.expiry_date)-new Date(t))/86400000);
  if (days > 180) throw new Error('ยานี้ยังไม่ถึงเกณฑ์แลก (ต้องเหลือ ≤ 180 วัน)');
  const ratio = days <= 90 ? 50 : 100;
  _append('EXCHANGES',[
    uid(), drug_id, sess.pcu_id, drug.drug_name,
    days, ratio, quantity||1,
    sess.display_name, 'pending', '', note||'',
    now(), now()
  ]);
  sendExchangeNotify(sess, drug, days, ratio, quantity||1);
  writeLog(sess,'exchange_request', drug.drug_name);
  return { message: `ส่งคำขอแลกยาสำเร็จ (${ratio}%)` };
}

function actionGetExchanges(body, sess) {
  let rows = _query('EXCHANGES', r => r.pcu_id === sess.pcu_id);
  if (body.status) rows = rows.filter(r=>r.status===body.status);
  return rows.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
}

function actionApproveExchange(body, sess) {
  if (!['admin','superadmin'].includes(sess.role)) throw new Error('ไม่มีสิทธิ์');
  _update('EXCHANGES', body.id, {
    status: body.status,
    approved_by: sess.display_name,
    updated_at: now()
  });
  writeLog(sess,'approve_exchange', body.id+' -> '+body.status);
  return { message: 'อัปเดตสถานะสำเร็จ' };
}

// ── Reference data ────────────────────────────
function actionGetRef(body) {
  const type  = body.type || 'dosageforms';
  const cache = CacheService.getScriptCache();

  if (type === 'dosageforms') {
    const k = 'ref_dosage';
    const c = cache.get(k);
    if (c) return JSON.parse(c);
    try {
      const ss   = SpreadsheetApp.openById(CFG.REF_SHEET_ID);
      const sh   = ss.getSheetByName('ยา');
      const data = sh.getDataRange().getValues();
      const forms= [...new Set(data.slice(1).filter(r=>r[1]).map(r=>String(r[1]).trim()))].sort();
      cache.put(k, JSON.stringify(forms), 21600);
      return forms;
    } catch(e) {
      return ['TABLETS','CAPSULES','SYRUPS','INJECTIONS','SOLUTIONS','SUSPENSIONS','อื่นๆ'];
    }
  }

  if (type === 'drugs') {
    try {
      const ss   = SpreadsheetApp.openById(CFG.REF_SHEET_ID);
      const sh   = ss.getSheetByName('ยา');
      const data = sh.getDataRange().getValues();
      const q    = (body.q||'').toLowerCase();
      const df   = body.dosage_form || '';
      let rows   = data.slice(1).filter(r=>r[0]&&r[1]&&r[2]);
      if (df) rows = rows.filter(r => String(r[1]).trim() === df);
      if (q)  rows = rows.filter(r =>
        String(r[2]).toLowerCase().includes(q) || String(r[0]).includes(q));
      return rows.slice(0,30).map(r=>({
        drug_code:   String(r[0]).trim(),
        dosage_form: String(r[1]).trim(),
        drug_name:   String(r[2]).trim(),
      }));
    } catch(e) { return []; }
  }

  if (type === 'vacc_groups') {
    const k = 'ref_vgrps';
    const c = cache.get(k);
    if (c) return JSON.parse(c);
    try {
      const ss   = SpreadsheetApp.openById(CFG.REF_SHEET_ID);
      const sh   = ss.getSheetByName('วัคซีน');
      const data = sh.getDataRange().getValues();
      const grps = [...new Set(data.slice(1).filter(r=>r[0]).map(r=>String(r[0]).trim()))].sort();
      cache.put(k, JSON.stringify(grps), 21600);
      return grps;
    } catch(e) { return []; }
  }

  if (type === 'vacc_names') {
    const g = body.group || '';
    try {
      const ss   = SpreadsheetApp.openById(CFG.REF_SHEET_ID);
      const sh   = ss.getSheetByName('วัคซีน');
      const data = sh.getDataRange().getValues();
      const q    = (body.q||'').toLowerCase();
      let rows   = data.slice(1).filter(r=>r[0]&&r[1]&&String(r[0]).trim()===g);
      if (q) rows = rows.filter(r=>String(r[1]).toLowerCase().includes(q));
      return rows.map(r=>String(r[1]).trim());
    } catch(e) { return []; }
  }

  return [];
}

// ── Admin ─────────────────────────────────────
function _requireAdmin(sess) {
  if (!['admin','superadmin'].includes(sess.role))
    throw new Error('เฉพาะ Admin เท่านั้น');
}

function adminGetPcuList(sess) {
  _requireAdmin(sess);
  return _query('PCU_LIST', r=>r.is_active==1 && r.pcu_code!=='ADMIN');
}

function adminSavePcu(body, sess) {
  _requireAdmin(sess);
  // ── FIX: เก็บ pcu_code เป็น String เพื่อรักษา leading zeros ──
  const id      = body.id || '';
  const pcu_code= String(body.pcu_code || '').trim();
  const pcu_name= String(body.pcu_name || '').trim();
  const phone   = String(body.phone   || '').trim();
  const address = String(body.address || '').trim();

  if (!pcu_code || !pcu_name) throw new Error('กรุณากรอกรหัสและชื่อ รพ.สต.');

  if (id) {
    // อัปเดตพร้อมรักษา leading zeros
    const sh   = sheet('PCU_LIST');
    const data = sh.getDataRange().getValues();
    const h    = data[0];
    const idC  = h.indexOf('id');
    const codeC= h.indexOf('pcu_code');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idC]) === id) {
        // ตั้ง format text ก่อน
        sh.getRange(i+1, codeC+1).setNumberFormat('@').setValue(pcu_code);
        // อัปเดต fields อื่น
        const nameC = h.indexOf('pcu_name');
        const phC   = h.indexOf('phone');
        const adC   = h.indexOf('address');
        if (nameC>=0) sh.getRange(i+1,nameC+1).setValue(pcu_name);
        if (phC>=0)   sh.getRange(i+1,phC+1).setValue(phone);
        if (adC>=0)   sh.getRange(i+1,adC+1).setValue(address);
        break;
      }
    }
    writeLog(sess,'edit_pcu', pcu_name);
    return { message: 'แก้ไข รพ.สต. สำเร็จ' };
  } else {
    // INSERT ใหม่ – ใช้ _appendText เพื่อรักษา leading zeros
    _appendText('PCU_LIST',[uid(), pcu_code, pcu_name, phone, address, '1', now()]);
    writeLog(sess,'add_pcu', pcu_name);
    return { message: 'เพิ่ม รพ.สต. สำเร็จ' };
  }
}

function adminDeletePcu(body, sess) {
  _requireAdmin(sess);
  const p = _find('PCU_LIST','id', body.id);
  _update('PCU_LIST', body.id, { is_active: 0 });
  writeLog(sess,'delete_pcu', p?p.pcu_name:'');
  return { message: 'ลบ รพ.สต. สำเร็จ' };
}

function adminGetUsers(sess) {
  _requireAdmin(sess);
  const pcus = _rows('PCU_LIST');
  return _query('PCU_USERS', u=>u.is_active==1).map(u => {
    const pcu = pcus.find(p=>p.id===u.pcu_id);
    return { ...u, password_hash:'***',
             pcu_name: pcu?pcu.pcu_name:'-',
             pcu_code: pcu?pcu.pcu_code:'-' };
  });
}

function adminSaveUser(body, sess) {
  _requireAdmin(sess);
  const { id, pcu_id, username, password, display_name, role } = body;
  if (!username) throw new Error('กรุณาระบุ Username');
  if (id) {
    const upd = { pcu_id, display_name:display_name||'', role:role||'officer' };
    if (password) upd.password_hash = sha256(password);
    _update('PCU_USERS', id, upd);
    writeLog(sess,'edit_user', username);
    return { message: 'แก้ไข User สำเร็จ' };
  } else {
    if (!password) throw new Error('กรุณาระบุ Password');
    const exist = _find('PCU_USERS','username', username);
    if (exist && exist.is_active=='1') throw new Error('Username นี้มีอยู่แล้ว');
    _append('PCU_USERS',[uid(), pcu_id, username, sha256(password),
                         display_name||'', role||'officer', '', 1, now()]);
    writeLog(sess,'add_user', username);
    return { message: 'เพิ่ม User สำเร็จ' };
  }
}

function adminDeleteUser(body, sess) {
  _requireAdmin(sess);
  const u = _find('PCU_USERS','id', body.id);
  _update('PCU_USERS', body.id, { is_active: 0 });
  writeLog(sess,'delete_user', u?u.username:'');
  return { message: 'ลบ User สำเร็จ' };
}
