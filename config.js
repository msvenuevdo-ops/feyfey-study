/* ตั้งค่าเว็บของเฟย์เฟย์ — แก้ไฟล์นี้ไฟล์เดียวพอ (ดูวิธีใน README.md) */
window.APP_CONFIG = {
  // 1) Client ID จาก Google Cloud Console (OAuth client แบบ Web application)
  GOOGLE_CLIENT_ID: "673746676228-aouukmuog03eihdi58tadhlf0qs5qon4.apps.googleusercontent.com",

  // 2) บัญชี Google ที่อนุญาตให้เข้าเว็บ เก็บเป็นรหัส SHA-256 ของอีเมล (ตัวพิมพ์เล็ก)
  //    เพื่อไม่ให้อีเมลจริงโผล่ใน GitHub สร้างรหัสใหม่ได้ที่ https://emn178.github.io/online-tools/sha256.html
  ALLOWED_EMAIL_SHA256: ["ea15bf5aab862df519bab7cbb5b2f642df18b6a6d20b763a5bd6e2bdc5ded762"],

  // 3) โฟลเดอร์ข้อสอบใน Google Drive (ID คือส่วนท้ายของลิงก์โฟลเดอร์)
  EXAM_FOLDERS: [
    "12un7yvBwqVDbojqx4QIrOEQFnGKOUjpK", // คลังข้อสอบ by เฟย์
    "1KVSuO01wV234FaWtiiYRmaGpojaPPc2y", // Eng Tu
    "1UYA8ycHewdtzeEewMdb_s9awfEkx0nKd"  // Math
  ],

  // ชื่อไฟล์เก็บข้อมูล (คะแนน แผน ความคืบหน้า) ที่จะสร้างใน My Drive
  DATA_FILE_NAME: "FeyFey-Study-Data.json",

  OWNER_NAME: "เฟย์เฟย์"
};
