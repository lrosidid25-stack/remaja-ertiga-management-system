<?php
/**
 * PEMASUKAN — Daftar Kas Masuk
 * Route: index.php?page=pemasukan
 */

$db = getDB();

if (($_GET['aksi'] ?? '') === 'hapus' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    requireRole(array_merge(roleKelolaKeuangan(), ['ketua']));
    $idHapus = (int)($_POST['id'] ?? 0);
    $db->prepare("DELETE FROM pemasukan WHERE id = ?")->execute([$idHapus]);
    logAktivitas($_SESSION['user']['id'], 'Hapus pemasukan', 'pemasukan', $idHapus, 'Menghapus catatan pemasukan');
    setFlash('success', 'Catatan pemasukan dihapus.');
    redirect('index.php?page=pemasukan');
}

$dari   = $_GET['dari'] ?? date('Y-m-01');
$sampai = $_GET['sampai'] ?? date('Y-m-t');
$kategori = (int)($_GET['kategori'] ?? 0);

$where = ['p.tanggal BETWEEN ? AND ?'];
$params = [$dari, $sampai];
if ($kategori > 0) {
    $where[] = 'p.kategori_id = ?';
    $params[] = $kategori;
}
$whereSql = 'WHERE ' . implode(' AND ', $where);

$stmt = $db->prepare("SELECT p.*, k.nama AS kategori, g.nama_kegiatan
    FROM pemasukan p
    LEFT JOIN kategori_pemasukan k ON p.kategori_id = k.id
    LEFT JOIN kegiatan g ON p.kegiatan_id = g.id
    {$whereSql} ORDER BY p.tanggal DESC, p.id DESC");
$stmt->execute($params);
$list = $stmt->fetchAll();

$total = array_sum(array_map(fn($r) => (int)$r['nominal'], $list));
$kategoriList = $db->query("SELECT * FROM kategori_pemasukan ORDER BY nama")->fetchAll();
?>

<div class="card-header">
    <div>
        <h2>📥 Kas Masuk</h2>
        <p class="text-muted" style="font-size:.87rem;">Semua pemasukan organisasi: iuran, sponsor, donasi, dan lain-lain.</p>
    </div>
    <div class="btn-group">
        <?php if (bolehAkses(array_merge(roleKelolaKeuangan(), ['ketua']))): ?>
            <a href="index.php?page=pemasukan-tambah" class="btn btn-primary">➕ Catat Pemasukan</a>
        <?php endif; ?>
        <a href="index.php?page=laporan-bulanan" class="btn btn-outline">📋 Laporan</a>
    </div>
</div>

<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-icon green">💰</div>
        <div class="stat-content"><h4>Total Pemasukan</h4><div class="stat-value" style="font-size:1.15rem;"><?= formatRupiah($total) ?></div><div class="stat-sub"><?= formatTanggalPendek($dari) ?> — <?= formatTanggalPendek($sampai) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon blue">🧾</div>
        <div class="stat-content"><h4>Jumlah Transaksi</h4><div class="stat-value"><?= count($list) ?></div><div class="stat-sub">catatan</div></div>
    </div>
</div>

<div class="card">
    <form method="get" action="index.php" class="flex-between" style="gap:10px;align-items:flex-end;">
        <input type="hidden" name="page" value="pemasukan">
        <div style="min-width:150px;">
            <label class="form-label">Dari</label>
            <input type="date" name="dari" value="<?= htmlspecialchars($dari) ?>">
        </div>
        <div style="min-width:150px;">
            <label class="form-label">Sampai</label>
            <input type="date" name="sampai" value="<?= htmlspecialchars($sampai) ?>">
        </div>
        <div style="min-width:180px;">
            <label class="form-label">Kategori</label>
            <select name="kategori">
                <option value="0">Semua</option>
                <?php foreach ($kategoriList as $k): ?>
                    <option value="<?= (int)$k['id'] ?>" <?= $kategori === (int)$k['id'] ? 'selected' : '' ?>><?= htmlspecialchars($k['nama']) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="btn-group">
            <button type="submit" class="btn btn-primary">🔍 Filter</button>
            <a href="index.php?page=pemasukan" class="btn btn-outline">Reset</a>
        </div>
    </form>
</div>

<div class="card">
    <div class="card-title">Daftar Pemasukan</div>
    <?php if (!empty($list)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>Tanggal</th><th>Kategori</th><th>Sumber / Keterangan</th><th>Kegiatan</th><th>Nominal</th><th>Bukti</th><th>Aksi</th></tr></thead>
                <tbody>
                <?php foreach ($list as $p): ?>
                    <tr>
                        <td style="font-size:.84rem;white-space:nowrap;"><?= formatTanggalPendek($p['tanggal']) ?></td>
                        <td><span class="badge badge-blue"><?= htmlspecialchars($p['kategori'] ?? '-') ?></span></td>
                        <td>
                            <div style="font-weight:600;"><?= htmlspecialchars($p['sumber'] ?: '-') ?></div>
                            <?php if (!empty($p['keterangan'])): ?>
                                <div class="text-muted" style="font-size:.78rem;"><?= htmlspecialchars($p['keterangan']) ?></div>
                            <?php endif; ?>
                        </td>
                        <td style="font-size:.82rem;"><?= htmlspecialchars($p['nama_kegiatan'] ?? '-') ?></td>
                        <td style="font-weight:700;color:var(--green-700);white-space:nowrap;"><?= formatRupiah($p['nominal']) ?></td>
                        <td>
                            <?php if (!empty($p['bukti_path'])): ?>
                                <a href="<?= htmlspecialchars($p['bukti_path']) ?>" target="_blank" rel="noopener" class="btn btn-sm btn-outline">📎</a>
                            <?php else: ?><span class="text-muted">-</span><?php endif; ?>
                        </td>
                        <td>
                            <?php if (bolehAkses(array_merge(roleKelolaKeuangan(), ['ketua']))): ?>
                                <div class="btn-group">
                                    <a href="index.php?page=pemasukan-edit&id=<?= (int)$p['id'] ?>" class="btn btn-sm btn-outline">Edit</a>
                                    <form method="post" action="index.php?page=pemasukan&aksi=hapus" onsubmit="return confirm('Hapus catatan ini?');">
                                        <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
                                        <button type="submit" class="btn btn-sm btn-outline-danger">Hapus</button>
                                    </form>
                                </div>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <div class="empty-icon">📭</div>
            <h3>Belum ada pemasukan</h3>
            <p>Catat pemasukan pertama pada rentang tanggal ini.</p>
            <?php if (bolehAkses(roleKelolaKeuangan())): ?>
                <a href="index.php?page=pemasukan-tambah" class="btn btn-primary mt-2">➕ Catat Pemasukan</a>
            <?php endif; ?>
        </div>
    <?php endif; ?>
</div>
