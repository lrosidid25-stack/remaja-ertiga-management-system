<?php
/**
 * KEGIATAN — Detail
 * Route: index.php?page=kegiatan-detail&id=..
 */

$db = getDB();
$id = (int)($_GET['id'] ?? 0);
$stmt = $db->prepare("SELECT k.*, u.nama AS pj_nama FROM kegiatan k LEFT JOIN users u ON k.penanggung_jawab = u.id WHERE k.id = ?");
$stmt->execute([$id]);
$kegiatan = $stmt->fetch();

if (!$kegiatan) {
    echo '<div class="card"><div class="empty-state"><div class="empty-icon">🔍</div><h3>Kegiatan tidak ditemukan</h3>
        <a href="index.php?page=kegiatan" class="btn btn-primary mt-2">Kembali</a></div></div>';
    return;
}

$stmt = $db->prepare("SELECT * FROM pemasukan WHERE kegiatan_id = ? ORDER BY tanggal DESC");
$stmt->execute([$id]);
$pemasukan = $stmt->fetchAll();

$stmt = $db->prepare("SELECT * FROM pengeluaran WHERE kegiatan_id = ? ORDER BY tanggal DESC");
$stmt->execute([$id]);
$pengeluaran = $stmt->fetchAll();

$totalMasuk = array_sum(array_map(fn($r) => (int)$r['nominal'], $pemasukan));
$totalKeluar = array_sum(array_map(fn($r) => (int)$r['nominal'], $pengeluaran));
$selisih = (int)$kegiatan['anggaran'] - (int)$kegiatan['realisasi'];
$bolehKelola = bolehAkses(['super_admin', 'ketua', 'sekretaris', 'wakil_sekretaris']);
?>

<div class="card-header">
    <div>
        <h2>📅 <?= htmlspecialchars($kegiatan['nama_kegiatan']) ?></h2>
        <p class="text-muted" style="font-size:.87rem;">
            <?= formatTanggal($kegiatan['tgl_mulai'], true) ?>
            <?= $kegiatan['tgl_selesai'] && $kegiatan['tgl_selesai'] !== $kegiatan['tgl_mulai'] ? ' — ' . formatTanggal($kegiatan['tgl_selesai'], true) : '' ?>
        </p>
    </div>
    <div class="btn-group">
        <?php if ($bolehKelola): ?>
            <a href="index.php?page=kegiatan-edit&id=<?= $id ?>" class="btn btn-primary">✏️ Edit</a>
        <?php endif; ?>
        <a href="index.php?page=kegiatan" class="btn btn-outline">← Kembali</a>
    </div>
</div>

<div class="grid-2">
    <div class="card">
        <div class="card-title">📋 Informasi Kegiatan</div>
        <div class="detail-list">
            <div class="detail-row"><span>Status</span><span>
                <?= match ($kegiatan['status']) {
                    'berlangsung' => '<span class="badge badge-blue">Berlangsung</span>',
                    'selesai' => '<span class="badge badge-green">Selesai</span>',
                    'dibatalkan' => '<span class="badge badge-gray">Dibatalkan</span>',
                    default => '<span class="badge badge-yellow">Direncanakan</span>',
                } ?>
            </span></div>
            <div class="detail-row"><span>Lokasi</span><span><?= htmlspecialchars($kegiatan['lokasi'] ?: '-') ?></span></div>
            <div class="detail-row"><span>Penanggung Jawab</span><span><?= htmlspecialchars($kegiatan['pj_nama'] ?: '-') ?></span></div>
            <div class="detail-row"><span>Anggaran</span><span><?= formatRupiah($kegiatan['anggaran']) ?></span></div>
            <div class="detail-row"><span>Realisasi</span><span><?= formatRupiah($kegiatan['realisasi']) ?></span></div>
            <div class="detail-row"><span>Sisa Anggaran</span><span style="color:<?= $selisih >= 0 ? 'var(--green-700)' : '#b91c1c' ?>;"><?= formatRupiah($selisih) ?></span></div>
        </div>
        <?php if (!empty($kegiatan['deskripsi'])): ?>
            <div class="mt-2">
                <div class="form-label">Deskripsi</div>
                <p style="font-size:.88rem;color:var(--slate-600);"><?= nl2br(htmlspecialchars($kegiatan['deskripsi'])) ?></p>
            </div>
        <?php endif; ?>
    </div>

    <div class="card">
        <div class="card-title">💰 Ringkasan Keuangan Kegiatan</div>
        <div class="stat-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0;">
            <div class="stat-card">
                <div class="stat-icon green">📥</div>
                <div class="stat-content"><h4>Masuk</h4><div class="stat-value" style="font-size:1rem;"><?= formatRupiah($totalMasuk) ?></div><div class="stat-sub"><?= count($pemasukan) ?> transaksi</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red">📤</div>
                <div class="stat-content"><h4>Keluar</h4><div class="stat-value" style="font-size:1rem;"><?= formatRupiah($totalKeluar) ?></div><div class="stat-sub"><?= count($pengeluaran) ?> transaksi</div></div>
            </div>
        </div>
        <?php if (!empty($kegiatan['keterangan'])): ?>
            <div class="mt-2">
                <div class="form-label">Keterangan</div>
                <p style="font-size:.88rem;color:var(--slate-600);"><?= nl2br(htmlspecialchars($kegiatan['keterangan'])) ?></p>
            </div>
        <?php endif; ?>
    </div>
</div>

<div class="grid-2">
    <div class="card">
        <div class="card-title">📥 Pemasukan Terkait</div>
        <?php if (!empty($pemasukan)): ?>
            <div class="table-container">
                <table>
                    <thead><tr><th>Tanggal</th><th>Sumber</th><th>Nominal</th></tr></thead>
                    <tbody>
                    <?php foreach ($pemasukan as $p): ?>
                        <tr>
                            <td style="font-size:.82rem;"><?= formatTanggalPendek($p['tanggal']) ?></td>
                            <td style="font-size:.85rem;"><?= htmlspecialchars($p['sumber'] ?: '-') ?></td>
                            <td style="color:var(--green-700);font-weight:700;"><?= formatRupiah($p['nominal']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php else: ?>
            <div class="empty-state" style="padding:20px;"><p>Belum ada pemasukan terkait.</p></div>
        <?php endif; ?>
    </div>

    <div class="card">
        <div class="card-title">📤 Pengeluaran Terkait</div>
        <?php if (!empty($pengeluaran)): ?>
            <div class="table-container">
                <table>
                    <thead><tr><th>Tanggal</th><th>Keperluan</th><th>Nominal</th></tr></thead>
                    <tbody>
                    <?php foreach ($pengeluaran as $p): ?>
                        <tr>
                            <td style="font-size:.82rem;"><?= formatTanggalPendek($p['tanggal']) ?></td>
                            <td style="font-size:.85rem;"><?= htmlspecialchars($p['keperluan'] ?: '-') ?></td>
                            <td style="color:#b91c1c;font-weight:700;"><?= formatRupiah($p['nominal']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php else: ?>
            <div class="empty-state" style="padding:20px;"><p>Belum ada pengeluaran terkait.</p></div>
        <?php endif; ?>
    </div>
</div>

<?php if (bolehAkses(['super_admin', 'ketua'])): ?>
<div class="card">
    <div class="card-title" style="color:#b91c1c;">⚠️ Zona Berbahaya</div>
    <form method="post" action="index.php?page=kegiatan&aksi=hapus" onsubmit="return confirm('Hapus kegiatan ini?');">
        <input type="hidden" name="id" value="<?= $id ?>">
        <button type="submit" class="btn btn-danger">🗑️ Hapus Kegiatan</button>
    </form>
</div>
<?php endif; ?>
