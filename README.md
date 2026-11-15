# remaja-ertiga-management-system

Sistem manajemen organisasi Remaja Ertiga — anggota, iuran, keuangan, kegiatan, laporan.
PHP + Google Sheets + Google Drive.

## 📱 APK Android (aplikasi mobile)

Aplikasi Android dibangun dari proyek web di `apps/tawuran/` (React + Vite +
Three.js) dan dibungkus dengan Capacitor.

**Unduh & pasang langsung di HP:**

```
https://github.com/lrosidid25-stack/remaja-ertiga-management-system/releases/download/apk-terbaru/tawuran-jalanan-sore.apk
```

| ![Judul](apps/tawuran/docs/screenshots/01-title.jpg) | ![Pertarungan](apps/tawuran/docs/screenshots/10-gameplay-gir-6m.jpg) |
| --- | --- |
| Layar judul | Gelombang 1/3 · sabuk gir 6 m |

APK dibuat otomatis oleh GitHub Actions setiap ada perubahan di `apps/tawuran/`
(lihat `.github/workflows/build-apk.yml`) dan dipublikasikan ke rilis
[`apk-terbaru`](../../releases/tag/apk-terbaru).

Panduan lengkap (pasang di HP, build sendiri, ganti ikon, ganti versi, tanda
tangan release): **[apps/tawuran/BUILD-APK.md](apps/tawuran/BUILD-APK.md)**

> Galeri tangkapan layar: [apps/tawuran/docs/SCREENSHOTS.md](apps/tawuran/docs/SCREENSHOTS.md)

## 🗂️ Struktur repo

| Path | Isi |
| --- | --- |
| `_app.php`, `pages/`, `includes/`, `config/` | Aplikasi web PHP (dipakai di Vercel + Supabase) |
| `apps/tawuran/` | Proyek aplikasi Android (web app + pembungkus Capacitor) |
| `.github/workflows/build-apk.yml` | Pipeline build APK → GitHub Releases |

## 🖥️ Aplikasi web PHP

Butuh PHP 8+ (lokal pakai SQLite, di Vercel pakai Supabase).
Banyak halaman di `pages/` belum dibuat — lihat daftar route di `_app.php`.
