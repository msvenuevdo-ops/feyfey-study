# สมุดเตรียมฯ ของเฟย์เฟย์

เว็บทบทวนสอบเข้าเตรียมอุดมฯ รวม **AI Exam Master** (คลังข้อสอบ แผน จับเวลา คะแนน) กับ **สมุดสรุป** (สรุปเนื้อหา ข้อสอบจำลอง การ์ดสูตร) ไว้ในเว็บเดียว

- ต้อง **เข้าสู่ระบบด้วย Google** ก่อน และเข้าได้เฉพาะอีเมลที่ใส่ไว้ใน `config.js`
- **ข้อมูลทั้งหมดเก็บใน Google Drive** ของเจ้าของ ในไฟล์ `FeyFey-Study-Data.json` (สร้างให้อัตโนมัติ)
- รายชื่อข้อสอบ **อ่านจากโฟลเดอร์ใน Drive** ทุกครั้งที่เข้า (ไม่มีข้อมูลข้อสอบหรือคะแนนอยู่ใน GitHub)
- ใช้บน iPad และ iPhone ได้ กด “แชร์ → เพิ่มลงในหน้าจอโฮม” เพื่อเปิดเหมือนแอป

## ตั้งค่าครั้งแรก (ทำครั้งเดียว ประมาณ 15 นาที)

### ขั้นที่ 1: เอาไฟล์ขึ้น GitHub Pages
1. เข้า https://github.com → **New repository** ตั้งชื่อ เช่น `feyfey-study` เลือก **Public** → Create
2. ในหน้า repo กด **Add file → Upload files** ลากไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้นไป (รวม `.nojekyll`) → **Commit changes**
3. ไปที่ **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `(root)` → Save
4. รอ 1–2 นาที จะได้ลิงก์ `https://<ชื่อผู้ใช้>.github.io/feyfey-study/`

### ขั้นที่ 2: สร้าง Google Client ID
1. เข้า https://console.cloud.google.com → สร้างโปรเจกต์ใหม่ (เช่น `feyfey-study`)
2. **APIs & Services → Library** → ค้นหา **Google Drive API** → **Enable**
3. **APIs & Services → OAuth consent screen** (หรือ Google Auth Platform)
   - User type: **External** → ใส่ชื่อแอปและอีเมล
   - Scopes: เพิ่ม `.../auth/drive.readonly` และ `.../auth/drive.file`
   - **Test users**: ใส่อีเมล Gmail ของเฟย์เฟย์ (ปล่อยสถานะเป็น *Testing* ได้เลย คนอื่นจะเข้าไม่ได้)
4. **Credentials → Create credentials → OAuth client ID** → Application type: **Web application**
   - **Authorized JavaScript origins**: `https://<ชื่อผู้ใช้>.github.io`
   - (ถ้าจะทดสอบในเครื่อง เพิ่ม `http://localhost:5173` ด้วย)
5. คัดลอก **Client ID** (ลงท้าย `.apps.googleusercontent.com`)

### ขั้นที่ 3: แก้ `config.js`
ใน GitHub เปิดไฟล์ `config.js` → กดรูปดินสอ แก้ 2 บรรทัดนี้ แล้ว Commit:
```js
GOOGLE_CLIENT_ID: "xxxx.apps.googleusercontent.com",
ALLOWED_EMAIL_SHA256: ["รหัส SHA-256 ของอีเมล (ตัวพิมพ์เล็ก)"],
```
อีเมลเก็บเป็นรหัส SHA-256 เพื่อไม่ให้อีเมลจริงอยู่ใน GitHub (ตั้งค่าไว้ให้แล้ว)
เปิดลิงก์ GitHub Pages อีกครั้ง → เข้าสู่ระบบด้วย Google → กดอนุญาต (หน้า “Google hasn’t verified this app” ให้กด Continue เพราะเป็นแอปของเราเอง)

## ความปลอดภัย
- โค้ดเว็บเป็นสาธารณะ แต่ **ไม่มีข้อมูลส่วนตัวอยู่ในโค้ด** คะแนนและแผนอยู่ใน Drive ซึ่งอ่านได้ด้วยบัญชี Google ของเจ้าของเท่านั้น
- แอปขอสิทธิ์ *อ่าน* Drive (เพื่อดูรายชื่อไฟล์ข้อสอบ) และ *เขียนเฉพาะไฟล์ที่แอปสร้างเอง* (ไฟล์ข้อมูล) แก้หรือลบไฟล์อื่นใน Drive ไม่ได้
- โฟลเดอร์ข้อสอบตั้งค่าใน `config.js` (`EXAM_FOLDERS`) เพิ่ม/ลบโฟลเดอร์ได้

## ทดสอบในเครื่อง (ไม่ต้องมี Google)
```
npx http-server . -p 5173
```
เปิด `http://localhost:5173/?demo=1` จะเข้าโหมดทดลองด้วยข้อสอบตัวอย่าง ข้อมูลอยู่ในเบราว์เซอร์นั้นเท่านั้น

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | โครงหน้าเว็บ |
| `styles.css` | หน้าตา (สีชมพู สติกเกอร์) |
| `app.js` | ระบบทั้งหมด: เข้าสู่ระบบ, Drive, แผน, จับเวลา, คะแนน, สมุดสรุป |
| `config.js` | ค่าที่ต้องแก้ (Client ID, อีเมล, โฟลเดอร์) |
| `notebook.json` | เนื้อหาสมุดสรุป 17 หัวข้อ 35 ข้อสอบ 26 การ์ด |
