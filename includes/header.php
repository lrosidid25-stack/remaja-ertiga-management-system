<?php
/**
 * HEADER & NAVBAR
 */

$pengaturan = getAllPengaturan();
$namaOrg = $pengaturan['nama_organisasi'] ?? 'Remaja Ertiga';
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($namaOrg) ?> — Manajemen Organisasi</title>
    <link rel="stylesheet" href="assets/css/style.css?v=1">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏘️</text></svg>">
</head>
<body>
<nav class="navbar" id="navbar">
    <div class="nav-container">
        <a href="index.php?page=dashboard" class="nav-brand">
            <span class="brand-icon">🏘️</span>
            <span class="brand-text"><?= htmlspecialchars($namaOrg) ?></span>
        </a>

        <?= isLoggedIn() ? '<button class="nav-toggle" id="navToggle" aria-label="Toggle menu"><span></span><span></span><span></span></button>' : '' ?>

        <div class="nav-menu" id="navMenu">
            <?php if (isLoggedIn()): ?>
            <div class="nav-links">
                <a href="index.php?page=dashboard" class="nav-link <?= ($_GET['page'] ?? '') === 'dashboard' ? 'active' : '' ?>"></a>
                <?php if (bolehAkses(array_merge(roleKalolaAnggota(), ['super_admin']))): ?> <a href="index.php?page=anggota" class="nav-link"></a> <?php endif; ?>
                <?php if (bolehAkses(array_merge(roleGenerateTagihan(), roleTandaiLunas()))): ?> <a href="index.php?page=iuran" class="nav-link"></a> <?php endif; ?>
                <?php if (bolehAkses(roleKonfirmasiBayar())): ?> <a href="index.php?page=konfirmasi" class="nav-link"></a> <?php endif; ?>
                <?php if (bolehAkses(roleKelolaKeuangan())): ?>
                <a href="index.php?page=pemasukan" class="nav-link"></a>
                <a href="index.php?page=pengeluaran" class="nav-link"></a>
                <?php endif; ?>
                <a href="index.php?page=kegiatan" class="nav-link"></a>
                <a href="index.php?page=laporan" class="nav-link"></a>
                <?php if (bolehAkses(roleTandaiLunas())): ?> <a href="index.php?page=notifikasi" class="nav-link"></a> <?php endif; ?>
                <?php if (bolehAkses(roleKelolaPengaturan()) || bolehAkses(roleKelolaUser())): ?> <a href="index.php?page=pengaturan" class="nav-link"></a> <?php endif; ?>
            </div>

            <div class="nav-user">
                <span class="user-info">
                    <span class="user-name"></span>
                    <span class="user-role badge badge-"></span>
                </span>
                <a href="index.php?page=logout" class="btn btn-sm btn-danger" onclick="return confirm('Yakin ingin logout?')">Keluar</a>
            </div>
            <?php endif; ?>
        </div>
    </div>
</nav>

<main class="main-content">
    <=php echo getFlash(); ?>
