<?php
/**
 * INDEX.PHP - Router Utama Remaja Ertiga
 */
if (session_status() === PHP_SESSION_NONE) session_start();
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/auth.php';
initDatabase();
$page = $_GET['page'] ?? 'home';
if (!isLoggedIn() && !in_array($page, ['home','cek','login','logout','lupa-nir'])) {
    setFlash('warning', 'Silakan login terlebih dahulu');
    $page = 'login';
}
if ($page === 'logout') { prosesLogout(); redirect('index.php'); }
$file = null;
if ($page === 'home' || $page === 'cek') $file = __DIR__ . '/pages/home.php';
elseif ($page === 'login') { if (isLoggedIn()) redirect('index.php?page=dashboard'); $file = __DIR__ . '/pages/login.php'; }
elseif ($page === 'lupa-nir') $file = __DIR__ . '/pages/lupa-nir.php';
elseif (file_exists(__DIR__ . '/pages/' . $page . '.php')) $file = __DIR__ . '/pages/' . $page . '.php';
else $file = __DIR__ . '/pages/' . str_replace('-', '/', $page) . '.php';
if ($file && file_exists($file)) {
    $isPublic = in_array($page, ['home','cek','login','lupa-nir']);
    if (!$isPublic) require_once __DIR__ . '/includes/header.php';
    require $file;
    if (!$isPublic) require_once __DIR__ . '/includes/footer.php';
} else {
    require_once __DIR__ . '/includes/header.php';
    echo '<div class="empty-state"><div class="empty-icon">🔍</div><h3>Halaman Tidak Ditemukan</h3><a href="index.php?page=dashboard" class="btn btn-primary mt-2">Kembali</a></div>';
    require_once __DIR__ . '/includes/footer.php';
}