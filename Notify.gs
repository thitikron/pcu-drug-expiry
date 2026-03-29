/**
 * Notify.gs – LINE Flex Message via MOPH Notify
 * Trigger: sendDailyNotify() ทุกวัน 11:00
 */

// ── Daily Notify (Trigger) ────────────────────
function sendDailyNotify() {
  const t    = today();
  const dL   = e => Math.ceil((new Date(e)-new Date(t))/86400000);
  const all  = _query('DRUG_EXPIRY', r=>r.is_active==1);
  const pcus = _query('PCU_LIST', r=>r.is_active==1 && r.pcu_code!=='ADMIN');
  const thM  = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                 'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const tNow = new Date();
  const tDate= tNow.getDate()+' '+thM[tNow.getMonth()+1]+' '+(tNow.getFullYear()+543);

  for (const thr of CFG.NOTIFY_DAYS) {
    const color  = thr<=7?'#dc2626':thr<=30?'#ef4444':thr<=90?'#f97316':'#eab308';
    const label  = thr<=7?'🚨 ไม่ถึง 1 สัปดาห์':
                   thr<=30?'🔴 ไม่ถึง 1 เดือน':
                   thr<=90?'🟠 ไม่ถึง 3 เดือน':'🟡 ไม่ถึง 6 เดือน';

    for (const pcu of pcus) {
      const items = all.filter(r => {
        if (r.pcu_id !== pcu.id) return false;
        const d  = dL(r.expiry_date);
        if (d < 0 || d > thr) return false;
        const nd = r.notified_days ? JSON.parse(r.notified_days) : [];
        return !nd.includes(thr);
      });
      if (!items.length) continue;

      const rows = items.map(r => {
        const d   = dL(r.expiry_date);
        const ed  = new Date(r.expiry_date);
        const td  = ed.getDate()+'/'+thM[ed.getMonth()+1];
        const icon= r.item_type==='vaccine'?'💉':'💊';
        const sub = r.item_type==='vaccine'?r.vaccine_group:r.dosage_form;
        return {
          type:'box', layout:'horizontal',
          paddingTop:'6px', paddingBottom:'6px',
          borderWidth:'1px', borderColor:'#f1f5f9',
          contents:[
            {type:'box',layout:'vertical',flex:5,contents:[
              {type:'text',text:icon+' '+r.drug_name,size:'sm',weight:'bold',wrap:true,color:'#1e293b'},
              {type:'text',text:(sub||'-')+(r.lot_number?' | '+r.lot_number:''),size:'xs',color:'#888'},
              {type:'text',text:'หมด: '+td+(r.quantity?' | '+r.quantity+(r.unit||''):''),size:'xs',color:'#888'},
            ]},
            {type:'text',text:'อีก '+d+' วัน',size:'sm',weight:'bold',
             color:color,align:'end',flex:2,wrap:true}
          ]
        };
      });

      const msg = buildFlexMsg(pcu.pcu_name, label, color, tDate, items.length, rows);
      sendLine(msg, `⚠️ ยาใกล้หมดอายุ ${pcu.pcu_name} (${label})`);

      // อัปเดต notified_days
      for (const item of items) {
        const nd = item.notified_days ? JSON.parse(item.notified_days) : [];
        nd.push(thr);
        _update('DRUG_EXPIRY', item.id, {
          notified_days: JSON.stringify([...new Set(nd)])
        });
      }
      Logger.log(`Notified: ${pcu.pcu_name} (${thr} days) - ${items.length} items`);
    }
  }
}

// ── Exchange Notify ───────────────────────────
function sendExchangeNotify(sess, drug, days, ratio, qty) {
  const thM  = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                 'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const now2 = new Date();
  const tDate= now2.getDate()+' '+thM[now2.getMonth()+1]+' '+(now2.getFullYear()+543);
  const tTime= Utilities.formatDate(now2,'Asia/Bangkok','HH:mm');
  const color= ratio===100?'#16a34a':'#d97706';
  const icon = drug.item_type==='vaccine'?'💉':'💊';

  const flex = {
    type:'flex',
    altText:'🔄 คำขอแลกยา – '+sess.pcu_name,
    contents:{
      type:'bubble',
      header:{type:'box',layout:'vertical',backgroundColor:'#f0fdf4',paddingAll:'12px',contents:[
        {type:'image',url:CFG.LOGO_URL,size:'70px',aspectMode:'fit'},
        {type:'text',text:'🔄 คำขอแลกยา',size:'md',weight:'bold',color:'#16a34a',align:'center',margin:'sm'},
        {type:'text',text:sess.pcu_name,size:'sm',color:'#64748b',align:'center'},
      ]},
      body:{type:'box',layout:'vertical',paddingAll:'12px',spacing:'sm',contents:[
        {type:'box',layout:'vertical',backgroundColor:color+'22',cornerRadius:'8px',paddingAll:'10px',contents:[
          {type:'text',text:icon+' '+drug.drug_name,size:'md',weight:'bold',wrap:true,color:'#1e293b'},
          {type:'text',text:'เหลืออีก '+days+' วัน | แลกได้ '+ratio+'%',size:'sm',color:color,margin:'sm'},
          {type:'text',text:'จำนวน: '+qty+' '+(drug.unit||'รายการ'),size:'sm',color:'#475569'},
        ]},
        {type:'separator',margin:'md'},
        {type:'text',text:'ผู้แจ้ง: '+sess.display_name,size:'xs',color:'#64748b'},
        {type:'text',text:drug.lot_number?'Lot: '+drug.lot_number:'',size:'xs',color:'#64748b'},
      ]},
      footer:{type:'box',layout:'horizontal',paddingAll:'8px',contents:[
        {type:'text',text:'📅 '+tDate,size:'xs',color:'#94a3b8'},
        {type:'text',text:'⏰ '+tTime+' น.',size:'xs',color:'#94a3b8',align:'end'},
      ]}
    }
  };
  sendLine(flex, '🔄 คำขอแลกยา – '+sess.pcu_name);
}

// ── Build Flex ────────────────────────────────
function buildFlexMsg(pcuName, label, color, tDate, cnt, rows) {
  const tNow = new Date();
  const tTime= Utilities.formatDate(tNow,'Asia/Bangkok','HH:mm');
  return {
    type:'flex',
    altText:'⚠️ ยาใกล้หมดอายุ '+pcuName,
    contents:{
      type:'bubble',
      header:{type:'box',layout:'vertical',backgroundColor:'#f0f9ff',paddingAll:'12px',contents:[
        {type:'image',url:CFG.LOGO_URL,size:'70px',aspectMode:'fit'},
        {type:'text',text:pcuName,size:'sm',weight:'bold',color:'#0891b2',align:'center',margin:'sm'},
      ]},
      body:{type:'box',layout:'vertical',paddingAll:'12px',contents:[
        {type:'box',layout:'vertical',backgroundColor:color+'22',cornerRadius:'8px',paddingAll:'10px',contents:[
          {type:'text',text:'⚠️ '+label+' จะหมดอายุ!',weight:'bold',color:color,size:'sm',align:'center'},
          {type:'text',text:'รวม '+cnt+' รายการ | '+tDate,size:'xs',color:'#64748b',align:'center',margin:'sm'},
        ]},
        {type:'separator',margin:'md'},
        ...rows
      ]},
      footer:{type:'box',layout:'horizontal',paddingAll:'8px',contents:[
        {type:'text',text:'📅 '+tDate,size:'xs',color:'#94a3b8'},
        {type:'text',text:'⏰ '+tTime+' น.',size:'xs',color:'#94a3b8',align:'end'},
      ]}
    }
  };
}

// ── Send to MOPH ──────────────────────────────
function sendLine(flexMsg, altText) {
  const payload = JSON.stringify({
    message:    JSON.stringify(flexMsg),
    line_type:  'flex',
    client_id:  CFG.LINE_CLIENT_KEY,
    secret_key: CFG.LINE_SECRET_KEY,
  });
  try {
    const resp = UrlFetchApp.fetch(CFG.MOPH_URL, {
      method:'post', contentType:'application/json',
      payload, muteHttpExceptions:true,
    });
    Logger.log('LINE resp: ' + resp.getContentText());
  } catch(e) { Logger.log('LINE error: ' + e); }
}

function actionSendTest(sess) {
  _requireAdmin(sess);
  sendLine({
    type:'flex', altText:'🔔 ทดสอบระบบแจ้งเตือน',
    contents:{type:'bubble',body:{type:'box',layout:'vertical',contents:[
      {type:'text',text:'🔔 ทดสอบระบบ',weight:'bold',size:'lg',color:'#0891b2'},
      {type:'text',text:'PCU Drug Expiry – '+CFG.HOSPITAL_NAME,size:'sm',color:'#64748b',margin:'sm'},
      {type:'text',text:'ระบบแจ้งเตือนทำงานปกติ ✅',size:'sm',margin:'md'},
    ]}}
  }, '🔔 ทดสอบ');
  writeLog(sess,'test_notify','ทดสอบส่ง LINE');
  return { message: 'ส่ง Notify ทดสอบสำเร็จ' };
}

// ── Setup Trigger ─────────────────────────────
function setupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t=>t.getHandlerFunction()==='sendDailyNotify')
    .forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendDailyNotify')
    .timeBased().everyDays(1).atHour(11)
    .nearMinute(0).inTimezone('Asia/Bangkok').create();
  Logger.log('Trigger created: sendDailyNotify @ 11:00 Bangkok');
  return 'Trigger created';
}
