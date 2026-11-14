<?php
/**
 * LAPORAN — Kegiatan
 * Route: index.php?page=laporan-kegiatan
 */

$db = getDB();

$tahun = (int)($_GET['tahun'] ?? date('Y'));
$where = "WHERE substr(k.tgl_mulai,1,4) = ?";
$params = [(string)$tahun];

$stmt = $db->prepare("SELECT k.*, u.nama AS pj_nama FROM kegiatan k LEFT JOIN users u ON k.penanggung_jawab = u.id
    {$where} ORDER BY k.tgl_mulai DESC");
$stmt->execute($params);
$list = $stmt->fetchAll();

$totalAnggaran = array_sum(array_map(fn($k) => (int)$k['anggaran'], $list));
$totalRealisasi = array_sum(array_map(fn($k) => (int)$k['realisasi'], $list));

$perStatus = ['direncanakan' => 0, 'berlangsung' => 0, 'selesai' => 0, 'dibatalkan' => 0];
foreach ($list as $k) if (isset($perStatus[$k['status']])) $perStatus[$k['status']]++;

$pengaturan = getAllPengaturan();
$namaOrg = ($pengaturan['nama_organisasi'] ?? '') ?: 'Remaja Ertiga';
?>

<div class="card-header no-print">
    <div>
        <h2>📅 Laporan Kegiatan</h2>
        <p class="text-muted" style="font-size:.87rem;">Rekap kegiatan beserta anggaran dan realisasinya.</p>
    </div>
    <div class="btn-group">
        <button class="btn btn-primary" data-print>🖨️ Cetak</button>
        <a href="index.php?page=laporan" class="btn btn-outline">← Laporan</a>
    </div>
</div>

<div class="card no-print">
    <form method="get" action="index.php" class="flex-between" style="gap:10px;align-items:flex-end;">
        <input type="hidden" name="page" value="laporan-kegiatan">
        <div style="min-width:160px;">
            <label class="form-label">Tahun</label>
            <input type="number" name="tahun" value="<?= $tahun ?>" min="2000" max="2100">
        </div>
        <button type="submit" class="btn btn-primary">Tampilkan</button>
    </form>
</div>

<div class="card">
    <div style="text-align:center;margin-bottom:18px;">
        <h3 style="font-size:1.1rem;font-weight:800;"><?= htmlspecialchars($namaOrg) ?></h3>
        <p class="text-muted" style="font-size:.87rem;">Laporan Kegiatan Tahun <?= $tahun ?></p>
    </div>

    <div class="stat-grid">
        <div class="stat-card">
            <div class="stat-icon blue">📅</div>
            <div class="stat-content"><h4>Total Kegiatan</h4><div class="stat-value"><?= count($list) ?></div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon yellow">💵</div>
            <div class="stat-content"><h4>Total Anggaran</h4><div class="stat-value" style="font-size:1.05rem;"><?= formatRupiah($totalAnggaran) ?></div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon red">📤</div>
            <div class="stat-content"><h4>Total Realisasi</h4><div class="stat-value" style="font-size:1.05rem;"><?= formatRupiah($totalRealisasi) ?></div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green">✅</div>
            <div class="stat-content"><h4>Selesai</h4><div class="stat-value"><?= $perStatus['selesai'] ?></div></div>
        </div>
    </div>

    <?php if (!empty($list)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>Kegiatan</th><th>Tanggal</th><th>Lokasi</th><th>PJ</th><th>Anggaran</th><th>Realisasi</th><th>Status</th></tr></thead>
                <tbody>
                <?php foreach ($list as $k): ?>
                    <tr>
                        <td style="font-weight:600;"><?= htmlspecialchars($k['nama_kegiatan']) ?></td>
                        <td style="font-size:.82rem;white-space:nowrap;"><?= formatTanggalPendek($k['tgl_mulai']) ?></td>
                        <td style="font-size:.82rem;"><?= htmlspecialchars($k['lokasi'] ?: '-') ?></td>
                        <td style="font-size:.82rem;"><?= htmlspecialchars($k['pj_nama'] ?: '-') ?></td>
                        <td style="font-size:.84rem;"><?= formatRupiah($k['anggaran']) ?></td>
                        <td style="font-size:.84rem;"><?= formatRupiah($k['realisasi']) ?></td>
                        <td>
                            <?= match ($k['status']) {
                                'berlangsung' => '<span class="badge badge-blue">Berlangsung</span>',
                                'selesai' => '<span class="badge badge-green">Selesai</span>',
                                'dibatalkan' => '<span class="badge badge-gray">Dibatalkan</span>',
                                default => '<span class="badge badge-yellow">Direncanakan</span>',
                            } ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
                <tfoot>
                    <tr style="background:var(--slate-50);font-weight:800;">
                        <th colspan="4" style="padding:12px 14px;text-align:right;">Total</th>
                        <th style="padding:12px 14px;"><?= formatRupiah($totalAnggaran) ?></th>
                        <th style="padding:12px 14px;"><?= formatRupiah($totalRealisasi) ?></th>
                        <th></th>
                    </tr>
                </tfoot>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <div class="empty-icon">📅</div>
            <h3>Belum ada kegiatan</h3>
            <p>Tidak ada kegiatan tercatat pada tahun <?= $tahun ?>.</p>
        </div>
    <?php endif; ?>
</div>
