<?php
/**
 * LAPORAN — Rekap Bulanan
 * Route: index.php?page=laporan-bulanan
 */

$db = getDB();

$bulan = $_GET['bulan'] ?? date('Y-m');
if (!preg_match('/^\d{4}-\d{2}$/', $bulan)) {
    $bulan = date('Y-m');
}
$awal = $bulan . '-01';
$akhir = date('Y-m-t', strtotime($awal));

$stmt = $db->prepare("SELECT p.*, k.nama AS kategori FROM pemasukan p LEFT JOIN kategori_pemasukan k ON p.kategori_id=k.id
    WHERE p.tanggal BETWEEN ? AND ? ORDER BY p.tanggal");
$stmt->execute([$awal, $akhir]);
$pemasukan = $stmt->fetchAll();

$stmt = $db->prepare("SELECT p.*, k.nama AS kategori FROM pengeluaran p LEFT JOIN kategori_pengeluaran k ON p.kategori_id=k.id
    WHERE p.tanggal BETWEEN ? AND ? ORDER BY p.tanggal");
$stmt->execute([$awal, $akhir]);
$pengeluaran = $stmt->fetchAll();

$totalMasuk = array_sum(array_map(fn($r) => (int)$r['nominal'], $pemasukan));
$totalKeluar = array_sum(array_map(fn($r) => (int)$r['nominal'], $pengeluaran));

// Rekap per kategori
$rekapMasuk = [];
foreach ($pemasukan as $p) {
    $k = $p['kategori'] ?: 'Tanpa kategori';
    $rekapMasuk[$k] = ($rekapMasuk[$k] ?? 0) + (int)$p['nominal'];
}
$rekapKeluar = [];
foreach ($pengeluaran as $p) {
    $k = $p['kategori'] ?: 'Tanpa kategori';
    $rekapKeluar[$k] = ($rekapKeluar[$k] ?? 0) + (int)$p['nominal'];
}
arsort($rekapMasuk);
arsort($rekapKeluar);

$namaBulan = ['01' => 'Januari', '02' => 'Februari', '03' => 'Maret', '04' => 'April', '05' => 'Mei', '06' => 'Juni',
    '07' => 'Juli', '08' => 'Agustus', '09' => 'September', '10' => 'Oktober', '11' => 'November', '12' => 'Desember'];
$labelBulan = ($namaBulan[substr($bulan, 5, 2)] ?? $bulan) . ' ' . substr($bulan, 0, 4);

// Ekspor CSV (harus sebelum output HTML apa pun)
if (isset($_GET['ekspor'])) {
    if ($_GET['ekspor'] === 'masuk') {
        $rows = array_map(fn($r) => [$r['tanggal'], $r['kategori'] ?? '', $r['sumber'] ?? '', $r['nominal'], $r['keterangan'] ?? ''], $pemasukan);
        downloadCSV("pemasukan-{$bulan}", ['Tanggal', 'Kategori', 'Sumber', 'Nominal', 'Keterangan'], $rows);
    } elseif ($_GET['ekspor'] === 'keluar') {
        $rows = array_map(fn($r) => [$r['tanggal'], $r['kategori'] ?? '', $r['keperluan'] ?? '', $r['nominal'], $r['keterangan'] ?? ''], $pengeluaran);
        downloadCSV("pengeluaran-{$bulan}", ['Tanggal', 'Kategori', 'Keperluan', 'Nominal', 'Keterangan'], $rows);
    }
}

$pengaturan = getAllPengaturan();
$namaOrg = $pengaturan['nama_organisasi'] ?: 'Remaja Ertiga';
?>

<div class="card-header no-print">
    <div>
        <h2>📅 Laporan Bulanan</h2>
        <p class="text-muted" style="font-size:.87rem;">Rekap kas masuk dan keluar per bulan.</p>
    </div>
    <div class="btn-group">
        <button class="btn btn-primary" data-print>🖨️ Cetak</button>
        <a href="index.php?page=laporan" class="btn btn-outline">← Laporan</a>
    </div>
</div>

<div class="card no-print">
    <form method="get" action="index.php" class="flex-between" style="gap:10px;align-items:flex-end;">
        <input type="hidden" name="page" value="laporan-bulanan">
        <div style="min-width:200px;">
            <label class="form-label">Pilih Bulan</label>
            <input type="month" name="bulan" value="<?= htmlspecialchars($bulan) ?>">
        </div>
        <button type="submit" class="btn btn-primary">Tampilkan</button>
    </form>
</div>

<div class="card">
    <div style="text-align:center;margin-bottom:20px;">
        <h3 style="font-size:1.1rem;font-weight:800;"><?= htmlspecialchars($namaOrg) ?></h3>
        <p class="text-muted" style="font-size:.87rem;">Laporan Keuangan Bulan <?= htmlspecialchars($labelBulan) ?></p>
        <p class="text-muted" style="font-size:.78rem;">Periode: <?= formatTanggal($awal) ?> — <?= formatTanggal($akhir) ?></p>
    </div>

    <div class="stat-grid">
        <div class="stat-card">
            <div class="stat-icon green">📥</div>
            <div class="stat-content"><h4>Pemasukan</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalMasuk) ?></div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon red">📤</div>
            <div class="stat-content"><h4>Pengeluaran</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalKeluar) ?></div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon <?= ($totalMasuk - $totalKeluar) >= 0 ? 'blue' : 'yellow' ?>">⚖️</div>
            <div class="stat-content"><h4>Saldo Akhir</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalMasuk - $totalKeluar) ?></div></div>
        </div>
    </div>

    <div class="grid-2">
        <div>
            <div class="card-title">📥 Rincian Pemasukan</div>
            <?php if (!empty($pemasukan)): ?>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Nominal</th></tr></thead>
                        <tbody>
                        <?php foreach ($pemasukan as $p): ?>
                            <tr>
                                <td style="font-size:.8rem;white-space:nowrap;"><?= formatTanggalPendek($p['tanggal']) ?></td>
                                <td style="font-size:.83rem;"><?= htmlspecialchars(($p['kategori'] ? $p['kategori'] . ' — ' : '') . ($p['sumber'] ?: '-')) ?></td>
                                <td style="white-space:nowrap;"><?= formatRupiah($p['nominal']) ?></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                        <tfoot>
                            <tr style="background:var(--slate-50);">
                                <th colspan="2" style="text-align:right;padding:11px 14px;">Total</th>
                                <th style="padding:11px 14px;"><?= formatRupiah($totalMasuk) ?></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            <?php else: ?>
                <div class="empty-state" style="padding:20px;"><p>Tidak ada pemasukan bulan ini.</p></div>
            <?php endif; ?>
        </div>

        <div>
            <div class="card-title">📤 Rincian Pengeluaran</div>
            <?php if (!empty($pengeluaran)): ?>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Nominal</th></tr></thead>
                        <tbody>
                        <?php foreach ($pengeluaran as $p): ?>
                            <tr>
                                <td style="font-size:.8rem;white-space:nowrap;"><?= formatTanggalPendek($p['tanggal']) ?></td>
                                <td style="font-size:.83rem;"><?= htmlspecialchars(($p['kategori'] ? $p['kategori'] . ' — ' : '') . ($p['keperluan'] ?: '-')) ?></td>
                                <td style="white-space:nowrap;"><?= formatRupiah($p['nominal']) ?></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                        <tfoot>
                            <tr style="background:var(--slate-50);">
                                <th colspan="2" style="text-align:right;padding:11px 14px;">Total</th>
                                <th style="padding:11px 14px;"><?= formatRupiah($totalKeluar) ?></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            <?php else: ?>
                <div class="empty-state" style="padding:20px;"><p>Tidak ada pengeluaran bulan ini.</p></div>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php if (!empty($rekapMasuk) || !empty($rekapKeluar)): ?>
<div class="grid-2">
    <?php if (!empty($rekapMasuk)): ?>
    <div class="card">
        <div class="card-title">📊 Pemasukan per Kategori</div>
        <div class="detail-list">
            <?php foreach ($rekapMasuk as $k => $v): ?>
                <div class="detail-row"><span><?= htmlspecialchars($k) ?></span><span><?= formatRupiah($v) ?></span></div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>
    <?php if (!empty($rekapKeluar)): ?>
    <div class="card">
        <div class="card-title">📊 Pengeluaran per Kategori</div>
        <div class="detail-list">
            <?php foreach ($rekapKeluar as $k => $v): ?>
                <div class="detail-row"><span><?= htmlspecialchars($k) ?></span><span><?= formatRupiah($v) ?></span></div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>
</div>
<?php endif; ?>

<div class="card no-print">
    <div class="card-title">📤 Ekspor Data</div>
    <div class="btn-group">
        <a class="btn btn-outline" href="index.php?page=laporan-bulanan&bulan=<?= urlencode($bulan) ?>&ekspor=masuk">⬇️ CSV Pemasukan</a>
        <a class="btn btn-outline" href="index.php?page=laporan-bulanan&bulan=<?= urlencode($bulan) ?>&ekspor=keluar">⬇️ CSV Pengeluaran</a>
    </div>
</div>

