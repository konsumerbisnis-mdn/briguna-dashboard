# Dashboard Kinerja Briguna & Tools RM — RO Medan

Website statis (GitHub Pages) + Google Apps Script sebagai API & penjaga akses + Google Sheets sebagai database.

```
Browser (GitHub Pages)  ──HTTPS POST──▶  Apps Script Web App  ──▶  Google Sheets (privat)
 index.html, css, js        login, RBAC, cache,                     keragaan, RKA, disburse,
 (tanpa data)               masking per peran                       list RM/mantri, LW321, users, log
```

## Isi repository

| File | Fungsi |
|---|---|
| `index.html` | Kerangka SPA: layar login, menu, topbar, dialog |
| `css/styles.css` | Tema (terang/gelap), login kaca, kartu, tabel, cetak tabel angsuran |
| `js/config.js` | **URL Web App Apps Script** dan pengaturan umum (tanpa data/password) |
| `js/auth.js` | Hash password, login/logout, sesi terenkripsi AES-GCM di sessionStorage, idle timeout, RBAC tampilan, sanitasi XSS |
| `js/app.js` | Ambil & olah data, Dashboard (kinerja, produktivitas, keragaan), Detail Debitur, Admin (upload LW321, user, log) |
| `js/tools.js` | Kalkulator max plafond (THP & DSR), angsuran anuitas/flat, tabel angsuran (CSV & cetak) |
| `google_apps_script.gs` | Backend: `doPost` (API), login, sesi, rate limit, access log, cache data, upload LW321, user management |

## 1. Siapkan Google Sheets

1. Buka spreadsheet database. **Matikan "Publikasikan ke web"** (File → Bagikan → Publikasikan ke web → Hentikan publikasi). Bagikan spreadsheet hanya ke akun Anda.
2. Samakan setelan lokal dengan format angka sumber (File → Setelan → Lokal). Data berformat `1,250.5` → lokal **Amerika Serikat**. Isi ulang sheet lewat File → Impor → Ganti sheet.
3. Nama sheet yang dibaca (huruf besar/kecil bebas):

| Sheet | Kolom kunci |
|---|---|
| `keragaan` | Uker, Tanggal, Desc, DEB, OS, DPK, NPL, DEB DPK, DEB NPL (Rp juta) |
| `RKA` | Mata Anggaran, KODE UKER, UNIT KERJA, lalu kolom per akhir bulan (Rupiah penuh) |
| `disburse ritel 2025` | Kanca, Nama RM, Tanggal Realisasi, OS NET, FLAG SUPLESI, DESCRIPTION, Nama Debitur, CIF, OS Gross, Jlh Debitur |
| `disburse ritel 2026` | KD KC, KANCA, NAMA_DEBITUR, NO_REKENING, CIF, Real Baru/Suplesi, Delta Suplesi, SUKU_BUNGA, PRODUK, TGL_REALISASI, EQ_PLAFOND, PN AO (9 digit), RM PENGELOLA |
| `disburse mikro` | KD KC, KANCA, KD UKER, UNIT_KERJA, INSTANSI, NAMA_DEBITUR, NO_REKENING, CIF, Real Baru/Suplesi, Delta Suplesi, SUKU_BUNGA, PRODUK, TGL_REALISASI, EQ_PLAFOND, PN_AO, SEGMEN PROFESI |
| `list RM ritel` | Bulan, KANCA, Nama RM, JG, Target, PN AO 9 dig |
| `list mantri mikro` | Bentuk sama dengan list RM ritel (Bulan, KANCA/Unit, Nama RM/Nama Mantri, JG, Target, PN). Nama mantri di disburse Mikro dicocokkan lewat PN |
| `LW321`, `LW321 bulan lalu` | Dibuat otomatis oleh menu Admin → Upload LW321 |
| `users`, `access_log` | Dibuat otomatis oleh `setup()` |

## 2. Pasang Google Apps Script

1. Di spreadsheet: Ekstensi → Apps Script. Hapus isi `Code.gs`, tempel isi `google_apps_script.gs`.
2. Isi `CFG.SHEET_ID` dengan ID spreadsheet (bagian URL di antara `/d/` dan `/edit`). Simpan.
3. Pilih fungsi `setup` → **Jalankan** → izinkan akses (Sheets, Drive). Buka **Log eksekusi**: catat password admin sementara.
4. Deploy → **New deployment** → jenis **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (API tetap meminta login; tanpa token hanya mendapat pesan error)
5. Salin URL yang berakhiran `/exec`.
6. Opsional: jalankan `installDailyTrigger` agar cache data dibangun ulang tiap pukul 06.00.

Setiap kali kode `.gs` diubah: Deploy → Manage deployments → Edit → Version: **New version** (URL tetap sama).

## 3. Pasang di GitHub Pages

1. Buat repository baru (boleh publik, karena tidak ada data di dalamnya), unggah semua file kecuali `google_apps_script.gs` (boleh ikut, tidak berisi rahasia selain ID sheet; sebaiknya **jangan** diunggah bila repo publik).
2. Edit `js/config.js` → isi `API_URL` dengan URL `/exec` dari langkah 2.5.
3. Settings → Pages → Source: *Deploy from a branch* → `main` / root → Save. Tunggu ±1 menit, buka `https://<user>.github.io/<repo>/`.
4. Login `admin` dengan password sementara → menu user (kanan atas) → **Ganti password**.

## 4. Pemakaian

- **Admin → User**: tambah user RM (isi *Nama RM di data* persis seperti di LW321/disburse, atau PN), Guest, atau Admin lain.
- **Admin → Upload LW321**: pilih file LW321 posisi terkini (Ritel + Mikro, semua sheet dibaca). Bila posisinya bulan yang lebih baru, LW321 lama otomatis menjadi `LW321 bulan lalu`. Data Debitur Briguna (format AGU26) juga bisa dipakai sebagai pembanding.
- **Sync**: membangun ulang cache dari Google Sheets (admin: paksa; peran lain maks. tiap 2 menit).
- **Tools RM**: kalkulator di browser, tidak ada data yang dikirim.

## Peran & akses

| Menu | Admin | RM | Guest |
|---|---|---|---|
| Dashboard kinerja, produktivitas, keragaan, kualitas per cabang (agregat) | ✓ | ✓ | ✓ |
| Kinerja saya (kartu RM) | – | ✓ | – |
| Detail Debitur (LW321 & disburse per rekening) | semua | kelolaan sendiri | ✗ |
| Tools RM | ✓ | ✓ | ✗ |
| Admin (upload, user, log, sync paksa) | ✓ | ✗ | ✗ |

Pembatasan dilakukan **di Apps Script** (server), bukan hanya disembunyikan di tampilan: Guest tidak pernah menerima data per rekening, RM hanya menerima baris yang nama RM / PN-nya cocok.

## Keamanan yang diterapkan

- Spreadsheet privat; satu-satunya jalan baca/tulis adalah Apps Script milik Anda.
- Password: browser mengirim SHA-256(`briguna|username|password`); server menyimpan hash ulang ber-salt 1.000 iterasi. Isi sheet `users` tidak bisa dipakai untuk login.
- Sesi: token acak 64 karakter di CacheService (6 jam), keluar otomatis setelah 30 menit tidak aktif, token di browser disimpan terenkripsi AES-GCM.
- Login dikunci 15 menit setelah 5x salah; rate limit 240 request / 10 menit per user (anti-scraping); semua login, akses detail debitur, upload, dan perubahan user tercatat di `access_log`.
- Input dibersihkan di browser dan server; isi sel yang diawali `= + - @` diberi tanda kutip agar tidak dieksekusi sebagai formula; seluruh teks dari data di-escape sebelum ditampilkan (XSS).
- Content-Security-Policy membatasi skrip ke CDN yang dipakai dan koneksi hanya ke `script.google.com`.

Batasan yang perlu diketahui: siapa pun yang **sudah login** bisa melihat dan menyalin data yang memang ditampilkan untuknya. LW321 berisi data nasabah; pastikan penyimpanan di Google Drive pribadi sesuai kebijakan bank dan UU PDP.

## Logika perhitungan

Mengikuti Ketentuan Olah Data LW321 (Project BRIguna): Briguna Ritel = Karya + Purna + Pra-Purna (anti double-count), RKA Rupiah penuh ÷ 1.000.000, %Penc OS/DEB = realisasi ÷ RKA, SML/NPL = RKA ÷ realisasi (maks. 120%), net disburse = Delta Suplesi, kuadran K1 ≥105% · K2 100–105% · K3 50–100% · K4 <50%, kriteria kredit & one obligor sesuai ketentuan 02.
