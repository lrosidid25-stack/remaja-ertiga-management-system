<?php
/**
 * ANGGOTA — Daftar Anggota
 * Route: index.php?page=anggota
 */

$db = getDB();

$q      = trim($_GET['q'] ?? '');
$status = $_GET['status'] ?? '';
$hal    = max(1, (int)($_GET['hal'] ?? 1));
$perHal = 15;

$where = [];
$params = [];
if ($q !== '') {
    $where[] = '(nama LIKE ? OR nir LIKE ? OR no_hp LIKE ?)';
    array_push($params, "%{$q}%", "%{$q}%", "%{$q}%");
}
if (in_array($status, ['aktif', 'nonaktif', 'pindah', 'meninggal'], true)) {
    $where[] = 'status = ?';
    $params[] = $status;
}
$whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

$countStmt = $db->prepare("SELECT COUNT(*) FROM anggota {$whereSql}");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$pag = getPagination($total, $perHal, $hal, 'index.php?page=anggota&q=' . urlencode($q) . '&status=' . urlencode($status));

$stmt = $db->prepare("SELECT * FROM anggota {$whereSql} ORDER BY nama LIMIT {$perHal} OFFSET {$pag['offset']}");
$stmt->execute($params);
$anggota = $stmt->fetchAll();

// Statistik ringkas — satu query agregat untuk 5 angka (hemat 4 request)
$stat = [];
try {
    $stat = $db->query("SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status='aktif' THEN 1 ELSE 0 END) AS aktif,
            SUM(CASE WHEN status='aktif' AND wajib_iuran=1 THEN 1 ELSE 0 END) AS wajib,
            SUM(CASE WHEN jenis_kelamin='L' AND status='aktif' THEN 1 ELSE 0 END) AS laki,
            SUM(CASE WHEN jenis_kelamin='P' AND status='aktif' THEN 1 ELSE 0 END) AS perempuan
        FROM anggota")->fetch() ?: [];
} catch (Throwable $e) { $stat = []; }
$statTotal = (int)($stat['total'] ?? 0);
$statAktif = (int)($stat['aktif'] ?? 0);
$statWajib  = (int)($stat['wajib'] ?? 0);
$statL      = (int)($stat['laki'] ?? 0);
$statP      = (int)($stat['perempuan'] ?? 0);
?>

<div class="card-header">
    <div>
        <h2>👥 Data Anggota</h2>
        <p class="text-muted" style="font-size:.87rem;">Kelola data seluruh anggota organisasi.</p>
    </div>
    <?php if (bolehAkses(roleKelolaAnggota())): ?>
        <a href="index.php?page=anggota-tambah" class="btn btn-primary">➕ Tambah Anggota</a>
    <?php endif; ?>
</div>

<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-icon blue">👥</div>
        <div class="stat-content"><h4>Total</h4><div class="stat-value"><?= $statTotal ?></div><div class="stat-sub">Semua anggota</div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div class="stat-content"><h4>Aktif</h4><div class="stat-value"><?= $statAktif ?></div><div class="stat-sub">Anggota aktif</div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon purple">💰</div>
        <div class="stat-content"><h4>Wajib Iuran</h4><div class="stat-value"><?= $statWajib ?></div><div class="stat-sub">Anggota wajib setor</div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon yellow">⚖️</div>
        <div class="stat-content"><h4>L / P</h4><div class="stat-value"><?= $statL ?> / <?= $statP ?></div><div class="stat-sub">Komposisi aktif</div></div>
    </div>
</div>

<div class="card">
    <form method="get" action="index.php" class="flex-between" style="gap:10px;align-items:flex-end;">
        <input type="hidden" name="page" value="anggota">
        <div style="flex:1;min-width:220px;">
            <label class="form-label">Cari</label>
            <input type="text" name="q" value="<?= htmlspecialchars($q) ?>" placeholder="Nama, NIR, atau nomor HP">
        </div>
        <div style="min-width:160px;">
            <label class="form-label">Status</label>
            <select name="status">
                <option value="">Semua</option>
                <?php foreach (['aktif' => 'Aktif', 'nonaktif' => 'Nonaktif', 'pindah' => 'Pindah', 'meninggal' => 'Meninggal'] as $val => $lbl): ?>
                    <option value="<?= $val ?>" <?= $status === $val ? 'selected' : '' ?>><?= $lbl ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="btn-group">
            <button type="submit" class="btn btn-primary">🔍 Cari</button>
            <a href="index.php?page=anggota" class="btn btn-outline">Reset</a>
        </div>
    </form>
</div>

<div class="card">
    <div class="flex-between mb-2">
        <div class="card-title" style="margin-bottom:0;">Daftar Anggota (<?= $total ?>)</div>
        <span class="text-muted" style="font-size:.8rem;">Halaman <?= $pag['current_page'] ?> dari <?= $pag['total_pages'] ?></span>
    </div>

    <?php if (!empty($anggota)): ?>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>NIR</th><th>Nama</th><th>L/P</th><th>No. HP</th>
                        <th>Wajib Iuran</th><th>Status</th><th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($anggota as $a): ?>
                    <tr>
                        <td style="font-family:ui-monospace,monospace;font-size:.8rem;"><?= htmlspecialchars($a['nir']) ?></td>
                        <td>
                            <a href="index.php?page=anggota-detail&id=<?= (int)$a['id'] ?>" style="font-weight:700;color:var(--slate-800);">
                                <?= htmlspecialchars($a['nama']) ?>
                            </a>
                        </td>
                        <td><?= $a['jenis_kelamin'] === 'P' ? 'P' : 'L' ?></td>
                        <td style="font-size:.84rem;"><?= htmlspecialchars($a['no_hp'] ?: '-') ?></td>
                        <td>
                            <?= (int)$a['wajib_iuran'] === 1
                                ? '<span class="badge badge-green">Wajib</span>'
                                : '<span class="badge badge-gray">Bebas</span>' ?>
                        </td>
                        <td>
                            <?= match ($a['status']) {
                                'aktif' => '<span class="badge badge-green">Aktif</span>',
                                'nonaktif' => '<span class="badge badge-gray">Nonaktif</span>',
                                'pindah' => '<span class="badge badge-blue">Pindah</span>',
                                'meninggal' => '<span class="badge badge-gray">Meninggal</span>',
                                default => '<span class="badge badge-gray">' . htmlspecialchars($a['status']) . '</span>',
                            } ?>
                        </td>
                        <td>
                            <div class="btn-group">
                                <a href="index.php?page=anggota-detail&id=<?= (int)$a['id'] ?>" class="btn btn-sm btn-outline">Detail</a>
                                <?php if (bolehAkses(roleKelolaAnggota())): ?>
                                    <a href="index.php?page=anggota-edit&id=<?= (int)$a['id'] ?>" class="btn btn-sm btn-outline">Edit</a>
                                <?php endif; ?>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?= renderPagination($pag) ?>
    <?php else: ?>
        <div class="empty-state">
            <div class="empty-icon">📭</div>
            <h3>Belum ada anggota</h3>
            <p><?= $q !== '' || $status !== '' ? 'Tidak ada anggota yang cocok dengan filter.' : 'Tambahkan anggota pertama organisasi.' ?></p>
            <?php if (bolehAkses(roleKelolaAnggota())): ?>
                <a href="index.php?page=anggota-tambah" class="btn btn-primary mt-2">➕ Tambah Anggota</a>
            <?php endif; ?>
        </div>
    <?php endif; ?>
</div>
