<?php
/**
 * STATUS — Diagnostik ringan (publik, tanpa data sensitif)
 * Route: index.php?page=status
 *
 * Berguna untuk memastikan aplikasi terhubung ke database
 * (SQLite lokal atau Supabase di Vercel) dan tabel sudah tersedia.
 */

$mode = (getenv('VERCEL') || getenv('VERCEL_ENV')) ? 'Supabase (Vercel)' : 'SQLite (Lokal)';

$tabel = ['users', 'anggota', 'periode_tagihan', 'tagihan_iuran', 'pemasukan', 'pengeluaran', 'kegiatan', 'pengaturan'];
$hasil = [];
$dbOk = true;
$dbError = '';

try {
    $db = getDB();
    foreach ($tabel as $t) {
        try {
            $n = (int)dbFetchColumn($db, "SELECT COUNT(*) FROM {$t}");
            $hasil[$t] = ['ok' => true, 'jumlah' => $n];
        } catch (Throwable $e) {
            $hasil[$t] = ['ok' => false, 'jumlah' => 0];
        }
    }
} catch (Throwable $e) {
    $dbOk = false;
    $dbError = $e->getMessage();
}

$adaMasalah = !$dbOk || count(array_filter($hasil, fn($h) => !$h['ok'])) > 0;
$pengaturan = getAllPengaturan();
$namaOrg = ($pengaturan['nama_organisasi'] ?? '') ?: 'Remaja Ertiga';
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Status Sistem — <?= htmlspecialchars($namaOrg) ?></title>
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

<div class="main-content">
    <div class="card-header">
        <div>
            <h2>🩺 Status Sistem</h2>
            <p class="text-muted" style="font-size:.87rem;">Pemeriksaan koneksi database dan ketersediaan tabel.</p>
        </div>
    </div>

    <?php if ($adaMasalah): ?>
        <div class="alert alert-yellow">
            Beberapa pemeriksaan gagal. Aplikasi mungkin belum bisa menampilkan data.
            <?php if ($dbError): ?><br><small><?= htmlspecialchars($dbError) ?></small><?php endif; ?>
        </div>
    <?php else: ?>
        <div class="alert alert-green">Semua pemeriksaan berhasil. Database terhubung dan tabel tersedia.</div>
    <?php endif; ?>

    <div class="grid-2">
        <div class="card">
            <div class="card-title">⚙️ Lingkungan</div>
            <div class="detail-list">
                <div class="detail-row"><span>Mode Database</span><span><?= htmlspecialchars($mode) ?></span></div>
                <div class="detail-row"><span>PHP</span><span><?= PHP_VERSION ?></span></div>
                <div class="detail-row"><span>Koneksi Database</span><span>
                    <?= $dbOk ? '<span class="badge badge-green">OK</span>' : '<span class="badge badge-red">Gagal</span>' ?>
                </span></div>
                <div class="detail-row"><span>Ekstensi PDO SQLite</span><span>
                    <?= extension_loaded('pdo_sqlite') ? '<span class="badge badge-green">Ada</span>' : '<span class="badge badge-gray">Tidak ada</span>' ?>
                </span></div>
                <div class="detail-row"><span>Ekstensi cURL</span><span>
                    <?= extension_loaded('curl') ? '<span class="badge badge-green">Ada</span>' : '<span class="badge badge-gray">Tidak ada</span>' ?>
                </span></div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">🗃️ Tabel Database</div>
            <div class="detail-list">
                <?php foreach ($hasil as $nama => $h): ?>
                    <div class="detail-row">
                        <span><?= htmlspecialchars($nama) ?></span>
                        <span>
                            <?php if ($h['ok']): ?>
                                <span class="badge badge-green"><?= $h['jumlah'] ?> baris</span>
                            <?php else: ?>
                                <span class="badge badge-red">tidak ditemukan</span>
                            <?php endif; ?>
                        </span>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>
</div>

<footer class="footer">
    <div class="footer-container">
        <div class="footer-bottom">
            <p>&copy; <?= date('Y') ?> <?= htmlspecialchars($namaOrg) ?> · <a href="index.php" style="color:inherit;">Kembali ke beranda</a></p>
        </div>
    </div>
</footer>
</body>
</html>
