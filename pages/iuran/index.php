<?php
/**
 * IURAN — Daftar Periode Tagihan
 * Route: index.php?page=iuran
 */

$db = getDB();

// Periode terbaru untuk ringkasan cepat
$periode = $db->query("SELECT * FROM periode_tagihan ORDER BY id DESC LIMIT 1")->fetch();

// Hitung statistik tiap periode
$periodeList = $db->query("SELECT * FROM periode_tagihan ORDER BY id DESC LIMIT 24")->fetchAll();

$ringkasan = [];
foreach ($periodeList as $p) {
    $pl = (int)$p['id'];
    $totalTagihan = (int)dbFetchColumn($db, "SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=?", [$pl]);
    $lunas = (int)dbFetchColumn($db, "SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=? AND status='lunas'", [$pl]);
    $menunggu = (int)dbFetchColumn($db, "SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=? AND status='menunggu_konfirmasi'", [$pl]);
    $belum = (int)dbFetchColumn($db, "SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=? AND status='belum_bayar'", [$pl]);
    $terkumpul = (int)dbFetchColumn($db, "SELECT COALESCE(SUM(nominal),0) FROM tagihan_iuran WHERE periode_id=? AND status='lunas'", [$pl]);
    $target = (int)dbFetchColumn($db, "SELECT COALESCE(SUM(nominal),0) FROM tagihan_iuran WHERE periode_id=?", [$pl]);
    $ringkasan[$pl] = compact('totalTagihan', 'lunas', 'menunggu', 'belum', 'terkumpul', 'target');
}

$r = $ringkasan[(int)($periode['id'] ?? 0)] ?? null;
$persen = ($r && $r['target'] > 0) ? round($r['terkumpul'] / $r['target'] * 100) : 0;
?>

<div class="card-header">
    <div>
        <h2>💰 Iuran Anggota</h2>
        <p class="text-muted" style="font-size:.87rem;">Tagihan iuran per periode dan status pembayaran anggota.</p>
    </div>
    <div class="btn-group">
        <?php if (bolehAkses(roleGenerateTagihan())): ?>
            <a href="index.php?page=iuran-generate" class="btn btn-primary">➕ Generate Tagihan</a>
        <?php endif; ?>
        <a href="index.php?page=iuran-tunggakan" class="btn btn-outline">⚠️ Tunggakan</a>
    </div>
</div>

<?php if ($periode && $r): ?>
<div class="card">
    <div class="flex-between" style="margin-bottom:14px;align-items:flex-start;">
        <div>
            <div class="card-title" style="margin-bottom:4px;">📆 Periode Terbaru</div>
            <div class="text-muted" style="font-size:.85rem;">
                <?= formatTanggal($periode['tgl_mulai']) ?> — <?= formatTanggal($periode['tgl_selesai']) ?>
                · <?= (int)$periode['jml_hari'] ?> hari · <?= formatRupiah($periode['nominal']) ?>/anggota
            </div>
        </div>
        <a href="index.php?page=iuran-detail&id=<?= (int)$periode['id'] ?>" class="btn btn-sm btn-outline">Detail Periode →</a>
    </div>

    <div class="stat-grid" style="margin-bottom:14px;">
        <div class="stat-card">
            <div class="stat-icon green">✅</div>
            <div class="stat-content"><h4>Lunas</h4><div class="stat-value"><?= $r['lunas'] ?></div><div class="stat-sub">anggota</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon yellow">⏳</div>
            <div class="stat-content"><h4>Menunggu</h4><div class="stat-value"><?= $r['menunggu'] ?></div><div class="stat-sub">konfirmasi</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon red">❌</div>
            <div class="stat-content"><h4>Belum Bayar</h4><div class="stat-value"><?= $r['belum'] ?></div><div class="stat-sub">anggota</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon blue">💰</div>
            <div class="stat-content"><h4>Terkumpul</h4><div class="stat-value" style="font-size:1.05rem;"><?= formatRupiah($r['terkumpul']) ?></div><div class="stat-sub">dari <?= formatRupiah($r['target']) ?></div></div>
        </div>
    </div>

    <div class="progress-track"><div class="progress-fill" style="width:<?= $persen ?>%"></div></div>
    <div class="flex-between" style="margin-top:6px;font-size:.8rem;color:var(--slate-500);">
        <span><?= $persen ?>% terkumpul</span>
        <span><?= $r['lunas'] ?>/<?= $r['totalTagihan'] ?> tagihan lunas</span>
    </div>
</div>
<?php endif; ?>

<div class="card">
    <div class="card-title">📚 Semua Periode Tagihan</div>
    <?php if (!empty($periodeList)): ?>
        <div class="table-container">
            <table>
                <thead>
                    <tr><th>Periode</th><th>Hari</th><th>Nominal/Orang</th><th>Tagihan</th><th>Lunas</th><th>Terkumpul</th><th>Progress</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                <?php foreach ($periodeList as $p): $x = $ringkasan[(int)$p['id']]; ?>
                    <?php $pct = $x['target'] > 0 ? round($x['terkumpul'] / $x['target'] * 100) : 0; ?>
                    <tr>
                        <td style="font-size:.83rem;white-space:nowrap;"><?= formatTanggalPendek($p['tgl_mulai']) ?> — <?= formatTanggalPendek($p['tgl_selesai']) ?></td>
                        <td><?= (int)$p['jml_hari'] ?></td>
                        <td><?= formatRupiah($p['nominal']) ?></td>
                        <td><?= $x['totalTagihan'] ?></td>
                        <td><span class="badge badge-green"><?= $x['lunas'] ?></span></td>
                        <td style="font-size:.84rem;"><?= formatRupiah($x['terkumpul']) ?></td>
                        <td style="min-width:110px;">
                            <div class="progress-track" style="height:7px;margin:0;"><div class="progress-fill" style="width:<?= $pct ?>%"></div></div>
                            <span style="font-size:.72rem;color:var(--slate-500);"><?= $pct ?>%</span>
                        </td>
                        <td>
                            <a href="index.php?page=iuran-detail&id=<?= (int)$p['id'] ?>" class="btn btn-sm btn-outline">Detail</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <div class="empty-icon">📭</div>
            <h3>Belum ada periode tagihan</h3>
            <p>Buat periode tagihan pertama untuk mulai menagih iuran.</p>
            <?php if (bolehAkses(roleGenerateTagihan())): ?>
                <a href="index.php?page=iuran-generate" class="btn btn-primary mt-2">➕ Generate Tagihan</a>
            <?php endif; ?>
        </div>
    <?php endif; ?>
</div>
