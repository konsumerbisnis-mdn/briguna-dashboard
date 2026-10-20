/* Konfigurasi umum. Hanya berisi alamat API dan pengaturan tampilan: TIDAK ada data atau password di sini,
   karena file ini publik di GitHub Pages. */
window.APP_CONFIG = Object.freeze({
  // URL Web App Google Apps Script (Deploy → Web app → salin URL yang berakhiran /exec)
  API_URL: "https://script.google.com/macros/s/AKfycbxCWfiuAfUSVCtMrhJV6_a5AOEbjkUY3-3FMrUYcQ782CY3EkSLE1AXlvmTm9Ag2HDE/exec",
  APP_NAME: "Dashboard Briguna RO Medan",
  // awalan hash password di browser; harus sama dengan setup() di Apps Script ('briguna')
  HASH_PREFIX: "briguna",
  // keluar otomatis bila tidak ada aktivitas (menit)
  IDLE_MINUTES: 30,
  // batas waktu satu request ke Apps Script (detik)
  TIMEOUT_SEC: 90,
  // ukuran potongan upload LW321 (baris per request)
  UPLOAD_CHUNK: 4000,
  // default Tools RM
  TOOLS: { DSR: 70, RATE: 11, TENOR: 120 }
});
