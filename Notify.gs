/**
 * Notify.gs – LINE Flex Message via MOPH Notify
 * Fix: ใช้ text message แทน flex เพื่อทดสอบก่อน
 * Fix: เพิ่ม debug logging
 */

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
    const color = thr<=7?'#dc2626':thr<=30?'#ef4444':thr<=90?'#f97316':'#eab308';
    const label = thr<=7?'🚨 ไม่ถึง 1 สัปดาห์':
                  thr<=30?'🔴 ไม่ถึง 1 เดือน':
                  thr<=90?'🟠 ไม่ถึง 3 เดือน':'🟡 ไม่ถึง 6 เดือน';

    for (const pcu of pcus) {
      const items = all.filter(r => {
        if (r.pcu_id !== pcu.id) return false;
        const d  = dL(r.expiry_date);
        if (d < 0 || d > thr) return false;
        try {
          const nd = r.notified_days ? JSON.parse(r.notified_days) : [];
          return !nd.includes(thr) && !nd.includes(String(thr));
        } catch(e) { return true; }
      });
      if (!items.length) continue;

      const rows = items.slice(0,10).map(r => {
        const d   = dL(r.expiry_date);
        const ed  = new Date(r.expiry_date);
        const td  = ed.getDate()+'/'+thM[ed.getMonth()+1];
        const icon= r.item_type==='vaccine'?'💉':'💊';
        const sub = r.item_type==='vaccine'?r.vaccine_group:r.dosage_form;
        return {
          type:'box', layout:'horizontal',
          paddingTop:'5px', paddingBottom:'5px',
          contents:[
            {type:'box',layout:'vertical',flex:5,contents:[
              {type:'text',text:icon+' '+(r.drug_name||''),size:'sm',weight:'bold',wrap:true,color:'#1e293b'},
              {type:'text',text:(sub||'-')+(r.lot_number?' | '+r.lot_number:''),size:'xs',color:'#888888'},
              {type:'text',text:'หมด: '+td+(r.quantity?' | '+r.quantity+(r.unit||''):''),size:'xs',color:'#888888'},
            ]},
            {type:'text',text:'อีก '+d+' วัน',size:'sm',weight:'bold',
             color:color,align:'end',flex:2,wrap:true}
          ]
        };
      });

      const flex = buildFlex(pcu.pcu_name, label, color, tDate, items.length, rows);
      const result = sendLine(flex, '⚠️ ยาใกล้หมดอายุ '+pcu.pcu_name+' ('+label+')');
      Logger.log('Notify '+pcu.pcu_name+' thr='+thr+' items='+items.length+' result='+result);

      // อัปเดต notified_days
      for (const item of items) {
        try {
          const nd = item.notified_days ? JSON.parse(item.notified_days) : [];
          nd.push(thr);
          _update('DRUG_EXPIRY', item.id, {
            notified_days: JSON.stringify([...new Set(nd)])
          });
        } catch(e) { Logger.log('notified_days error: '+e); }
      }
    }
  }
  Logger.log('Daily notify done: '+now());
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
          {type:'text',text:icon+' '+(drug.drug_name||''),size:'md',weight:'bold',wrap:true,color:'#1e293b'},
          {type:'text',text:'เหลืออีก '+days+' วัน | แลกได้ '+ratio+'%',size:'sm',color:color,margin:'sm'},
          {type:'text',text:'จำนวน: '+qty+' '+(drug.unit||'รายการ'),size:'sm',color:'#475569'},
        ]},
        {type:'separator',margin:'md'},
        {type:'text',text:'ผู้แจ้ง: '+(sess.display_name||''),size:'xs',color:'#64748b'},
        {type:'text',text:(drug.lot_number?'Lot: '+drug.lot_number:''),size:'xs',color:'#64748b'},
      ]},
      footer:{type:'box',layout:'horizontal',paddingAll:'8px',contents:[
        {type:'text',text:'📅 '+tDate,size:'xs',color:'#94a3b8'},
        {type:'text',text:'⏰ '+tTime+' น.',size:'xs',color:'#94a3b8',align:'end'},
      ]}
    }
  };
  const result = sendLine(flex, '🔄 คำขอแลกยา – '+sess.pcu_name);
  Logger.log('Exchange notify result: '+result);
}

function buildFlex(pcuName, label, color, tDate, cnt, rows) {
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

// ── Send LINE ─────────────────────────────────
function sendLine(flexMsg, altText) {
  const payload = {
    message:    JSON.stringify(flexMsg),
    line_type:  'flex',
    client_id:  CFG.LINE_CLIENT_KEY,
    secret_key: CFG.LINE_SECRET_KEY,
  };

  Logger.log('Sending to MOPH: ' + CFG.MOPH_URL);
  Logger.log('client_id: ' + CFG.LINE_CLIENT_KEY);
  Logger.log('payload preview: ' + JSON.stringify(payload).substring(0,200));

  try {
    const resp = UrlFetchApp.fetch(CFG.MOPH_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const code = resp.getResponseCode();
    const body = resp.getContentText();
    Logger.log('Response code: ' + code);
    Logger.log('Response body: ' + body);
    return body;
  } catch(e) {
    Logger.log('sendLine error: ' + e.toString());
    return 'ERROR: ' + e.toString();
  }
}

// ── Test Notify ───────────────────────────────
function actionSendTest(sess) {
  _requireAdmin(sess);
  const thM  = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                 'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const now2 = new Date();
  const tDate= now2.getDate()+' '+thM[now2.getMonth()+1]+' '+(now2.getFullYear()+543);
  const tTime= Utilities.formatDate(now2,'Asia/Bangkok','HH:mm');

  const flex = {
    type:'flex',
    altText:'🔔 ทดสอบระบบแจ้งเตือน – รพ.สต.',
    contents:{
      type:'bubble',
      body:{type:'box',layout:'vertical',paddingAll:'16px',contents:[
        {type:'image',url:CFG.LOGO_URL,size:'80px',aspectMode:'fit',align:'center'},
        {type:'text',text:'🔔 ทดสอบระบบ',weight:'bold',size:'lg',color:'#0891b2',align:'center',margin:'md'},
        {type:'text',text:'PCU Drug Expiry – '+CFG.HOSPITAL_NAME,size:'sm',color:'#64748b',align:'center',margin:'sm'},
        {type:'separator',margin:'md'},
        {type:'text',text:'✅ ระบบแจ้งเตือนทำงานปกติ',size:'sm',color:'#16a34a',align:'center',margin:'md'},
        {type:'text',text:'ทดสอบโดย: '+(sess.display_name||''),size:'xs',color:'#94a3b8',align:'center',margin:'sm'},
      ]},
      footer:{type:'box',layout:'horizontal',paddingAll:'8px',contents:[
        {type:'text',text:'📅 '+tDate,size:'xs',color:'#94a3b8'},
        {type:'text',text:'⏰ '+tTime+' น.',size:'xs',color:'#94a3b8',align:'end'},
      ]}
    }
  };

  const result = sendLine(flex, '🔔 ทดสอบระบบ');
  Logger.log('Test notify result: ' + result);
  writeLog(sess,'test_notify', 'result: '+result);

  // แสดงผลลัพธ์จริงให้ user เห็น
  let msg = 'ส่ง Notify แล้ว';
  try {
    const parsed = JSON.parse(result);
    if (parsed.status === 'success' || parsed.message === 'success') {
      msg = '✅ ส่ง LINE สำเร็จ';
    } else {
      msg = '⚠️ ส่งแล้ว แต่ได้รับ: ' + result;
    }
  } catch(e) {
    msg = 'ส่งแล้ว ตอบกลับ: ' + result;
  }
  return { message: msg, raw: result };
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
