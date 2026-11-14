<?php
/**
 * PENGATURAN — Indeks
 * Route: index.php?page=pengaturan
 */

$pengaturan = getAllPengaturan();
$namaOrg = $pengaturan['nama_organisasi'] ?? 'Remaja Ertiga';
$db = getDB();

$jmlUser = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
$jmlPeriode = (int)$db->query("SELECT COUNT(*) FROM periode_tagihan")->fetchColumn();
$jmlMetode = (int)$db->query("SELECT COUNT(*) FROM metode_pembayaran")->fetchColumn();
?>

<div class="card-header">
    <div>
        <h2>⚙️ Pengaturan</h2>
        <p class="text-muted" style="font-size:.87rem;">Konfigurasi organisasi, iuran, periode, dan pengguna.</p>
    </div>
</div>

<div class="grid-2">
    <div class="card">
        <div class="card-title">🏘️ Profil Organisasi</div>
        <div class="detail-list">
            <div class="detail-row"><span>Nama Organisasi</span><span><?= htmlspecialchars($namaOrg) ?></span></div>
            <div class="detail-row"><span>Dukuh / RT / RW</span><span>
                <?= htmlspecialchars(trim(($pengaturan['dukuh'] ?? '-') . ' RT ' . ($pengaturan['rt'] ?? '-') . ' / RW ' . ($pengaturan['rw'] ?? '-'))) ?>
            </span></div>
            <div class="detail-row"><span>Desa / Kecamatan</span><span><?= htmlspecialchars(($pengaturan['desa'] ?? '-') . ' / ' . ($pengaturan['kecamatan'] ?? '-')) ?></span></div>
            <div class="detail-row"><span>Kabupaten / Provinsi</span><span><?= htmlspecialchars(($pengaturan['kabupaten'] ?? '-') . ' / ' . ($pengaturan['provinsi'] ?? '-')) ?></span></div>
            <div class="detail-row"><span>Nominal Iuran / Hari</span><span><?= formatRupiah((int)($pengaturan['nominal_per_hari'] ?? 0)) ?></span></div>
        </div>
        <?php if (bolehAkses(roleKelolaPengaturan())): ?>
            <div class="mt-2"><a href="index.php?page=pengaturan-profil" class="btn btn-primary btn-sm">✏️ Ubah Profil</a></div>
        <?php endif; ?>
    </div>

    <div class="card">
        <div class="card-title">🔗 Menu Pengaturan</div>
        <div class="detail-list">
            <?php if (bolehAkses(roleKelolaPengaturan())): ?>
                <a class="detail-row" href="index.php?page=pengaturan-profil" style="text-decoration:none;"><span>🏘️ Profil Organisasi</span><span>Buka →</span></a>
                <a class="detail-row" href="index.php?page=pengaturan-iuran" style="text-decoration:none;"><span>💰 Pengaturan Iuran</span><span>Buka →</span></a>
                <a class="detail-row" href="index.php?page=pengaturan-periode" style="text-decoration:none;"><span>📆 Periode Kepengurusan (<?= $jmlPeriode ?>)</span><span>Buka →</span></a>
            <?php endif; ?>
            <?php if (bolehAkses(roleKelolaUser())): ?>
                <a class="detail-row" href="index.php?page=pengaturan-users" style="text-decoration:none;"><span>👤 Pengguna (<?= $jmlUser ?>)</span><span>Buka →</span></a>
            <?php endif; ?>
            <a class="detail-row" href="index.php?page=metode" style="text-decoration:none;"><span>💳 Metode Pembayaran (<?= $jmlMetode ?>)</span><span>Buka →</span></a>
        </div>
    </div>
</div>

<div class="card">
    <div class="card-title">ℹ️ Informasi Sistem</div>
    <div class="detail-list">
        <div class="detail-row"><span>Versi Aplikasi</span><span>1.0.0</span></div>
        <div class="detail-row"><span>PHP</span><span><?= PHP_VERSION ?></span></div>
        <div class="detail-row"><span>Mode Database</span><span><?= (getenv('VERCEL') || getenv('VERCEL_ENV')) ? 'Supabase (Vercel)' : 'SQLite (Lokal)' ?></span></div>
        <div class="detail-row"><span>Login Sebagai</span><span><?= htmlspecialchars($_SESSION['user']['nama']) ?> — <?= labelRole($_SESSION['user']['role']) ?></span></div>
    </div>
</div>
