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

        <?php if (isLoggedIn()): ?>
        <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">
            <span></span><span></span><span></span>
        </button>
        <?php endif; ?>

        <div class="nav-menu" id="navMenu">
            <?php if (isLoggedIn()): ?>
            <div class="nav-links">
                <a href="index.php?page=dashboard" class="nav-link <?= ($_GET['page'] ?? '') === 'dashboard' ? 'active' : '' ?>">
                    📊 Dashboard
                </a>

                <?php if (bolehAkses(array_merge(roleKelolaAnggota(), ['super_admin']))): ?>
                <a href="index.php?page=anggota" class="nav-link <?= str_starts_with($_GET['page'] ?? '', 'anggota') ? 'active' : '' ?>">
                    👥 Anggota
                </a>
                <?php endif; ?>

                <?php if (bolehAkses(array_merge(roleGenerateTagihan(), roleTandaiLunas()))): ?>
                <a href="index.php?page=iuran" class="nav-link <?= str_starts_with($_GET['page'] ?? '', 'iuran') ? 'active' : '' ?>">
                    💰 Iuran
                </a>
                <?php endif; ?>

                <?php if (bolehAkses(roleKonfirmasiBayar())): ?>
                <a href="index.php?page=konfirmasi" class="nav-link <?= str_starts_with($_GET['page'] ?? '', 'konfirmasi') ? 'active' : '' ?>">
                    ✅ Konfirmasi
                </a>
                <?php endif; ?>

                <?php if (bolehAkses(roleKelolaKeuangan())): ?>
                <a href="index.php?page=pemasukan" class="nav-link <?= str_starts_with($_GET['page'] ?? '', 'pemasukan') ? 'active' : '' ?>">
                    📥 Kas Masuk
                </a>
                <a href="index.php?page=pengeluaran" class="nav-link <?= str_starts_with($_GET['page'] ?? '', 'pengeluaran') ? 'active' : '' ?>">
                    📤 Kas Keluar
                </a>
                <?php endif; ?>

                <a href="index.php?page=kegiatan" class="nav-link <?= str_starts_with($_GET['page'] ?? '', 'kegiatan') ? 'active' : '' ?>">
                    📅 Kegiatan
                </a>

                <a href="index.php?page=laporan" class="nav-link <?= str_starts_with($_GET['page'] ?? '', 'laporan') ? 'active' : '' ?>">
                    📋 Laporan
                </a>

                <?php if (bolehAkses(roleTandaiLunas())): ?>
                <a href="index.php?page=notifikasi" class="nav-link <?= str_starts_with($_GET['page'] ?? '', 'notifikasi') ? 'active' : '' ?>">
                    📢 Notifikasi
                </a>
                <?php endif; ?>

                <?php if (bolehAkses(roleKelolaPengaturan()) || bolehAkses(roleKelolaUser())): ?>
                <a href="index.php?page=pengaturan" class="nav-link <?= str_starts_with($_GET['page'] ?? '', 'pengaturan') ? 'active' : '' ?>">
                    ⚙️ Pengaturan
                </a>
                <?php endif; ?>
            </div>

            <div class="nav-user">
                <span class="user-info">
                    <span class="user-name"><?= htmlspecialchars($_SESSION['user']['nama']) ?></span>
                    <span class="user-role badge badge-<?= warnaRole($_SESSION['user']['role']) ?>">
                        <?= labelRole($_SESSION['user']['role']) ?>
                    </span>
                </span>
                <a href="index.php?page=logout" class="btn btn-sm btn-danger" onclick="return confirm('Yakin ingin logout?')">Keluar</a>
            </div>
            <?php endif; ?>
        </div>
    </div>
</nav>

<main class="main-content">
    <?= getFlash() ?>
