<?php
/**
 * KEGIATAN — Edit
 * Route: index.php?page=kegiatan-edit&id=..
 */

$db = getDB();
$id = (int)($_GET['id'] ?? 0);
$stmt = $db->prepare("SELECT * FROM kegiatan WHERE id = ?");
$stmt->execute([$id]);
$kegiatan = $stmt->fetch();

if (!$kegiatan) {
    echo '<div class="card"><div class="empty-state"><div class="empty-icon">🔍</div><h3>Kegiatan tidak ditemukan</h3>
        <a href="index.php?page=kegiatan" class="btn btn-primary mt-2">Kembali</a></div></div>';
    return;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $namaKegiatan = trim($_POST['nama_kegiatan'] ?? '');
    if ($namaKegiatan === '') {
        $error = 'Nama kegiatan wajib diisi.';
    } else {
        $stmt = $db->prepare("UPDATE kegiatan SET
            nama_kegiatan=?, deskripsi=?, tgl_mulai=?, tgl_selesai=?, lokasi=?, anggaran=?, realisasi=?,
            status=?, penanggung_jawab=?, keterangan=? WHERE id=?");
        $stmt->execute([
            $namaKegiatan,
            trim($_POST['deskripsi'] ?? ''),
            $_POST['tgl_mulai'] ?: date('Y-m-d'),
            $_POST['tgl_selesai'] ?: date('Y-m-d'),
            trim($_POST['lokasi'] ?? ''),
            (int)($_POST['anggaran'] ?? 0),
            (int)($_POST['realisasi'] ?? 0),
            $_POST['status'] ?? 'direncanakan',
            ((int)($_POST['penanggung_jawab'] ?? 0)) ?: null,
            trim($_POST['keterangan'] ?? ''),
            $id,
        ]);
        logAktivitas($_SESSION['user']['id'], 'Edit kegiatan', 'kegiatan', $id, "Mengubah kegiatan {$namaKegiatan}");
        setFlash('success', 'Kegiatan diperbarui.');
        redirect('index.php?page=kegiatan-detail&id=' . $id);
    }
    $kegiatan = array_merge($kegiatan, $_POST);
}

$users = $db->query("SELECT id, nama, role FROM users WHERE aktif = 1 ORDER BY nama")->fetchAll();
?>

<div class="card-header">
    <div>
        <h2>✏️ Edit Kegiatan</h2>
        <p class="text-muted" style="font-size:.87rem;"><?= htmlspecialchars($kegiatan['nama_kegiatan']) ?></p>
    </div>
    <a href="index.php?page=kegiatan-detail&id=<?= $id ?>" class="btn btn-outline">← Kembali</a>
</div>

<?php if ($error): ?><div class="alert alert-red"><?= htmlspecialchars($error) ?></div><?php endif; ?>

<div class="card" style="max-width:760px;">
    <form method="post" action="index.php?page=kegiatan-edit&id=<?= $id ?>">
        <div class="form-group">
            <label class="form-label" for="nama_kegiatan">Nama Kegiatan *</label>
            <input type="text" id="nama_kegiatan" name="nama_kegiatan" required value="<?= htmlspecialchars($kegiatan['nama_kegiatan']) ?>">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="tgl_mulai">Tanggal Mulai</label>
                <input type="date" id="tgl_mulai" name="tgl_mulai" value="<?= htmlspecialchars($kegiatan['tgl_mulai'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="tgl_selesai">Tanggal Selesai</label>
                <input type="date" id="tgl_selesai" name="tgl_selesai" value="<?= htmlspecialchars($kegiatan['tgl_selesai'] ?? '') ?>">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="lokasi">Lokasi</label>
                <input type="text" id="lokasi" name="lokasi" value="<?= htmlspecialchars($kegiatan['lokasi'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="status">Status</label>
                <select id="status" name="status">
                    <?php foreach (['direncanakan' => 'Direncanakan', 'berlangsung' => 'Berlangsung', 'selesai' => 'Selesai', 'dibatalkan' => 'Dibatalkan'] as $v => $l): ?>
                        <option value="<?= $v ?>" <?= $kegiatan['status'] === $v ? 'selected' : '' ?>><?= $l ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="anggaran">Anggaran (Rp)</label>
                <input type="number" id="anggaran" name="anggaran" min="0" value="<?= (int)$kegiatan['anggaran'] ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="realisasi">Realisasi (Rp)</label>
                <input type="number" id="realisasi" name="realisasi" min="0" value="<?= (int)$kegiatan['realisasi'] ?>">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="penanggung_jawab">Penanggung Jawab</label>
            <select id="penanggung_jawab" name="penanggung_jawab">
                <option value="0">- Pilih -</option>
                <?php foreach ($users as $u): ?>
                    <option value="<?= (int)$u['id'] ?>" <?= (int)$kegiatan['penanggung_jawab'] === (int)$u['id'] ? 'selected' : '' ?>>
                        <?= htmlspecialchars($u['nama']) ?> (<?= labelRole($u['role']) ?>)
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label" for="deskripsi">Deskripsi</label>
            <textarea id="deskripsi" name="deskripsi"><?= htmlspecialchars($kegiatan['deskripsi'] ?? '') ?></textarea>
        </div>
        <div class="form-group">
            <label class="form-label" for="keterangan">Keterangan</label>
            <textarea id="keterangan" name="keterangan"><?= htmlspecialchars($kegiatan['keterangan'] ?? '') ?></textarea>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan Perubahan</button>
            <a href="index.php?page=kegiatan" class="btn btn-outline">Batal</a>
        </div>
    </form>
</div>
