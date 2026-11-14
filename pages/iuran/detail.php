<?php
/**
 * IURAN — Detail Periode & Daftar Tagihan
 * Route: index.php?page=iuran-detail&id=..
 */

$db = getDB();
$id = (int)($_GET['id'] ?? 0);

$stmt = $db->prepare("SELECT * FROM periode_tagihan WHERE id = ?");
$stmt->execute([$id]);
$periode = $stmt->fetch();

if (!$periode) {
    echo '<div class="card"><div class="empty-state"><div class="empty-icon">🔍</div><h3>Periode tidak ditemukan</h3>
        <a href="index.php?page=iuran" class="btn btn-primary mt-2">Kembali ke Iuran</a></div></div>';
    return;
}

$status = $_GET['status'] ?? '';
$q = trim($_GET['q'] ?? '');

$where = ['t.periode_id = ?'];
$params = [$id];
if (in_array($status, ['lunas', 'belum_bayar', 'menunggu_konfirmasi', 'ditolak'], true)) {
    $where[] = 't.status = ?';
    $params[] = $status;
}
if ($q !== '') {
    $where[] = '(a.nama LIKE ? OR a.nir LIKE ?)';
    array_push($params, "%{$q}%", "%{$q}%");
}
$whereSql = 'WHERE ' . implode(' AND ', $where);

$stmt = $db->prepare("SELECT t.*, a.nir, a.nama, a.no_hp
    FROM tagihan_iuran t JOIN anggota a ON t.anggota_id = a.id
    {$whereSql} ORDER BY a.nama");
$stmt->execute($params);
$tagihan = $stmt->fetchAll();

// Ringkasan periode dalam SATU query agregat (sebelumnya 6 query terpisah)
$total = $lunas = $menunggu = $belum = $terkumpul = $target = 0;
try {
    $s = $db->prepare("SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status='lunas' THEN 1 ELSE 0 END) AS lunas,
            SUM(CASE WHEN status='menunggu_konfirmasi' THEN 1 ELSE 0 END) AS menunggu,
            SUM(CASE WHEN status='belum_bayar' THEN 1 ELSE 0 END) AS belum,
            SUM(CASE WHEN status='lunas' THEN nominal ELSE 0 END) AS terkumpul,
            COALESCE(SUM(nominal),0) AS target
        FROM tagihan_iuran WHERE periode_id = ?");
    $s->execute([$id]);
    $agg = $s->fetch() ?: [];
    $total     = (int)($agg['total'] ?? 0);
    $lunas     = (int)($agg['lunas'] ?? 0);
    $menunggu  = (int)($agg['menunggu'] ?? 0);
    $belum     = (int)($agg['belum'] ?? 0);
    $terkumpul = (int)($agg['terkumpul'] ?? 0);
    $target    = (int)($agg['target'] ?? 0);
} catch (Throwable $e) { /* biarkan nol */ }
$persen = $target > 0 ? round($terkumpul / $target * 100) : 0;

function badgeTagihan(string $s): string {
    return match ($s) {
        'lunas' => '<span class="badge badge-green">✅ Lunas</span>',
        'menunggu_konfirmasi' => '<span class="badge badge-yellow">⏳ Menunggu</span>',
        'ditolak' => '<span class="badge badge-gray">Ditolak</span>',
        default => '<span class="badge badge-red">Belum Bayar</span>',
    };
}
?>

<div class="card-header">
    <div>
        <h2>📆 Detail Periode Iuran</h2>
        <p class="text-muted" style="font-size:.87rem;">
            <?= formatTanggal($periode['tgl_mulai']) ?> — <?= formatTanggal($periode['tgl_selesai']) ?>
            · <?= (int)$periode['jml_hari'] ?> hari · <?= formatRupiah($periode['nominal']) ?>/anggota
        </p>
    </div>
    <div class="btn-group">
        <a href="index.php?page=iuran-tunggakan" class="btn btn-outline">⚠️ Tunggakan</a>
        <a href="index.php?page=iuran" class="btn btn-outline">← Kembali</a>
    </div>
</div>

<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-icon blue">🧾</div>
        <div class="stat-content"><h4>Total Tagihan</h4><div class="stat-value"><?= $total ?></div><div class="stat-sub"><?= formatRupiah($target) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div class="stat-content"><h4>Lunas</h4><div class="stat-value"><?= $lunas ?></div><div class="stat-sub"><?= formatRupiah($terkumpul) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon yellow">⏳</div>
        <div class="stat-content"><h4>Menunggu</h4><div class="stat-value"><?= $menunggu ?></div><div class="stat-sub">konfirmasi</div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon red">❌</div>
        <div class="stat-content"><h4>Belum Bayar</h4><div class="stat-value"><?= $belum ?></div><div class="stat-sub">anggota</div></div>
    </div>
</div>

<div class="card">
    <div class="progress-track"><div class="progress-fill" style="width:<?= $persen ?>%"></div></div>
    <div class="flex-between" style="margin-top:6px;font-size:.82rem;color:var(--slate-500);">
        <span><?= $persen ?>% terkumpul dari <?= formatRupiah($target) ?></span>
        <span><?= $total > 0 ? $lunas . ' dari ' . $total . ' tagihan lunas' : 'Belum ada tagihan' ?></span>
    </div>
</div>

<div class="card">
    <form method="get" action="index.php" class="flex-between" style="gap:10px;align-items:flex-end;margin-bottom:16px;">
        <input type="hidden" name="page" value="iuran-detail">
        <input type="hidden" name="id" value="<?= $id ?>">
        <div style="flex:1;min-width:200px;">
            <label class="form-label">Cari Anggota</label>
            <input type="text" name="q" value="<?= htmlspecialchars($q) ?>" placeholder="Nama atau NIR">
        </div>
        <div style="min-width:170px;">
            <label class="form-label">Status</label>
            <select name="status">
                <option value="">Semua</option>
                <option value="lunas" <?= $status === 'lunas' ? 'selected' : '' ?>>Lunas</option>
                <option value="belum_bayar" <?= $status === 'belum_bayar' ? 'selected' : '' ?>>Belum Bayar</option>
                <option value="menunggu_konfirmasi" <?= $status === 'menunggu_konfirmasi' ? 'selected' : '' ?>>Menunggu Konfirmasi</option>
                <option value="ditolak" <?= $status === 'ditolak' ? 'selected' : '' ?>>Ditolak</option>
            </select>
        </div>
        <div class="btn-group">
            <button type="submit" class="btn btn-primary">🔍 Filter</button>
            <a href="index.php?page=iuran-detail&id=<?= $id ?>" class="btn btn-outline">Reset</a>
        </div>
    </form>

    <div class="card-title">Daftar Tagihan (<?= count($tagihan) ?>)</div>
    <?php if (!empty($tagihan)): ?>
        <div class="table-container">
            <table>
                <thead>
                    <tr><th>NIR</th><th>Nama</th><th>Nominal</th><th>Status</th><th>Tgl Bayar</th><th>Metode</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                <?php foreach ($tagihan as $t): ?>
                    <tr>
                        <td style="font-family:ui-monospace,monospace;font-size:.8rem;"><?= htmlspecialchars($t['nir']) ?></td>
                        <td><?= htmlspecialchars($t['nama']) ?></td>
                        <td><?= formatRupiah($t['nominal']) ?></td>
                        <td><?= badgeTagihan($t['status']) ?></td>
                        <td style="font-size:.83rem;"><?= $t['tgl_bayar'] ? formatTanggalPendek($t['tgl_bayar']) : '-' ?></td>
                        <td style="font-size:.83rem;"><?= htmlspecialchars($t['metode'] ?: '-') ?></td>
                        <td>
                            <?php if (bolehAkses(roleTandaiLunas()) && $t['status'] !== 'lunas'): ?>
                                <a href="index.php?page=iuran-bayar&id=<?= (int)$t['id'] ?>" class="btn btn-sm btn-success">💵 Bayar</a>
                            <?php elseif (!empty($t['bukti_path'])): ?>
                                <a href="<?= htmlspecialchars($t['bukti_path']) ?>" target="_blank" rel="noopener" class="btn btn-sm btn-outline">Bukti</a>
                            <?php else: ?>
                                <span class="text-muted" style="font-size:.78rem;">-</span>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state" style="padding:20px;"><p>Tidak ada tagihan yang cocok dengan filter.</p></div>
    <?php endif; ?>
</div>
