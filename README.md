# Remaja Ertiga — Management System

Sistem manajemen organisasi Remaja Ertiga: **anggota, iuran, kas (pemasukan/pengeluaran), kegiatan, laporan, dan pengaturan**.
Dibangun dengan PHP (tanpa framework) + SQLite untuk lokal dan Supabase (PostgreSQL REST) untuk Vercel.

## ✨ Fitur

| Modul | Fungsi |
|---|---|
| **Publik** | Cek iuran berdasarkan NIR, cari NIR (lupa NIR), info metode pembayaran |
| **Dashboard** | Ringkasan anggota, tagihan periode terbaru, kas bulan ini, tunggakan, kegiatan aktif, log aktivitas |
| **Anggota** | CRUD anggota, filter/pencarian, detail, kartu anggota siap cetak |
| **Iuran** | Generate tagihan per periode (nominal × jumlah hari), catat pembayaran, bukti transfer, tunggakan |
| **Konfirmasi** | Verifikasi/tolak pembayaran yang menunggu |
| **Kas** | Pemasukan & pengeluaran dengan kategori, kegiatan terkait, dan bukti nota |
| **Kegiatan** | Agenda, anggaran vs realisasi, penanggung jawab, detail keuangan kegiatan |
| **Laporan** | Rekap bulanan, tahunan, kegiatan, rekap iuran + ekspor CSV |
| **Notifikasi** | Pengingat tunggakan via WhatsApp (template pesan) |
| **Pengaturan** | Profil organisasi, nominal iuran, periode kepengurusan, pengguna |
| **Status** | `index.php?page=status` — diagnostik koneksi database & tabel |

## 🔑 Akun demo (dibuat otomatis saat database kosong)

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Super Admin |
| `ketua` | `ketua123` | Ketua |
| `bendahara` | `bendahara123` | Bendahara |
| `sekretaris` | `sekretaris123` | Sekretaris |
| `humas1` / `humas2` | `humas123` | Humas |

> ⚠️ Ganti password seluruh akun setelah instalasi pertama.

## 🚀 Menjalankan lokal

Butuh PHP 8.0+ dengan ekstensi `pdo_sqlite`, `curl`, `mbstring`.

```bash
php -S 0.0.0.0:8000 dev-router.php
```

Buka <http://localhost:8000>. Database SQLite (`remaja_ertiga.db`) dibuat otomatis
beserta data awal (user, pengaturan, kategori). `dev-router.php` meniru routing
`vercel.json` sehingga aset di `/assets` dan `/uploads` tersaji dengan benar.

Alternatif tanpa dev-router: `php -S 0.0.0.0:8000 index.php` (aset statis tidak tersaji).

Kalau PHP belum tersedia, bisa memakai PHP-WASM:

```bash
npm install @php-wasm/cli
./node_modules/.bin/php-wasm-cli -S 0.0.0.0:8000 -t . dev-router.php
```

## ☁️ Deploy ke Vercel

`vercel.json` sudah merutekan semua request ke `api/index.php` dengan runtime `vercel-php`.

1. Set environment variable di project Vercel:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (sudah ada default di `config/database.php`)
   - `JWT_SECRET` (wajib diganti di production)
   - `GOOGLE_SERVICE_ACCOUNT_JSON` (opsional, untuk upload bukti ke Google Drive)
2. Buat tabel di Supabase (lihat skema di `config/database.php`) dengan tipe
   `serial`/`bigserial` untuk kolom `id`.
3. Deploy: `vercel --prod` atau push ke branch produksi.

Tanpa `VERCEL`/`VERCEL_ENV`, aplikasi otomatis memakai SQLite lokal.

## 🗂️ Struktur

```
_app.php              Router utama (semua halaman)
index.php             Entry point lokal
api/index.php         Entry point Vercel (JWT + Supabase)
dev-router.php        Router untuk server PHP lokal
config/               database.php (SQLite/Supabase), supabase_db.php, google_config.php
includes/             auth, jwt_auth, functions, header, footer, google_sync
pages/                home, login, lupa-nir, status, dashboard, anggota/, iuran/,
                      konfirmasi/, metode/, pemasukan/, pengeluaran/, kegiatan/,
                      laporan/, notifikasi/, pengaturan/
assets/               css/style.css, js/app.js
uploads/              bukti/, logo/, nota/ (di-ignore Git)
```

## 🔐 Peran & hak akses

`super_admin` › `ketua` › `wakil_ketua` › `sekretaris`/`wakil_sekretaris` › `bendahara`/`wakil_bendahara` › `humas`.
Hak akses per halaman diatur di `_app.php` + helper `role*()` di `includes/functions.php`.

## 📄 Lisensi

Internal organisasi Remaja Ertiga.
