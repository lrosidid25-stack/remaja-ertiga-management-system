<?php
/**
 * LAPORAN — Rekap Tahunan
 * Route: index.php?page=laporan-tahunan
 */

$db = getDB();

$tahun = (int)($_GET['tahun'] ?? date('Y'));
if ($tahun < 2000 || $tahun > 2100) $tahun = (int)date('Y');

$tahunList = [];
try {
    $rows = $db->query("SELECT DISTINCT substr(tanggal,1,4) AS th FROM pemasukan UNION SELECT DISTINCT substr(tanggal,1,4) FROM pengeluaran")->fetchAll();
    foreach ($rows as $r) if (!empty($r['th'])) $tahunList[] = (int)$r['th'];
} catch (Throwable $e) {}
if (!in_array((int)date('Y'), $tahunList, true)) $tahunList[] = (int)date('Y');
sort($tahunList);

$namaBulan = [1 => 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

$data = [];
for ($m = 1; $m <= 12; $m++) {
    $like = sprintf('%04d-%02d%%', $tahun, $m);
    $masuk = (int)dbFetchColumn($db, "SELECT COALESCE(SUM(nominal),0) FROM pemasukan WHERE tanggal LIKE ?", [$like]);
    $keluar = (int)dbFetchColumn($db, "SELECT COALESCE(SUM(nominal),0) FROM pengeluaran WHERE tanggal LIKE ?", [$like]);
    $data[$m] = ['masuk' => $masuk, 'keluar' => $keluar, 'selisih' => $masuk - $keluar];
}

$totalMasuk = array_sum(array_column($data, 'masuk'));
$totalKeluar = array_sum(array_column($data, 'keluar'));

if (isset($_GET['ekspor'])) {
    $rows = [];
    foreach ($data as $m => $row) {
        $rows[] = [$namaBulan[$m], $row['masuk'], $row['keluar'], $row['selisih']];
    }
    downloadCSV("laporan-tahunan-{$tahun}", ['Bulan', 'Pemasukan', 'Pengeluaran', 'Selisih'], $rows);
}

$pengaturan = getAllPengaturan();
$namaOrg = $pengaturan['nama_organisasi'] ?: 'Remaja Ertiga';
?>

<div class="card-header no-print">
    <div>
        <h2>📊 Laporan Tahunan</h2>
        <p class="text-muted" style="font-size:.87rem;">Rekap kas per bulan dalam satu tahun.</p>
    </div>
    <div class="btn-group">
        <button class="btn btn-primary" data-print>🖨️ Cetak</button>
        <a href="index.php?page=laporan" class="btn btn-outline">← Laporan</a>
    </div>
</div>

<div class="card no-print">
    <form method="get" action="index.php" class="flex-between" style="gap:10px;align-items:flex-end;">
        <input type="hidden" name="page" value="laporan-tahunan">
        <div style="min-width:160px;">
            <label class="form-label">Tahun</label>
            <select name="tahun">
                <?php foreach ($tahunList as $th): ?>
                    <option value="<?= $th ?>" <?= $th === $tahun ? 'selected' : '' ?>><?= $th ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <button type="submit" class="btn btn-primary">Tampilkan</button>
    </form>
</div>

<div class="card">
    <div style="text-align:center;margin-bottom:20px;">
        <h3 style="font-size:1.1rem;font-weight:800;"><?= htmlspecialchars($namaOrg) ?></h3>
        <p class="text-muted" style="font-size:.87rem;">Laporan Keuangan Tahun <?= $tahun ?></p>
    </div>

    <div class="stat-grid">
        <div class="stat-card">
            <div class="stat-icon green">📥</div>
            <div class="stat-content"><h4>Total Pemasukan</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalMasuk) ?></div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon red">📤</div>
            <div class="stat-content"><h4>Total Pengeluaran</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalKeluar) ?></div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon blue">⚖️</div>
            <div class="stat-content"><h4>Saldo Tahun</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalMasuk - $totalKeluar) ?></div></div>
        </div>
    </div>

    <div class="table-container">
        <table>
            <thead><tr><th>Bulan</th><th>Pemasukan</th><th>Pengeluaran</th><th>Selisih</th></tr></thead>
            <tbody>
            <?php foreach ($data as $m => $row): ?>
                <tr>
                    <td style="font-weight:600;"><?= $namaBulan[$m] ?></td>
                    <td style="color:var(--green-700);"><?= formatRupiah($row['masuk']) ?></td>
                    <td style="color:#b91c1c;"><?= formatRupiah($row['keluar']) ?></td>
                    <td style="font-weight:700;color:<?= $row['selisih'] >= 0 ? 'var(--slate-800)' : '#b91c1c' ?>;">
                        <?= formatRupiah($row['selisih']) ?>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
            <tfoot>
                <tr style="background:var(--slate-50);font-weight:800;">
                    <th style="padding:12px 14px;">Total</th>
                    <th style="padding:12px 14px;"><?= formatRupiah($totalMasuk) ?></th>
                    <th style="padding:12px 14px;"><?= formatRupiah($totalKeluar) ?></th>
                    <th style="padding:12px 14px;"><?= formatRupiah($totalMasuk - $totalKeluar) ?></th>
                </tr>
            </tfoot>
        </table>
    </div>
</div>

<div class="card no-print">
    <a class="btn btn-outline" href="index.php?page=laporan-tahunan&tahun=<?= $tahun ?>&ekspor=1">⬇️ Ekspor CSV Tahunan</a>
</div>
