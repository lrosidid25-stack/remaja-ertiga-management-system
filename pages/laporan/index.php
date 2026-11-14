<?php
/**
 * LAPORAN — Halaman Indeks Laporan
 * Route: index.php?page=laporan
 */

$db = getDB();

$totalAnggota = (int)$db->query("SELECT COUNT(*) FROM anggota WHERE status='aktif'")->fetchColumn();
$totalPemasukan = (int)$db->query("SELECT COALESCE(SUM(nominal),0) FROM pemasukan")->fetchColumn();
$totalPengeluaran = (int)$db->query("SELECT COALESCE(SUM(nominal),0) FROM pengeluaran")->fetchColumn();
$saldo = $totalPemasukan - $totalPengeluaran;
$totalKegiatan = (int)$db->query("SELECT COUNT(*) FROM kegiatan")->fetchColumn();
$totalPeriode = (int)$db->query("SELECT COUNT(*) FROM periode_tagihan")->fetchColumn();

$bulanIni = date('Y-m');
$masukBulan = (int)dbFetchColumn($db, "SELECT COALESCE(SUM(nominal),0) FROM pemasukan WHERE tanggal LIKE ?", ["{$bulanIni}%"]);
$keluarBulan = (int)dbFetchColumn($db, "SELECT COALESCE(SUM(nominal),0) FROM pengeluaran WHERE tanggal LIKE ?", ["{$bulanIni}%"]);
?>

<div class="card-header">
    <div>
        <h2>📋 Laporan</h2>
        <p class="text-muted" style="font-size:.87rem;">Rekap keuangan, iuran, dan kegiatan organisasi.</p>
    </div>
    <button class="btn btn-outline" data-print>🖨️ Cetak Halaman</button>
</div>

<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-icon blue">👥</div>
        <div class="stat-content"><h4>Anggota Aktif</h4><div class="stat-value"><?= $totalAnggota ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon green">📥</div>
        <div class="stat-content"><h4>Total Pemasukan</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalPemasukan) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon red">📤</div>
        <div class="stat-content"><h4>Total Pengeluaran</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalPengeluaran) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon yellow">🏦</div>
        <div class="stat-content"><h4>Saldo Kas</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($saldo) ?></div></div>
    </div>
</div>

<div class="card">
    <div class="card-title">📆 Kas Bulan Ini (<?= date('F Y') ?>)</div>
    <div class="detail-list">
        <div class="detail-row"><span>Pemasukan</span><span style="color:var(--green-700);"><?= formatRupiah($masukBulan) ?></span></div>
        <div class="detail-row"><span>Pengeluaran</span><span style="color:#b91c1c;"><?= formatRupiah($keluarBulan) ?></span></div>
        <div class="detail-row"><span>Selisih</span><span><?= formatRupiah($masukBulan - $keluarBulan) ?></span></div>
    </div>
</div>

<div class="grid-2">
    <div class="card">
        <div class="card-title">🧾 Laporan Keuangan</div>
        <div class="detail-list">
            <a href="index.php?page=laporan-bulanan" class="detail-row" style="text-decoration:none;">
                <span>📅 Rekap Bulanan</span><span>Buka →</span>
            </a>
            <a href="index.php?page=laporan-tahunan" class="detail-row" style="text-decoration:none;">
                <span>📊 Rekap Tahunan</span><span>Buka →</span>
            </a>
        </div>
    </div>
    <div class="card">
        <div class="card-title">💰 Laporan Iuran &amp; Kegiatan</div>
        <div class="detail-list">
            <a href="index.php?page=laporan-rekap-iuran" class="detail-row" style="text-decoration:none;">
                <span>🧮 Rekap Iuran (<?= $totalPeriode ?> periode)</span><span>Buka →</span>
            </a>
            <a href="index.php?page=laporan-kegiatan" class="detail-row" style="text-decoration:none;">
                <span>📅 Laporan Kegiatan (<?= $totalKegiatan ?>)</span><span>Buka →</span>
            </a>
        </div>
    </div>
</div>
