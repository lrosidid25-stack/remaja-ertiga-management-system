<?php
/**
 * KEGIATAN — Daftar Kegiatan
 * Route: index.php?page=kegiatan
 */

$db = getDB();

if (($_GET['aksi'] ?? '') === 'hapus' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    requireRole(['super_admin', 'ketua']);
    $idHapus = (int)($_POST['id'] ?? 0);
    $db->prepare("DELETE FROM kegiatan WHERE id = ?")->execute([$idHapus]);
    logAktivitas($_SESSION['user']['id'], 'Hapus kegiatan', 'kegiatan', $idHapus, 'Menghapus kegiatan');
    setFlash('success', 'Kegiatan dihapus.');
    redirect('index.php?page=kegiatan');
}

$statusFilter = $_GET['status'] ?? '';
$where = '';
$params = [];
if (in_array($statusFilter, ['direncanakan', 'berlangsung', 'selesai', 'dibatalkan'], true)) {
    $where = 'WHERE status = ?';
    $params[] = $statusFilter;
}

$stmt = $db->prepare("SELECT k.*, u.nama AS pj_nama
    FROM kegiatan k LEFT JOIN users u ON k.penanggung_jawab = u.id
    {$where} ORDER BY k.tgl_mulai DESC, k.id DESC");
$stmt->execute($params);
$list = $stmt->fetchAll();

$hitung = ['direncanakan' => 0, 'berlangsung' => 0, 'selesai' => 0, 'dibatalkan' => 0];
foreach ($list as $k) {
    if (isset($hitung[$k['status']])) $hitung[$k['status']]++;
}

function badgeKegiatan(string $s): string {
    return match ($s) {
        'berlangsung' => '<span class="badge badge-blue">Berlangsung</span>',
        'selesai' => '<span class="badge badge-green">Selesai</span>',
        'dibatalkan' => '<span class="badge badge-gray">Dibatalkan</span>',
        default => '<span class="badge badge-yellow">Direncanakan</span>',
    };
}

$bolehKelola = bolehAkses(['super_admin', 'ketua', 'sekretaris', 'wakil_sekretaris']);
?>

<div class="card-header">
    <div>
        <h2>📅 Kegiatan Organisasi</h2>
        <p class="text-muted" style="font-size:.87rem;">Agenda, anggaran, dan realisasi kegiatan Remaja Ertiga.</p>
    </div>
    <?php if ($bolehKelola): ?>
        <a href="index.php?page=kegiatan-tambah" class="btn btn-primary">➕ Tambah Kegiatan</a>
    <?php endif; ?>
</div>

<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-icon yellow">🗓️</div>
        <div class="stat-content"><h4>Direncanakan</h4><div class="stat-value"><?= $hitung['direncanakan'] ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon blue">▶️</div>
        <div class="stat-content"><h4>Berlangsung</h4><div class="stat-value"><?= $hitung['berlangsung'] ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div class="stat-content"><h4>Selesai</h4><div class="stat-value"><?= $hitung['selesai'] ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon gray">🚫</div>
        <div class="stat-content"><h4>Dibatalkan</h4><div class="stat-value"><?= $hitung['dibatalkan'] ?></div></div>
    </div>
</div>

<div class="card">
    <div class="flex-between mb-2">
        <div class="card-title" style="margin-bottom:0;">Daftar Kegiatan (<?= count($list) ?>)</div>
        <div class="btn-group">
            <a href="index.php?page=kegiatan" class="btn btn-sm <?= $statusFilter === '' ? 'btn-primary' : 'btn-outline' ?>">Semua</a>
            <?php foreach (['direncanakan' => 'Rencana', 'berlangsung' => 'Berlangsung', 'selesai' => 'Selesai'] as $v => $l): ?>
                <a href="index.php?page=kegiatan&status=<?= $v ?>" class="btn btn-sm <?= $statusFilter === $v ? 'btn-primary' : 'btn-outline' ?>"><?= $l ?></a>
            <?php endforeach; ?>
        </div>
    </div>

    <?php if (!empty($list)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>Kegiatan</th><th>Tanggal</th><th>Lokasi</th><th>Anggaran</th><th>Realisasi</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                <?php foreach ($list as $k): ?>
                    <tr>
                        <td>
                            <a href="index.php?page=kegiatan-detail&id=<?= (int)$k['id'] ?>" style="font-weight:700;color:var(--slate-800);"><?= htmlspecialchars($k['nama_kegiatan']) ?></a>
                            <?php if (!empty($k['pj_nama'])): ?>
                                <div class="text-muted" style="font-size:.76rem;">PJ: <?= htmlspecialchars($k['pj_nama']) ?></div>
                            <?php endif; ?>
                        </td>
                        <td style="font-size:.83rem;white-space:nowrap;">
                            <?= formatTanggalPendek($k['tgl_mulai']) ?>
                            <?= $k['tgl_selesai'] && $k['tgl_selesai'] !== $k['tgl_mulai'] ? ' — ' . formatTanggalPendek($k['tgl_selesai']) : '' ?>
                        </td>
                        <td style="font-size:.83rem;"><?= htmlspecialchars($k['lokasi'] ?: '-') ?></td>
                        <td style="font-size:.84rem;"><?= formatRupiah($k['anggaran']) ?></td>
                        <td style="font-size:.84rem;"><?= formatRupiah($k['realisasi']) ?></td>
                        <td><?= badgeKegiatan($k['status']) ?></td>
                        <td>
                            <div class="btn-group">
                                <a href="index.php?page=kegiatan-detail&id=<?= (int)$k['id'] ?>" class="btn btn-sm btn-outline">Detail</a>
                                <?php if ($bolehKelola): ?>
                                    <a href="index.php?page=kegiatan-edit&id=<?= (int)$k['id'] ?>" class="btn btn-sm btn-outline">Edit</a>
                                <?php endif; ?>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <div class="empty-icon">📅</div>
            <h3>Belum ada kegiatan</h3>
            <p>Tambahkan agenda kegiatan organisasi.</p>
            <?php if ($bolehKelola): ?>
                <a href="index.php?page=kegiatan-tambah" class="btn btn-primary mt-2">➕ Tambah Kegiatan</a>
            <?php endif; ?>
        </div>
    <?php endif; ?>
</div>
