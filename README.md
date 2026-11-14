# Remaja Ertiga — Management System

Sistem manajemen organisasi Remaja Ertiga: **anggota, iuran, kas (pemasukan/pengeluaran), kegiatan, laporan, dan pengaturan**.
Dibangun dengan PHP (tanpa framework) + SQLite untuk lokal dan Supabase PostgreSQL untuk Vercel.

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

1. **Siapkan database Supabase** — buka SQL Editor project Anda lalu jalankan
   isi [`database/supabase_schema.sql`](database/supabase_schema.sql).
   Skrip ini membuat tabel ber-prefix `re_` (agar tidak bentrok dengan tabel
   lain) sekaligus fungsi `re_query()` yang menjalankan SQL aplikasi apa adanya.
2. **Set environment variable di project Vercel**:

   | Variabel | Keterangan |
   |---|---|
   | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `SUPABASE_ANON_KEY` | kunci anon (publishable) |
   | `SUPABASE_SERVICE_KEY` | kunci `service_role` — **wajib**, dipakai server untuk `re_query()`; jangan pernah dipakai di browser |
   | `JWT_SECRET` | wajib diganti di production |
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | opsional, untuk upload bukti ke Google Drive |

   Tanpa `SUPABASE_SERVICE_KEY`, halaman akan menampilkan error koneksi
   database (fungsi `re_query` hanya diberikan ke `service_role`).
3. **Deploy**: `vercel --prod` atau push ke branch produksi.
4. **Verifikasi**: buka `index.php?page=status` — semua tabel harus hijau
   dengan jumlah baris yang benar.

Tanpa `VERCEL`/`VERCEL_ENV`, aplikasi otomatis memakai SQLite lokal
(`remaja_ertiga.db`) — tidak perlu Supabase sama sekali untuk development.

> Catatan arsitektur: di Vercel, `config/supabase_db.php` mengirim setiap
> query ke fungsi PostgreSQL `re_query(q text)` lewat PostgREST. Dengan begitu
> JOIN, subquery, agregat, `CASE`, `BETWEEN`, dan `ON CONFLICT` tetap berjalan
> sama seperti di SQLite — tidak ada emulasi SQL di PHP. Tabel aplikasi
> memakai prefix `re_`; akses langsung dari `anon`/`authenticated` dicabut.

## 🗂️ Struktur

```
_app.php              Router utama (semua halaman)
index.php             Entry point lokal
api/index.php         Entry point Vercel (JWT + Supabase)
dev-router.php        Router untuk server PHP lokal
config/               database.php (SQLite/Supabase), supabase_db.php, google_config.php
database/             supabase_schema.sql (skema + fungsi re_query untuk Vercel)
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
