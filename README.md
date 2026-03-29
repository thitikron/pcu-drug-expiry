# PCU Drug Expiry System
ระบบติดตามวันหมดอายุยา รพ.สต. – รพ.แม่แตง

## Architecture
```
GitHub Pages (Frontend)  ←→  Google Apps Script (Backend + DB)
                                       ↕
                              Google Sheets (Database)
                                       ↕
                              Google Sheet ยา/วัคซีน (Reference)
                                       ↕
                              LINE MOPH Notify
```

## ขั้นตอนติดตั้ง

### Step 1 – Google Apps Script

1. ไปที่ https://script.google.com → **New Project**
2. ตั้งชื่อ: `PCU Drug Expiry`
3. สร้างไฟล์ตามนี้ (ลบโค้ดเดิมทิ้ง วางโค้ดใหม่):

| ไฟล์ (Script) | จาก |
|---|---|
| Code.gs | `gas/Code.gs` |
| Database.gs | `gas/Database.gs` |
| Auth.gs | `gas/Auth.gs` |
| Items.gs | `gas/Items.gs` |
| Notify.gs | `gas/Notify.gs` |

4. **Deploy** → New Deployment → Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy **Deployment URL**

### Step 2 – แก้ config.js

เปิดไฟล์ `web/config.js` แก้ URL:
```javascript
const GAS_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
```

### Step 3 – GitHub Pages

1. สร้าง Repository ใน GitHub (ชื่อ: `pcu-drug-expiry`)
2. Upload ไฟล์ทั้งหมดในโฟลเดอร์ `web/`
3. Settings → Pages → Source: **main branch / root**
4. URL จะเป็น: `https://username.github.io/pcu-drug-expiry`

### Step 4 – Setup ครั้งแรก

1. เปิด Deployment URL ของ Apps Script ใน Browser
2. จะเห็น JSON `{"ok":true,"system":"PCU Drug Expiry",...}`
3. เรียก Setup endpoint: เพิ่ม `?setup=1` หรือเรียก `actionSetup()` ใน Script Editor

### Step 5 – ตั้ง Trigger แจ้งเตือน

ใน Apps Script → **Triggers** → Add Trigger:
- Function: `sendDailyNotify`
- Event: Time-driven → Day timer → 11:00–12:00

หรือรัน `setupTrigger()` ใน Script Editor

### Step 6 – Login ครั้งแรก

เปิด GitHub Pages URL → Login:
- **Username:** `admin`
- **Password:** `admin1234`

⚠️ เปลี่ยน Password หลัง Login ครั้งแรก!

---

## โครงสร้างไฟล์

```
gas/
├── Code.gs        # Router หลัก + Config
├── Database.gs    # CRUD Google Sheets
├── Auth.gs        # Login / Session / Logs
├── Items.gs       # Drug/Vaccine CRUD + Reference Data
└── Notify.gs      # LINE Notify

web/
├── config.js      # GAS URL (แก้ก่อน deploy)
├── api.js         # API helper
├── style.css      # Global styles
├── index.html     # Login
├── dashboard.html # หน้าหลัก
├── form.html      # เพิ่ม/แก้ไขรายการ
├── report.html    # รายงาน
├── exchange.html  # แลกยา
└── admin.html     # Admin (PCU + Users + Logs)
```

---

## Google Sheets Structure (สร้างอัตโนมัติ)

| Sheet | ใช้เก็บ |
|---|---|
| PCU_LIST | รายชื่อ รพ.สต. |
| PCU_USERS | Users ทุก รพ.สต. |
| DRUG_EXPIRY | รายการยา/วัคซีน |
| EXCHANGES | คำขอแลกยา |
| SESSIONS | Login sessions |
| LOGS | Log การใช้งาน |
