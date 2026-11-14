<?php
/**
 * ANGGOTA — Detail Anggota
 * Route: index.php?page=anggota-detail&id=..
 */

$db = getDB();
$id = (int)($_GET['id'] ?? 0);

// Hapus anggota (super_admin)
if (($_GET['aksi'] ?? '') === 'hapus' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    requireRole(['super_admin']);
    $namaHapus = getNamaAnggota($id);
    $db->prepare("DELETE FROM anggota WHERE id = ?")->execute([$id]);
    logAktivitas($_SESSION['user']['id'], 'Hapus anggota', 'anggota', $id, "Menghapus anggota {$namaHapus}");
    setFlash('success', 'Anggota berhasil dihapus.');
    redirect('index.php?page=anggota');
}

$stmt = $db->prepare("SELECT * FROM anggota WHERE id = ?");
$stmt->execute([$id]);
$anggota = $stmt->fetch();

if (!$anggota) {
    echo '<div class="card"><div class="empty-state"><div class="empty-icon">🔍</div><h3>Anggota tidak ditemukan</h3>
        <a href="index.php?page=anggota" class="btn btn-primary mt-2">Kembali ke daftar</a></div></div>';
    return;
}

// Riwayat tagihan
$stmt = $db->prepare("SELECT t.*, p.tgl_mulai, p.tgl_selesai, p.jml_hari
    FROM tagihan_iuran t JOIN periode_tagihan p ON t.periode_id = p.id
    WHERE t.anggota_id = ? ORDER BY p.id DESC LIMIT 12");
$stmt->execute([$id]);
$riwayat = $stmt->fetchAll();

$totalLunas = 0; $totalTunggak = 0;
foreach ($riwayat as $r) {
    if ($r['status'] === 'lunas') $totalLunas += (int)$r['nominal'];
    elseif ($r['status'] !== 'ditolak') $totalTunggak += (int)$r['nominal'];
}

function badgeStatusAnggota(string $s): string {
    return match ($s) {
        'lunas' => '<span class="badge badge-green">Lunas</span>',
        'menunggu_konfirmasi' => '<span class="badge badge-yellow">Menunggu</span>',
        'ditolak' => '<span class="badge badge-gray">Ditolak</span>',
        default => '<span class="badge badge-red">Belum Bayar</span>',
    };
}
?>

<div class="card-header">
    <div>
        <h2>👤 <?= htmlspecialchars($anggota['nama']) ?></h2>
        <p class="text-muted" style="font-size:.87rem;">NIR <span style="font-family:ui-monospace,monospace;font-weight:700;"><?= htmlspecialchars($anggota['nir']) ?></span></p>
    </div>
    <div class="btn-group">
        <a href="index.php?page=anggota-kartu&id=<?= $id ?>" class="btn btn-outline">🪪 Kartu</a>
        <?php if (bolehAkses(roleKelolaAnggota())): ?>
            <a href="index.php?page=anggota-edit&id=<?= $id ?>" class="btn btn-primary">✏️ Edit</a>
        <?php endif; ?>
        <a href="index.php?page=anggota" class="btn btn-outline">← Kembali</a>
    </div>
</div>

<div class="grid-2">
    <div class="card">
        <div class="card-title">📋 Data Anggota</div>
        <div class="detail-list">
            <div class="detail-row"><span>Status</span><span>
                <span class="badge badge-<?= $anggota['status'] === 'aktif' ? 'green' : 'gray' ?>"><?= ucfirst(htmlspecialchars($anggota['status'])) ?></span>
            </span></div>
            <div class="detail-row"><span>Jenis Kelamin</span><span><?= $anggota['jenis_kelamin'] === 'P' ? 'Perempuan' : 'Laki-laki' ?></span></div>
            <div class="detail-row"><span>Tempat, Tanggal Lahir</span><span><?= htmlspecialchars(trim(($anggota['tempat_lahir'] ?: '-') . ', ' . ($anggota['tgl_lahir'] ? formatTanggal($anggota['tgl_lahir']) : '-'))) ?></span></div>
            <div class="detail-row"><span>No. HP</span><span><?= htmlspecialchars($anggota['no_hp'] ?: '-') ?></span></div>
            <div class="detail-row"><span>Alamat</span><span><?= nl2br(htmlspecialchars($anggota['alamat'] ?: '-')) ?></span></div>
            <div class="detail-row"><span>Tanggal Bergabung</span><span><?= $anggota['tgl_bergabung'] ? formatTanggal($anggota['tgl_bergabung']) : '-' ?></span></div>
            <div class="detail-row"><span>Wajib Iuran</span><span><?= (int)$anggota['wajib_iuran'] === 1 ? 'Ya' : 'Tidak' ?></span></div>
            <?php if (!empty($anggota['keterangan'])): ?>
                <div class="detail-row"><span>Keterangan</span><span><?= htmlspecialchars($anggota['keterangan']) ?></span></div>
            <?php endif; ?>
        </div>
    </div>

    <div class="card">
        <div class="card-title">💰 Ringkasan Iuran</div>
        <div class="stat-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0;">
            <div class="stat-card">
                <div class="stat-icon green">✅</div>
                <div class="stat-content"><h4>Total Lunas</h4><div class="stat-value" style="font-size:1.05rem;"><?= formatRupiah($totalLunas) ?></div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red">⚠️</div>
                <div class="stat-content"><h4>Tunggakan</h4><div class="stat-value" style="font-size:1.05rem;"><?= formatRupiah($totalTunggak) ?></div></div>
            </div>
        </div>
        <?php if (!empty($anggota['foto'])): ?>
            <div style="margin-top:16px;">
                <div class="form-label">Foto</div>
                <img src="<?= htmlspecialchars($anggota['foto']) ?>" alt="Foto <?= htmlspecialchars($anggota['nama']) ?>"
                     style="border-radius:12px;max-width:180px;border:1px solid var(--slate-200);">
            </div>
        <?php endif; ?>
    </div>
</div>

<div class="card">
    <div class="card-title">🧾 Riwayat Iuran (12 periode terakhir)</div>
    <?php if (!empty($riwayat)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>Periode</th><th>Hari</th><th>Nominal</th><th>Status</th><th>Tgl Bayar</th></tr></thead>
                <tbody>
                <?php foreach ($riwayat as $r): ?>
                    <tr>
                        <td style="font-size:.83rem;"><?= formatTanggalPendek($r['tgl_mulai']) ?> — <?= formatTanggalPendek($r['tgl_selesai']) ?></td>
                        <td><?= (int)$r['jml_hari'] ?></td>
                        <td><?= formatRupiah($r['nominal']) ?></td>
                        <td><?= badgeStatusAnggota($r['status']) ?></td>
                        <td style="font-size:.83rem;"><?= $r['tgl_bayar'] ? formatTanggalPendek($r['tgl_bayar']) : '-' ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state" style="padding:20px;"><p>Belum ada riwayat tagihan untuk anggota ini.</p></div>
    <?php endif; ?>
</div>

<?php if (bolehAkses(['super_admin'])): ?>
<div class="card">
    <div class="card-title" style="color:#b91c1c;">⚠️ Zona Berbahaya</div>
    <form method="post" action="index.php?page=anggota-detail&id=<?= $id ?>&aksi=hapus"
          onsubmit="return confirm('Hapus anggota ini beserta seluruh tagihannya? Tindakan tidak dapat dibatalkan.');">
        <p class="text-muted" style="font-size:.85rem;margin-bottom:12px;">Menghapus anggota juga menghapus data tagihan iuran terkait.</p>
        <button type="submit" class="btn btn-danger">🗑️ Hapus Anggota</button>
    </form>
</div>
<?php endif; ?>
