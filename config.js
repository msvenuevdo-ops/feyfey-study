/* ตั้งค่าเว็บของเฟย์เฟย์ — แก้ไฟล์นี้ไฟล์เดียวพอ (ดูวิธีใน README.md) */
window.APP_CONFIG = {
  // 1) Client ID จาก Google Cloud Console (OAuth client แบบ Web application)
  GOOGLE_CLIENT_ID: "ใส่-CLIENT-ID-ตรงนี้.apps.googleusercontent.com",

  // 2) อีเมล Google ที่อนุญาตให้เข้าเว็บ (ใส่ได้หลายอีเมล)
  ALLOWED_EMAILS: ["ใส่อีเมล-gmail-ของเฟย์เฟย์-ตรงนี้@gmail.com"],

  // 3) โฟลเดอร์ข้อสอบใน Google Drive (ID คือส่วนท้ายของลิงก์โฟลเดอร์)
  EXAM_FOLDERS: [
    "12un7yvBwqVDbojqx4QIrOEQFnGKOUjpK", // คลังข้อสอบ by เฟย์
    "1KVSuO01wV234FaWtiiYRmaGpojaPPc2y"  // Eng Tu
  ],

  // ชื่อไฟล์เก็บข้อมูล (คะแนน แผน ความคืบหน้า) ที่จะสร้างใน My Drive
  DATA_FILE_NAME: "FeyFey-Study-Data.json",

  OWNER_NAME: "เฟย์เฟย์"
};
