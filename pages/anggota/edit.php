<?php
/**
 * ANGGOTA — Form Edit
 * Route: index.php?page=anggota-edit&id=..
 */

$db = getDB();
$id = (int)($_GET['id'] ?? 0);
$stmt = $db->prepare("SELECT * FROM anggota WHERE id = ?");
$stmt->execute([$id]);
$anggota = $stmt->fetch();

if (!$anggota) {
    echo '<div class="card"><div class="empty-state"><div class="empty-icon">🔍</div><h3>Anggota tidak ditemukan</h3>
        <a href="index.php?page=anggota" class="btn btn-primary mt-2">Kembali ke daftar</a></div></div>';
    return;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nama = trim($_POST['nama'] ?? '');
    $nir  = trim($_POST['nir'] ?? '');

    if ($nama === '' || $nir === '') {
        $error = 'Nama dan NIR wajib diisi.';
    } else {
        $cek = $db->prepare("SELECT COUNT(*) FROM anggota WHERE nir = ? AND id != ?");
        $cek->execute([$nir, $id]);
        if ((int)$cek->fetchColumn() > 0) {
            $error = 'NIR sudah dipakai anggota lain.';
        } else {
            $foto = $anggota['foto'];
            if (!empty($_FILES['foto']['name'])) {
                $up = uploadFile($_FILES['foto'], __DIR__ . '/../../uploads/logo', 'AGT_');
                if ($up) $foto = $up;
            }

            $stmt = $db->prepare("UPDATE anggota SET
                nir = ?, nama = ?, jenis_kelamin = ?, tempat_lahir = ?, tgl_lahir = ?,
                alamat = ?, no_hp = ?, wajib_iuran = ?, status = ?, tgl_bergabung = ?,
                foto = ?, keterangan = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?");
            $stmt->execute([
                $nir, $nama,
                ($_POST['jenis_kelamin'] ?? 'L') === 'P' ? 'P' : 'L',
                trim($_POST['tempat_lahir'] ?? ''),
                $_POST['tgl_lahir'] ?: null,
                trim($_POST['alamat'] ?? ''),
                trim($_POST['no_hp'] ?? ''),
                isset($_POST['wajib_iuran']) ? 1 : 0,
                $_POST['status'] ?? 'aktif',
                $_POST['tgl_bergabung'] ?: date('Y-m-d'),
                $foto,
                trim($_POST['keterangan'] ?? ''),
                $id,
            ]);

            logAktivitas($_SESSION['user']['id'], 'Edit anggota', 'anggota', $id, "Mengubah data anggota {$nama}");
            setFlash('success', 'Data anggota berhasil diperbarui.');
            redirect('index.php?page=anggota-detail&id=' . $id);
        }
    }
    $anggota = array_merge($anggota, $_POST);
}
?>

<div class="card-header">
    <div>
        <h2>✏️ Edit Anggota</h2>
        <p class="text-muted" style="font-size:.87rem;"><?= htmlspecialchars($anggota['nama']) ?> · NIR <?= htmlspecialchars($anggota['nir']) ?></p>
    </div>
    <div class="btn-group">
        <a href="index.php?page=anggota-detail&id=<?= $id ?>" class="btn btn-outline">Detail</a>
        <a href="index.php?page=anggota" class="btn btn-outline">← Kembali</a>
    </div>
</div>

<?php if ($error): ?>
    <div class="alert alert-red"><?= htmlspecialchars($error) ?></div>
<?php endif; ?>

<form method="post" action="index.php?page=anggota-edit&id=<?= $id ?>" enctype="multipart/form-data">
    <div class="card">
        <div class="card-title">📋 Data Pribadi</div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="nama">Nama Lengkap *</label>
                <input type="text" id="nama" name="nama" required value="<?= htmlspecialchars($anggota['nama']) ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="nir">NIR *</label>
                <input type="text" id="nir" name="nir" required value="<?= htmlspecialchars($anggota['nir']) ?>">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="jenis_kelamin">Jenis Kelamin</label>
                <select id="jenis_kelamin" name="jenis_kelamin">
                    <option value="L" <?= $anggota['jenis_kelamin'] !== 'P' ? 'selected' : '' ?>>Laki-laki</option>
                    <option value="P" <?= $anggota['jenis_kelamin'] === 'P' ? 'selected' : '' ?>>Perempuan</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="no_hp">Nomor HP / WhatsApp</label>
                <input type="tel" id="no_hp" name="no_hp" value="<?= htmlspecialchars($anggota['no_hp'] ?? '') ?>">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="tempat_lahir">Tempat Lahir</label>
                <input type="text" id="tempat_lahir" name="tempat_lahir" value="<?= htmlspecialchars($anggota['tempat_lahir'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="tgl_lahir">Tanggal Lahir</label>
                <input type="date" id="tgl_lahir" name="tgl_lahir" value="<?= htmlspecialchars($anggota['tgl_lahir'] ?? '') ?>">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="alamat">Alamat</label>
            <textarea id="alamat" name="alamat"><?= htmlspecialchars($anggota['alamat'] ?? '') ?></textarea>
        </div>
    </div>

    <div class="card">
        <div class="card-title">⚙️ Keanggotaan</div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="status">Status</label>
                <select id="status" name="status">
                    <?php foreach (['aktif' => 'Aktif', 'nonaktif' => 'Nonaktif', 'pindah' => 'Pindah', 'meninggal' => 'Meninggal'] as $v => $l): ?>
                        <option value="<?= $v ?>" <?= $anggota['status'] === $v ? 'selected' : '' ?>><?= $l ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="tgl_bergabung">Tanggal Bergabung</label>
                <input type="date" id="tgl_bergabung" name="tgl_bergabung" value="<?= htmlspecialchars($anggota['tgl_bergabung'] ?? '') ?>">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="foto">Ganti Foto</label>
            <input type="file" id="foto" name="foto" accept="image/*">
            <?php if (!empty($anggota['foto'])): ?>
                <div class="form-hint">Foto saat ini: <a href="<?= htmlspecialchars($anggota['foto']) ?>" target="_blank" rel="noopener">lihat</a></div>
            <?php endif; ?>
        </div>
        <div class="form-group checkbox-row">
            <input type="checkbox" id="wajib_iuran" name="wajib_iuran" value="1" <?= (int)($anggota['wajib_iuran'] ?? 0) === 1 ? 'checked' : '' ?>>
            <label for="wajib_iuran" class="form-label" style="margin-bottom:0;">Wajib membayar iuran rutin</label>
        </div>
        <div class="form-group">
            <label class="form-label" for="keterangan">Keterangan</label>
            <textarea id="keterangan" name="keterangan"><?= htmlspecialchars($anggota['keterangan'] ?? '') ?></textarea>
        </div>

        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan Perubahan</button>
            <a href="index.php?page=anggota-detail&id=<?= $id ?>" class="btn btn-outline">Batal</a>
        </div>
    </div>
</form>
