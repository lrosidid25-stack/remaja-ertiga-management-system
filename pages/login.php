<?php
/**
 * HALAMAN LOGIN PENGURUS
 * Route: index.php?page=login
 */

$pengaturan = getAllPengaturan();
$namaOrg = ($pengaturan['nama_organisasi'] ?? '') ?: 'Remaja Ertiga';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($username === '' || $password === '') {
        $error = 'Username dan password wajib diisi.';
    } elseif (prosesLogin($username, $password)) {
        setFlash('success', 'Selamat datang, ' . ($_SESSION['user']['nama'] ?? $username) . '!');
        redirect('index.php?page=dashboard');
    } else {
        $error = 'Username atau password salah, atau akun tidak aktif.';
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Pengurus — <?= htmlspecialchars($namaOrg) ?></title>
    <link rel="stylesheet" href="assets/css/style.css?v=2">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏘️</text></svg>">
</head>
<body>
<nav class="navbar">
    <div class="nav-container">
        <a href="index.php" class="nav-brand">
            <span class="brand-icon">🏘️</span>
            <span class="brand-text"><?= htmlspecialchars($namaOrg) ?></span>
        </a>
        <div class="nav-menu" style="justify-content:flex-end;">
            <div class="nav-links">
                <a href="index.php" class="nav-link">Cek Iuran</a>
                <a href="index.php?page=login" class="nav-link active">Login Pengurus</a>
            </div>
        </div>
    </div>
</nav>

<div class="auth-wrap">
    <div class="auth-card">
        <div class="auth-head">
            <div class="auth-logo">🏘️</div>
            <h2>Login Pengurus</h2>
            <p><?= htmlspecialchars($namaOrg) ?></p>
        </div>

        <?php if ($error): ?>
            <div class="alert alert-red"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        <?= getFlash() ?>

        <form method="post" action="index.php?page=login" autocomplete="on">
            <div class="form-group">
                <label class="form-label" for="username">Username</label>
                <input type="text" id="username" name="username" required autofocus
                       autocomplete="username" placeholder="Masukkan username"
                       value="<?= htmlspecialchars($_POST['username'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="password">Password</label>
                <input type="password" id="password" name="password" required
                       autocomplete="current-password" placeholder="Masukkan password">
            </div>
            <button type="submit" class="btn btn-primary btn-block btn-lg">Masuk →</button>
        </form>

        <div class="auth-foot">
            <p>Lupa NIR anggota? <a href="index.php?page=lupa-nir"><strong>Cari NIR</strong></a></p>
            <p style="margin-top:8px;"><a href="index.php">← Kembali ke halaman cek iuran</a></p>
        </div>
    </div>
</div>

<script src="assets/js/app.js?v=2"></script>
</body>
</html>
