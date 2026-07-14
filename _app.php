<?php
/**
 * _APP.PHP — Router Utama Aplikasi Remaja Ertiga
 * Semua request masuk lewat sini
 * 
 * LOKAL: pakai PHP session
 * VERCEL: pakai JWT (via jwt_bootstrap di api/index.php)
 */

// Bootstrap auth (session lokal / JWT Vercel)
require_once __DIR__ . '/includes/jwt_auth.php';

// Hanya start session di lokal (di Vercel, jwt_bootstrap sudah handle)
if (!(getenv('VERCEL') || getenv('VERCEL_ENV'))) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

// Load dependencies
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/auth.php';

// Inisialisasi database
initDatabase();

// Ambil halaman dari query string
$page = $_GET['page'] ?? 'home';

// ============================================================
// ROUTING
// ============================================================

// --- HALAMAN PUBLIK (tanpa login) ---
$publicPages = ['home', 'cek', 'login', 'logout', 'lupa-nir'];

if (!isLoggedIn() && !in_array($page, $publicPages)) {
    // Redirect ke login jika belum login dan halaman bukan publik
    setFlash('warning', 'Silakan login terlebih dahulu.');
    $page = 'login';
}

// --- Proses Logout ---
if ($page === 'logout') {
    prosesLogout();
    redirect('index.php');
}

// --- Route ke halaman yang sesuai ---
switch ($page) {

    // ============================================================
    // PUBLIK
    // ============================================================
    case 'home':
    case 'cek':
        // Halaman cek iuran publik
        $file = __DIR__ . '/pages/home.php';
        break;

    case 'login':
        if (isLoggedIn()) {
            redirect('index.php?page=dashboard');
        }
        $file = __DIR__ . '/pages/login.php';
        break;

    case 'lupa-nir':
        $file = __DIR__ . '/pages/lupa-nir.php';
        break;

    // ============================================================
    // DASHBOARD
    // ============================================================
    case 'dashboard':
        requireLogin();
        $file = __DIR__ . '/pages/dashboard.php';
        break;

    // ============================================================
    // ANGGOTA
    // ============================================================
    case 'anggota':
        requireLogin();
        $file = __DIR__ . '/pages/anggota/index.php';
        break;
    case 'anggota-tambah':
        requireRole(roleKelolaAnggota());
        $file = __DIR__ . '/pages/anggota/tambah.php';
        break;
    case 'anggota-edit':
        requireRole(roleKelolaAnggota());
        $file = __DIR__ . '/pages/anggota/edit.php';
        break;
    case 'anggota-detail':
        requireLogin();
        $file = __DIR__ . '/pages/anggota/detail.php';
        break;
    case 'anggota-kartu':
        requireLogin();
        $file = __DIR__ . '/pages/anggota/kartu.php';
        break;

    // ============================================================
    // IURAN
    // ============================================================
    case 'iuran':
        requireLogin();
        $file = __DIR__ . '/pages/iuran/index.php';
        break;
    case 'iuran-generate':
        requireRole(roleGenerateTagihan());
        $file = __DIR__ . '/pages/iuran/generate.php';
        break;
    case 'iuran-detail':
        requireLogin();
        $file = __DIR__ . '/pages/iuran/detail.php';
        break;
    case 'iuran-bayar':
        requireRole(roleTandaiLunas());
        $file = __DIR__ . '/pages/iuran/bayar.php';
        break;
    case 'iuran-tunggakan':
        requireLogin();
        $file = __DIR__ . '/pages/iuran/tunggakan.php';
        break;

    // ============================================================
    // KONFIRMASI
    // ============================================================
    case 'konfirmasi':
        requireRole(roleKonfirmasiBayar());
        $file = __DIR__ . '/pages/konfirmasi/index.php';
        break;

    // ============================================================
    // METODE PEMBAYARAN
    // ============================================================
    case 'metode':
        requireLogin();
        $file = __DIR__ . '/pages/metode/index.php';
        break;
    case 'metode-tambah':
        requireRole(roleKelolaKeuangan());
        $file = __DIR__ . '/pages/metode/tambah.php';
        break;
    case 'metode-edit':
        requireRole(roleKelolaKeuangan());
        $file = __DIR__ . '/pages/metode/edit.php';
        break;

    // ============================================================
    // PEMASUKAN
    // ============================================================
    case 'pemasukan':
        requireRole(array_merge(roleKelolaKeuangan(), ['ketua', 'wakil_ketua']));
        $file = __DIR__ . '/pages/pemasukan/index.php';
        break;
    case 'pemasukan-tambah':
        requireRole(array_merge(roleKelolaKeuangan(), ['ketua']));
        $file = __DIR__ . '/pages/pemasukan/tambah.php';
        break;
    case 'pemasukan-edit':
        requireRole(array_merge(roleKelolaKeuangan(), ['ketua']));
        $file = __DIR__ . '/pages/pemasukan/edit.php';
        break;

    // ============================================================
    // PENGELUARAN
    // ============================================================
    case 'pengeluaran':
        requireRole(array_merge(roleKelolaKeuangan(), ['ketua', 'wakil_ketua']));
        $file = __DIR__ . '/pages/pengeluaran/index.php';
        break;
    case 'pengeluaran-tambah':
        requireRole(array_merge(roleKelolaKeuangan(), ['ketua']));
        $file = __DIR__ . '/pages/pengeluaran/tambah.php';
        break;
    case 'pengeluaran-edit':
        requireRole(array_merge(roleKelolaKeuangan(), ['ketua']));
        $file = __DIR__ . '/pages/pengeluaran/edit.php';
        break;

    // ============================================================
    // KEGIATAN
    // ============================================================
    case 'kegiatan':
        requireLogin();
        $file = __DIR__ . '/pages/kegiatan/index.php';
        break;
    case 'kegiatan-tambah':
        requireRole(['super_admin', 'ketua', 'sekretaris', 'wakil_sekretaris']);
        $file = __DIR__ . '/pages/kegiatan/tambah.php';
        break;
    case 'kegiatan-edit':
        requireRole(['super_admin', 'ketua', 'sekretaris', 'wakil_sekretaris']);
        $file = __DIR__ . '/pages/kegiatan/edit.php';
        break;
    case 'kegiatan-detail':
        requireLogin();
        $file = __DIR__ . '/pages/kegiatan/detail.php';
        break;

    // ============================================================
    // LAPORAN
    // ============================================================
    case 'laporan':
        requireLogin();
        $file = __DIR__ . '/pages/laporan/index.php';
        break;
    case 'laporan-bulanan':
        requireLogin();
        $file = __DIR__ . '/pages/laporan/bulanan.php';
        break;
    case 'laporan-tahunan':
        requireLogin();
        $file = __DIR__ . '/pages/laporan/tahunan.php';
        break;
    case 'laporan-kegiatan':
        requireLogin();
        $file = __DIR__ . '/pages/laporan/kegiatan.php';
        break;
    case 'laporan-rekap-iuran':
        requireLogin();
        $file = __DIR__ . '/pages/laporan/rekap_iuran.php';
        break;

    // ============================================================
    // NOTIFIKASI
    // ============================================================
    case 'notifikasi':
        requireRole(roleTandaiLunas());
        $file = __DIR__ . '/pages/notifikasi/index.php';
        break;

    // ============================================================
    // PENGATURAN
    // ============================================================
    case 'pengaturan':
        requireLogin();
        $file = __DIR__ . '/pages/pengaturan/index.php';
        break;
    case 'pengaturan-profil':
        requireRole(roleKelolaPengaturan());
        $file = __DIR__ . '/pages/pengaturan/profil.php';
        break;
    case 'pengaturan-iuran':
        requireRole(roleKelolaPengaturan());
        $file = __DIR__ . '/pages/pengaturan/iuran.php';
        break;
    case 'pengaturan-periode':
        requireRole(roleKelolaPengaturan());
        $file = __DIR__ . '/pages/pengaturan/periode.php';
        break;
    case 'pengaturan-users':
        requireRole(roleKelolaUser());
        $file = __DIR__ . '/pages/pengaturan/users.php';
        break;

    // ============================================================
    // DEFAULT (404)
    // ============================================================
    default:
        $file = null;
        break;
}

// ============================================================
// RENDER HALAMAN
// ============================================================

if ($file && file_exists($file)) {
    // Semua halaman admin (kecuali public) pakai header/footer
    $isPublic = in_array($page, ['home', 'cek', 'login', 'lupa-nir']);
    if (!$isPublic) {
        require_once __DIR__ . '/includes/header.php';
    }
    require $file;
    if (!$isPublic) {
        require_once __DIR__ . '/includes/footer.php';
    }
} else {
    // 404
    require_once __DIR__ . '/includes/header.php';
    echo '<div class="empty-state" style="padding: 80px 20px;">
        <div class="empty-icon">🔍</div>
        <h3>Halaman Tidak Ditemukan</h3>
        <p>Halaman yang Anda cari tidak tersedia.</p>
        <a href="index.php?page=dashboard" class="btn btn-primary mt-2">Kembali ke Dashboard</a>
    </div>';
    require_once __DIR__ . '/includes/footer.php';
}
