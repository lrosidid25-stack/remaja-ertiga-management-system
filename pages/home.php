<?php
/**
 * HALAMAN PUBLIK — Cek Iuran (tanpa login)
 * Route: index.php (page=home) dan index.php?page=cek
 */

$pengaturan = getAllPengaturan();
$namaOrg = ($pengaturan['nama_organisasi'] ?? '') ?: 'Remaja Ertiga';

// Alamat organisasi
$alamatParts = array_filter([
    $pengaturan['dukuh'] ?? '',
    !empty($pengaturan['rt']) ? 'RT ' . $pengaturan['rt'] : '',
    !empty($pengaturan['rw']) ? 'RW ' . $pengaturan['rw'] : '',
    $pengaturan['desa'] ?? '',
    $pengaturan['kecamatan'] ?? '',
    $pengaturan['kabupaten'] ?? '',
    $pengaturan['provinsi'] ?? '',
]);
$alamatOrg = implode(', ', $alamatParts);

$nir = trim($_GET['nir'] ?? '');
$hasil = null;
$error = '';
$sudahCek = false;

if ($nir !== '') {
    $sudahCek = true;
    if (!preg_match('/^[0-9A-Za-z]{6,20}$/', $nir)) {
        $error = 'Format NIR tidak valid. NIR terdiri dari 6–20 karakter angka/huruf.';
    } else {
        $hasil = getStatusIuranByNIR($nir);
        if ($hasil === null) {
            $error = 'NIR tidak ditemukan. Periksa kembali nomor NIR Anda atau hubungi pengurus.';
        }
    }
}

$metodeList = [];
try {
    $metodeList = getDB()->query("SELECT * FROM metode_pembayaran WHERE aktif = 1 ORDER BY urutan, id")->fetchAll();
} catch (Throwable $e) {
    $metodeList = [];
}

function statusBadgePub(string $status): string {
    return match ($status) {
        'lunas' => '<span class="badge badge-green">✅ Lunas</span>',
        'menunggu_konfirmasi' => '<span class="badge badge-yellow">⏳ Menunggu Konfirmasi</span>',
        'ditolak' => '<span class="badge badge-red">❌ Ditolak</span>',
        default => '<span class="badge badge-gray">Belum Bayar</span>',
    };
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($namaOrg) ?> — Cek Iuran Anggota</title>
    <meta name="description" content="Cek status iuran anggota <?= htmlspecialchars($namaOrg) ?> dengan NIR Anda.">
    <link rel="stylesheet" href="assets/css/style.css?v=1">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏘️</text></svg>">
</head>
<body>

<!-- NAVBAR PUBLIK -->
<nav class="navbar">
    <div class="nav-container">
        <a href="index.php" class="nav-brand">
            <span class="brand-icon">🏘️</span>
            <span class="brand-text"><?= htmlspecialchars($namaOrg) ?></span>
        </a>
        <div class="nav-menu" style="justify-content:flex-end;">
            <div class="nav-links">
                <a href="index.php" class="nav-link active">Cek Iuran</a>
                <a href="index.php?page=login" class="nav-link">Login Pengurus</a>
            </div>
        </div>
    </div>
</nav>

<!-- HERO -->
<header class="hero">
    <span class="hero-badge">🌿 Sistem Informasi Organisasi</span>
    <h1>Cek Iuran Anggota<br><?= htmlspecialchars($namaOrg) ?></h1>
    <p>Masukkan NIR (Nomor Induk Remaja) Anda untuk melihat status iuran periode terbaru dan riwayat pembayaran.</p>
    <?php if ($alamatOrg): ?>
        <p style="margin-top:10px;font-size:.85rem;opacity:.85;">📍 <?= htmlspecialchars($alamatOrg) ?></p>
    <?php endif; ?>
    <div class="hero-actions">
        <a href="#cek-iuran" class="btn btn-primary btn-lg">🔍 Cek Iuran Sekarang</a>
        <a href="index.php?page=login" class="btn btn-outline btn-lg">Login Pengurus</a>
    </div>
</header>

<!-- FORM CEK -->
<section class="public-section" id="cek-iuran">
    <div class="card" style="box-shadow: var(--shadow-lg);">
        <div class="card-title">🔍 Cek Status Iuran</div>

        <?php if (isset($_GET['page']) && $_GET['page'] === 'cek'): ?>
            <div class="alert alert-blue">Halaman cek iuran juga bisa diakses langsung di <strong>index.php?page=cek</strong>.</div>
        <?php endif; ?>

        <form method="get" action="index.php" class="mb-2">
            <input type="hidden" name="page" value="cek">
            <div class="form-group">
                <label class="form-label" for="nir">Nomor Induk Remaja (NIR)</label>
                <input type="text" id="nir" name="nir" inputmode="numeric" autocomplete="off"
                       placeholder="Contoh: 001234567890" value="<?= htmlspecialchars($nir) ?>" required>
                <div class="form-hint">NIR bisa dilihat pada kartu anggota atau ditanyakan ke sekretaris.</div>
            </div>
            <div class="btn-group">
                <button type="submit" class="btn btn-primary">🔍 Cek Iuran</button>
                <?php if ($sudahCek): ?>
                    <a href="index.php" class="btn btn-outline">Reset</a>
                <?php endif; ?>
            </div>
        </form>

        <?php if ($error): ?>
            <div class="alert alert-red"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <?php if ($hasil): ?>
            <?php $anggota = $hasil['anggota']; $periode = $hasil['periode']; $tagihan = $hasil['tagihan']; ?>

            <div style="border-top:1px solid var(--slate-200);padding-top:20px;">
                <div class="flex-between mb-2">
                    <div>
                        <div style="font-weight:800;font-size:1.1rem;color:var(--slate-900);"><?= htmlspecialchars($anggota['nama']) ?></div>
                        <div class="text-muted" style="font-size:.82rem;font-family:ui-monospace,monospace;">NIR <?= htmlspecialchars($anggota['nir']) ?></div>
                    </div>
                    <span class="badge badge-<?= $anggota['status'] === 'aktif' ? 'green' : 'gray' ?>">
                        <?= $anggota['status'] === 'aktif' ? 'Anggota Aktif' : ucfirst($anggota['status']) ?>
                    </span>
                </div>

                <?php if ($periode): ?>
                    <div style="background:var(--slate-50);border:1px solid var(--slate-200);border-radius:12px;padding:16px;margin-bottom:16px;">
                        <div class="flex-between" style="margin-bottom:8px;">
                            <div style="font-weight:700;font-size:.9rem;">📆 Periode Terbaru</div>
                            <div class="text-muted" style="font-size:.8rem;">
                                <?= formatTanggalPendek($periode['tgl_mulai']) ?> — <?= formatTanggalPendek($periode['tgl_selesai']) ?>
                                (<?= (int)$periode['jml_hari'] ?> hari)
                            </div>
                        </div>
                        <?php if ($tagihan): ?>
                            <div class="detail-list">
                                <div class="detail-row"><span>Nominal tagihan</span><span><?= formatRupiah($tagihan['nominal']) ?></span></div>
                                <div class="detail-row"><span>Status</span><span><?= statusBadgePub($tagihan['status']) ?></span></div>
                                <div class="detail-row"><span>Tanggal bayar</span><span><?= $tagihan['tgl_bayar'] ? formatTanggal($tagihan['tgl_bayar']) : '-' ?></span></div>
                                <?php if (!empty($tagihan['keterangan'])): ?>
                                    <div class="detail-row"><span>Keterangan</span><span><?= htmlspecialchars($tagihan['keterangan']) ?></span></div>
                                <?php endif; ?>
                            </div>
                        <?php else: ?>
                            <div class="alert alert-yellow" style="margin:0;">Tagihan untuk periode ini belum dibuat untuk NIR Anda. Hubungi bendahara bila seharusnya sudah ada.</div>
                        <?php endif; ?>
                    </div>
                <?php else: ?>
                    <div class="alert alert-yellow">Belum ada periode tagihan yang dibuka pengurus.</div>
                <?php endif; ?>

                <?php if (!empty($hasil['riwayat'])): ?>
                    <div class="card-title" style="margin-top:18px;">🧾 Riwayat Pembayaran</div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr><th>Periode</th><th>Nominal</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                            <?php foreach ($hasil['riwayat'] as $r): ?>
                                <tr>
                                    <td style="font-size:.83rem;"><?= formatTanggalPendek($r['tgl_mulai']) ?> — <?= formatTanggalPendek($r['tgl_selesai']) ?></td>
                                    <td><?= formatRupiah($r['nominal']) ?></td>
                                    <td><?= statusBadgePub($r['status']) ?></td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php endif; ?>
            </div>
        <?php elseif ($sudahCek && !$error): ?>
            <div class="empty-state" style="padding:20px;"><p>Tidak ada data untuk NIR tersebut.</p></div>
        <?php endif; ?>
    </div>
</section>

<!-- CARA BAYAR -->
<?php if (!empty($metodeList)): ?>
<section class="section-features">
    <h2 style="font-size:1.15rem;font-weight:800;letter-spacing:-.02em;margin-bottom:14px;">💳 Metode Pembayaran</h2>
    <div class="grid-3">
        <?php foreach ($metodeList as $m): ?>
            <div class="feature-card">
                <div class="f-icon"><?= match($m['jenis']) { 'tunai' => '💵', 'transfer' => '🏦', 'qris' => '📱', 'e-wallet' => '📲', default => '💳' } ?></div>
                <h3><?= htmlspecialchars($m['nama']) ?></h3>
                <?php if (!empty($m['nomor'])): ?>
                    <p style="font-family:ui-monospace,monospace;font-weight:700;color:var(--slate-800);"><?= htmlspecialchars($m['nomor']) ?></p>
                <?php endif; ?>
                <?php if (!empty($m['atas_nama'])): ?>
                    <p>a.n. <?= htmlspecialchars($m['atas_nama']) ?></p>
                <?php endif; ?>
            </div>
        <?php endforeach; ?>
    </div>
</section>
<?php endif; ?>

<!-- FITUR -->
<section class="section-features">
    <div class="grid-3">
        <div class="feature-card">
            <div class="f-icon">👥</div>
            <h3>Data Anggota</h3>
            <p>Pengurus mengelola data seluruh anggota secara rapi dan terpusat.</p>
        </div>
        <div class="feature-card">
            <div class="f-icon">💰</div>
            <h3>Iuran Transparan</h3>
            <p>Tagihan per periode dibuat otomatis, status pembayaran terbuka untuk anggota.</p>
        </div>
        <div class="feature-card">
            <div class="f-icon">📊</div>
            <h3>Laporan Keuangan</h3>
            <p>Kas masuk dan keluar tercatat, rekap bulanan serta tahunan mudah dicetak.</p>
        </div>
    </div>
</section>

<footer class="footer">
    <div class="footer-container">
        <div class="footer-top">
            <div class="footer-brand">
                <h3>🏘️ <?= htmlspecialchars($namaOrg) ?></h3>
                <p><?= $alamatOrg ? htmlspecialchars($alamatOrg) : 'Sistem manajemen organisasi remaja.' ?></p>
            </div>
            <div class="footer-links">
                <h4>Link Publik</h4>
                <a href="index.php">Cek Iuran</a>
                <a href="index.php?page=login">Login Pengurus</a>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; <?= date('Y') ?> <?= htmlspecialchars($namaOrg) ?>. Dibuat dengan ❤️ untuk kemajuan organisasi.</p>
        </div>
    </div>
</footer>

<script src="assets/js/app.js?v=1"></script>
</body>
</html>
