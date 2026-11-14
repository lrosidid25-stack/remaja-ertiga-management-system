<?php
/**
 * LAPORAN — Rekap Iuran
 * Route: index.php?page=laporan-rekap-iuran
 */

$db = getDB();

// Ekspor CSV
if (isset($_GET['ekspor']) && $_GET['ekspor'] === '1') {
    $periodeCsv = (int)($_GET['periode'] ?? 0);
    if ($periodeCsv > 0) {
        $stmt = $db->prepare("SELECT a.nir, a.nama, t.nominal, t.status, t.tgl_bayar, t.metode
            FROM tagihan_iuran t JOIN anggota a ON t.anggota_id = a.id
            WHERE t.periode_id = ? ORDER BY a.nama");
        $stmt->execute([$periodeCsv]);
        $rows = array_map(fn($r) => [$r['nir'], $r['nama'], $r['nominal'], $r['status'], $r['tgl_bayar'], $r['metode']], $stmt->fetchAll());
        downloadCSV("rekap-iuran-periode-{$periodeCsv}", ['NIR', 'Nama', 'Nominal', 'Status', 'Tgl Bayar', 'Metode'], $rows);
    }
    $rows = [];
    $per = $db->query("SELECT p.*, 
        (SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=p.id) AS jml,
        (SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=p.id AND status='lunas') AS lunas,
        (SELECT COALESCE(SUM(nominal),0) FROM tagihan_iuran WHERE periode_id=p.id AND status='lunas') AS terkumpul,
        (SELECT COALESCE(SUM(nominal),0) FROM tagihan_iuran WHERE periode_id=p.id) AS target
        FROM periode_tagihan p ORDER BY p.id DESC")->fetchAll();
    foreach ($per as $p) {
        $rows[] = [
            formatTanggalPendek($p['tgl_mulai']) . ' — ' . formatTanggalPendek($p['tgl_selesai']),
            $p['jml_hari'], $p['nominal'], $p['jml'], $p['lunas'], $p['terkumpul'], $p['target'],
        ];
    }
    downloadCSV('rekap-iuran', ['Periode', 'Hari', 'Nominal/Orang', 'Jumlah Tagihan', 'Lunas', 'Terkumpul', 'Target'], $rows);
}

$periode = (int)($_GET['periode'] ?? 0);
$periodeList = $db->query("SELECT * FROM periode_tagihan ORDER BY id DESC")->fetchAll();
if ($periode === 0 && !empty($periodeList)) {
    $periode = (int)$periodeList[0]['id'];
}

$ringkasan = $db->query("SELECT p.*, 
    (SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=p.id) AS jml,
    (SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=p.id AND status='lunas') AS lunas,
    (SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=p.id AND status='menunggu_konfirmasi') AS menunggu,
    (SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=p.id AND status='belum_bayar') AS belum,
    (SELECT COALESCE(SUM(nominal),0) FROM tagihan_iuran WHERE periode_id=p.id AND status='lunas') AS terkumpul,
    (SELECT COALESCE(SUM(nominal),0) FROM tagihan_iuran WHERE periode_id=p.id) AS target
    FROM periode_tagihan p ORDER BY p.id DESC")->fetchAll();

$detail = [];
$periodeTerpilih = null;
if ($periode > 0) {
    foreach ($periodeList as $p) if ((int)$p['id'] === $periode) $periodeTerpilih = $p;
    $stmt = $db->prepare("SELECT t.*, a.nir, a.nama FROM tagihan_iuran t JOIN anggota a ON t.anggota_id=a.id
        WHERE t.periode_id = ? ORDER BY a.nama");
    $stmt->execute([$periode]);
    $detail = $stmt->fetchAll();
}
$totalTerkumpul = 0; $totalTarget = 0;
foreach ($ringkasan as $r) { $totalTerkumpul += (int)$r['terkumpul']; $totalTarget += (int)$r['target']; }
?>

<div class="card-header no-print">
    <div>
        <h2>🧮 Rekap Iuran</h2>
        <p class="text-muted" style="font-size:.87rem;">Rekapitulasi penerimaan iuran seluruh periode.</p>
    </div>
    <div class="btn-group">
        <button class="btn btn-primary" data-print>🖨️ Cetak</button>
        <a href="index.php?page=laporan" class="btn btn-outline">← Laporan</a>
    </div>
</div>

<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-icon blue">📆</div>
        <div class="stat-content"><h4>Total Periode</h4><div class="stat-value"><?= count($ringkasan) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon green">💰</div>
        <div class="stat-content"><h4>Total Terkumpul</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalTerkumpul) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon yellow">🎯</div>
        <div class="stat-content"><h4>Total Target</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalTarget) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon red">📉</div>
        <div class="stat-content"><h4>Belum Terkumpul</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah(max(0, $totalTarget - $totalTerkumpul)) ?></div></div>
    </div>
</div>

<div class="card">
    <div class="card-title">📚 Rekap Seluruh Periode</div>
    <?php if (!empty($ringkasan)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>Periode</th><th>Hari</th><th>Nominal/Orang</th><th>Tagihan</th><th>Lunas</th><th>Terkumpul</th><th>Target</th><th>Capaian</th></tr></thead>
                <tbody>
                <?php foreach ($ringkasan as $r): $pct = (int)$r['target'] > 0 ? round((int)$r['terkumpul'] / (int)$r['target'] * 100) : 0; ?>
                    <tr>
                        <td style="font-size:.83rem;white-space:nowrap;"><?= formatTanggalPendek($r['tgl_mulai']) ?> — <?= formatTanggalPendek($r['tgl_selesai']) ?></td>
                        <td><?= (int)$r['jml_hari'] ?></td>
                        <td><?= formatRupiah($r['nominal']) ?></td>
                        <td><?= (int)$r['jml'] ?></td>
                        <td><span class="badge badge-green"><?= (int)$r['lunas'] ?></span></td>
                        <td><?= formatRupiah($r['terkumpul']) ?></td>
                        <td><?= formatRupiah($r['target']) ?></td>
                        <td style="min-width:100px;">
                            <div class="progress-track" style="height:7px;margin:0;"><div class="progress-fill" style="width:<?= $pct ?>%"></div></div>
                            <span style="font-size:.72rem;color:var(--slate-500);"><?= $pct ?>%</span>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state"><div class="empty-icon">📭</div><h3>Belum ada periode</h3><p>Generate tagihan terlebih dahulu.</p></div>
    <?php endif; ?>
</div>

<div class="card no-print">
    <form method="get" action="index.php" class="flex-between" style="gap:10px;align-items:flex-end;">
        <input type="hidden" name="page" value="laporan-rekap-iuran">
        <div style="flex:1;min-width:240px;">
            <label class="form-label">Detail per Periode</label>
            <select name="periode" onchange="this.form.submit()">
                <?php foreach ($periodeList as $p): ?>
                    <option value="<?= (int)$p['id'] ?>" <?= (int)$p['id'] === $periode ? 'selected' : '' ?>>
                        <?= formatTanggalPendek($p['tgl_mulai']) ?> — <?= formatTanggalPendek($p['tgl_selesai']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="btn-group">
            <a class="btn btn-outline" href="index.php?page=laporan-rekap-iuran&ekspor=1">⬇️ CSV Semua Periode</a>
            <?php if ($periode > 0): ?>
                <a class="btn btn-outline" href="index.php?page=laporan-rekap-iuran&periode=<?= $periode ?>&ekspor=1">⬇️ CSV Periode Ini</a>
            <?php endif; ?>
        </div>
    </form>
</div>

<?php if ($periodeTerpilih): ?>
<div class="card">
    <div class="card-title">
        🧾 Detail <?= formatTanggalPendek($periodeTerpilih['tgl_mulai']) ?> — <?= formatTanggalPendek($periodeTerpilih['tgl_selesai']) ?>
        (<?= formatRupiah($periodeTerpilih['nominal']) ?>/anggota)
    </div>
    <?php if (!empty($detail)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>NIR</th><th>Nama</th><th>Nominal</th><th>Status</th><th>Tgl Bayar</th><th>Metode</th></tr></thead>
                <tbody>
                <?php foreach ($detail as $d): ?>
                    <tr>
                        <td style="font-family:ui-monospace,monospace;font-size:.8rem;"><?= htmlspecialchars($d['nir']) ?></td>
                        <td><?= htmlspecialchars($d['nama']) ?></td>
                        <td><?= formatRupiah($d['nominal']) ?></td>
                        <td>
                            <?= match ($d['status']) {
                                'lunas' => '<span class="badge badge-green">Lunas</span>',
                                'menunggu_konfirmasi' => '<span class="badge badge-yellow">Menunggu</span>',
                                'ditolak' => '<span class="badge badge-gray">Ditolak</span>',
                                default => '<span class="badge badge-red">Belum Bayar</span>',
                            } ?>
                        </td>
                        <td style="font-size:.82rem;"><?= $d['tgl_bayar'] ? formatTanggalPendek($d['tgl_bayar']) : '-' ?></td>
                        <td style="font-size:.82rem;"><?= htmlspecialchars($d['metode'] ?: '-') ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state"><p>Belum ada tagihan pada periode ini.</p></div>
    <?php endif; ?>
</div>
<?php endif; ?>
