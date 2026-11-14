<?php
/**
 * PENGATURAN — Periode Kepengurusan
 * Route: index.php?page=pengaturan-periode
 */

$db = getDB();
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $aksi = $_POST['aksi'] ?? '';

    if ($aksi === 'simpan') {
        $nama = trim($_POST['nama_periode'] ?? '');
        $mulai = $_POST['tgl_mulai'] ?? '';
        $selesai = $_POST['tgl_selesai'] ?? '';

        if ($nama === '' || !$mulai || !$selesai) {
            $error = 'Nama periode, tanggal mulai, dan tanggal selesai wajib diisi.';
        } elseif (strtotime($selesai) < strtotime($mulai)) {
            $error = 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
        } else {
            $aktif = isset($_POST['aktif']) ? 1 : 0;
            if ($aktif) {
                $db->exec("UPDATE periode_kepengurusan SET aktif = 0");
            }
            $db->prepare("INSERT INTO periode_kepengurusan (nama_periode, tgl_mulai, tgl_selesai, ketua_id, keterangan, aktif)
                VALUES (?,?,?,?,?,?)")
               ->execute([
                   $nama, $mulai, $selesai,
                   ((int)($_POST['ketua_id'] ?? 0)) ?: null,
                   trim($_POST['keterangan'] ?? ''),
                   $aktif,
               ]);
            setFlash('success', 'Periode kepengurusan disimpan.');
            redirect('index.php?page=pengaturan-periode');
        }
    } elseif ($aksi === 'aktifkan') {
        $idAktif = (int)($_POST['id'] ?? 0);
        $db->exec("UPDATE periode_kepengurusan SET aktif = 0");
        $db->prepare("UPDATE periode_kepengurusan SET aktif = 1 WHERE id = ?")->execute([$idAktif]);
        setFlash('success', 'Periode kepengurusan diaktifkan.');
        redirect('index.php?page=pengaturan-periode');
    } elseif ($aksi === 'hapus') {
        $db->prepare("DELETE FROM periode_kepengurusan WHERE id = ?")->execute([(int)($_POST['id'] ?? 0)]);
        setFlash('success', 'Periode kepengurusan dihapus.');
        redirect('index.php?page=pengaturan-periode');
    }
}

$list = $db->query("SELECT pk.*, u.nama AS ketua_nama FROM periode_kepengurusan pk
    LEFT JOIN users u ON pk.ketua_id = u.id ORDER BY pk.tgl_mulai DESC")->fetchAll();
$users = $db->query("SELECT id, nama, role FROM users WHERE aktif = 1 ORDER BY nama")->fetchAll();
?>

<div class="card-header">
    <div>
        <h2>📆 Periode Kepengurusan</h2>
        <p class="text-muted" style="font-size:.87rem;">Catatan masa jabatan pengurus organisasi.</p>
    </div>
    <a href="index.php?page=pengaturan" class="btn btn-outline">← Pengaturan</a>
</div>

<?php if ($error): ?><div class="alert alert-red"><?= htmlspecialchars($error) ?></div><?php endif; ?>

<div class="card">
    <div class="card-title">➕ Periode Baru</div>
    <form method="post" action="index.php?page=pengaturan-periode">
        <input type="hidden" name="aksi" value="simpan">
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="nama_periode">Nama Periode *</label>
                <input type="text" id="nama_periode" name="nama_periode" required placeholder="Contoh: 2026 - 2029">
            </div>
            <div class="form-group">
                <label class="form-label" for="ketua_id">Ketua</label>
                <select id="ketua_id" name="ketua_id">
                    <option value="0">- Pilih -</option>
                    <?php foreach ($users as $u): ?>
                        <option value="<?= (int)$u['id'] ?>"><?= htmlspecialchars($u['nama']) ?> (<?= labelRole($u['role']) ?>)</option>
                    <?php endforeach; ?>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="tgl_mulai">Tanggal Mulai *</label>
                <input type="date" id="tgl_mulai" name="tgl_mulai" required value="<?= date('Y-m-d') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="tgl_selesai">Tanggal Selesai *</label>
                <input type="date" id="tgl_selesai" name="tgl_selesai" required value="<?= date('Y-m-d', strtotime('+3 years')) ?>">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="keterangan">Keterangan</label>
            <textarea id="keterangan" name="keterangan"></textarea>
        </div>
        <div class="form-group checkbox-row">
            <input type="checkbox" id="aktif" name="aktif" value="1">
            <label for="aktif" class="form-label" style="margin-bottom:0;">Jadikan periode aktif</label>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan Periode</button>
        </div>
    </form>
</div>

<div class="card">
    <div class="card-title">📋 Daftar Periode</div>
    <?php if (!empty($list)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>Nama</th><th>Tanggal</th><th>Ketua</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                <?php foreach ($list as $p): ?>
                    <tr>
                        <td style="font-weight:600;"><?= htmlspecialchars($p['nama_periode']) ?></td>
                        <td style="font-size:.83rem;"><?= formatTanggalPendek($p['tgl_mulai']) ?> — <?= formatTanggalPendek($p['tgl_selesai']) ?></td>
                        <td style="font-size:.85rem;"><?= htmlspecialchars($p['ketua_nama'] ?: '-') ?></td>
                        <td><?= (int)$p['aktif'] === 1 ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-gray">Arsip</span>' ?></td>
                        <td>
                            <div class="btn-group">
                                <?php if ((int)$p['aktif'] !== 1): ?>
                                    <form method="post" action="index.php?page=pengaturan-periode">
                                        <input type="hidden" name="aksi" value="aktifkan">
                                        <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
                                        <button type="submit" class="btn btn-sm btn-outline">Aktifkan</button>
                                    </form>
                                <?php endif; ?>
                                <form method="post" action="index.php?page=pengaturan-periode" onsubmit="return confirm('Hapus periode ini?');">
                                    <input type="hidden" name="aksi" value="hapus">
                                    <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
                                    <button type="submit" class="btn btn-sm btn-outline-danger">Hapus</button>
                                </form>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state" style="padding:20px;"><p>Belum ada periode kepengurusan.</p></div>
    <?php endif; ?>
</div>
