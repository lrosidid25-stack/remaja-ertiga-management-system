<?php
/**
 * LUPA NIR — cari NIR anggota berdasarkan nama & nomor HP
 * Route: index.php?page=lupa-nir
 */

$pengaturan = getAllPengaturan();
$namaOrg = $pengaturan['nama_organisasi'] ?: 'Remaja Ertiga';

$q = trim($_GET['q'] ?? '');
$hasil = [];
$error = '';
$sudahCari = false;

if ($q !== '') {
    $sudahCari = true;
    if (mb_strlen($q) < 3) {
        $error = 'Masukkan minimal 3 karakter nama atau nomor HP.';
    } else {
        $db = getDB();
        $stmt = $db->prepare("SELECT nir, nama, no_hp, status FROM anggota
            WHERE nama LIKE ? OR no_hp LIKE ?
            ORDER BY nama LIMIT 10");
        $stmt->execute(['%' . $q . '%', '%' . $q . '%']);
        $hasil = $stmt->fetchAll();
        if (empty($hasil)) {
            $error = 'Tidak ada anggota yang cocok. Coba kata kunci lain atau hubungi pengurus.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cari NIR — <?= htmlspecialchars($namaOrg) ?></title>
    <link rel="stylesheet" href="assets/css/style.css?v=1">
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
                <a href="index.php?page=login" class="nav-link">Login Pengurus</a>
            </div>
        </div>
    </div>
</nav>

<div class="auth-wrap">
    <div class="auth-card" style="max-width:560px;">
        <div class="auth-head">
            <div class="auth-logo">🔎</div>
            <h2>Lupa NIR?</h2>
            <p>Cari NIR dengan nama lengkap atau nomor HP yang terdaftar.</p>
        </div>

        <form method="get" action="index.php">
            <input type="hidden" name="page" value="lupa-nir">
            <div class="form-group">
                <label class="form-label" for="q">Nama atau Nomor HP</label>
                <input type="text" id="q" name="q" value="<?= htmlspecialchars($q) ?>" placeholder="Contoh: Ahmad / 08123..." required>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Cari NIR</button>
        </form>

        <?php if ($error): ?>
            <div class="alert alert-red mt-2"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <?php if (!empty($hasil)): ?>
            <div class="mt-2">
                <div class="card-title">Hasil Pencarian</div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Nama</th><th>NIR</th><th>Aksi</th></tr></thead>
                        <tbody>
                        <?php foreach ($hasil as $h): ?>
                            <tr>
                                <td><?= htmlspecialchars($h['nama']) ?></td>
                                <td style="font-family:ui-monospace,monospace;font-weight:700;"><?= htmlspecialchars($h['nir']) ?></td>
                                <td><a class="btn btn-sm btn-outline" href="index.php?page=cek&nir=<?= urlencode($h['nir']) ?>">Cek Iuran</a></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <p class="form-hint mt-1">Demi privasi, nomor HP tidak ditampilkan penuh.</p>
            </div>
        <?php endif; ?>

        <div class="auth-foot">
            <p><a href="index.php">← Kembali ke cek iuran</a></p>
        </div>
    </div>
</div>
<script src="assets/js/app.js?v=1"></script>
</body>
</html>
