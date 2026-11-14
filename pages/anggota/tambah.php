<?php
/**
 * ANGGOTA — Form Tambah
 * Route: index.php?page=anggota-tambah
 */

$db = getDB();
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nama = trim($_POST['nama'] ?? '');
    $nir  = trim($_POST['nir'] ?? '');

    if ($nama === '') {
        $error = 'Nama anggota wajib diisi.';
    } else {
        if ($nir === '') {
            $nir = generateNIR();
        }

        // Pastikan NIR unik
        $cek = $db->prepare("SELECT COUNT(*) FROM anggota WHERE nir = ?");
        $cek->execute([$nir]);
        if ((int)$cek->fetchColumn() > 0) {
            $error = 'NIR sudah dipakai anggota lain. Gunakan NIR lain atau biarkan kosong untuk dibuat otomatis.';
        } else {
            $foto = '';
            if (!empty($_FILES['foto']['name'])) {
                $up = uploadFile($_FILES['foto'], __DIR__ . '/../../uploads/logo', 'AGT_');
                if ($up) $foto = $up;
            }

            $stmt = $db->prepare("INSERT INTO anggota
                (nir, nama, jenis_kelamin, tempat_lahir, tgl_lahir, alamat, no_hp, wajib_iuran, status, tgl_bergabung, foto, keterangan)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
            $stmt->execute([
                $nir,
                $nama,
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
            ]);

            $newId = (int)$db->lastInsertId();
            logAktivitas($_SESSION['user']['id'], 'Tambah anggota', 'anggota', $newId, "Menambah anggota {$nama} (NIR {$nir})");
            setFlash('success', "Anggota <strong>{$nama}</strong> berhasil ditambahkan dengan NIR <strong>{$nir}</strong>.");
            redirect('index.php?page=anggota-detail&id=' . $newId);
        }
    }
}
?>

<div class="card-header">
    <div>
        <h2>➕ Tambah Anggota</h2>
        <p class="text-muted" style="font-size:.87rem;">Lengkapi data anggota baru. NIR dapat dibiarkan kosong untuk dibuat otomatis.</p>
    </div>
    <a href="index.php?page=anggota" class="btn btn-outline">← Kembali</a>
</div>

<?php if ($error): ?>
    <div class="alert alert-red"><?= htmlspecialchars($error) ?></div>
<?php endif; ?>

<form method="post" action="index.php?page=anggota-tambah" enctype="multipart/form-data">
    <div class="card">
        <div class="card-title">📋 Data Pribadi</div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="nama">Nama Lengkap *</label>
                <input type="text" id="nama" name="nama" required value="<?= htmlspecialchars($_POST['nama'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="nir">NIR</label>
                <input type="text" id="nir" name="nir" value="<?= htmlspecialchars($_POST['nir'] ?? '') ?>" placeholder="Kosongkan untuk otomatis">
                <div class="form-hint">Nomor Induk Remaja, 12 digit acak bila dikosongkan.</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="jenis_kelamin">Jenis Kelamin</label>
                <select id="jenis_kelamin" name="jenis_kelamin">
                    <option value="L" <?= ($_POST['jenis_kelamin'] ?? '') === 'L' ? 'selected' : '' ?>>Laki-laki</option>
                    <option value="P" <?= ($_POST['jenis_kelamin'] ?? '') === 'P' ? 'selected' : '' ?>>Perempuan</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="no_hp">Nomor HP / WhatsApp</label>
                <input type="tel" id="no_hp" name="no_hp" value="<?= htmlspecialchars($_POST['no_hp'] ?? '') ?>" placeholder="08xxxxxxxxxx">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="tempat_lahir">Tempat Lahir</label>
                <input type="text" id="tempat_lahir" name="tempat_lahir" value="<?= htmlspecialchars($_POST['tempat_lahir'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="tgl_lahir">Tanggal Lahir</label>
                <input type="date" id="tgl_lahir" name="tgl_lahir" value="<?= htmlspecialchars($_POST['tgl_lahir'] ?? '') ?>">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="alamat">Alamat</label>
            <textarea id="alamat" name="alamat" placeholder="Alamat lengkap"><?= htmlspecialchars($_POST['alamat'] ?? '') ?></textarea>
        </div>
    </div>

    <div class="card">
        <div class="card-title">⚙️ Keanggotaan</div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="status">Status</label>
                <select id="status" name="status">
                    <?php foreach (['aktif' => 'Aktif', 'nonaktif' => 'Nonaktif', 'pindah' => 'Pindah', 'meninggal' => 'Meninggal'] as $v => $l): ?>
                        <option value="<?= $v ?>" <?= ($_POST['status'] ?? 'aktif') === $v ? 'selected' : '' ?>><?= $l ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="tgl_bergabung">Tanggal Bergabung</label>
                <input type="date" id="tgl_bergabung" name="tgl_bergabung" value="<?= htmlspecialchars($_POST['tgl_bergabung'] ?? date('Y-m-d')) ?>">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="foto">Foto Anggota</label>
            <input type="file" id="foto" name="foto" accept="image/*">
            <div class="form-hint">JPG/PNG maksimal 2 MB.</div>
        </div>
        <div class="form-group checkbox-row">
            <input type="checkbox" id="wajib_iuran" name="wajib_iuran" value="1" <?= !isset($_POST['nama']) || isset($_POST['wajib_iuran']) ? 'checked' : '' ?>>
            <label for="wajib_iuran" class="form-label" style="margin-bottom:0;">Wajib membayar iuran rutin</label>
        </div>
        <div class="form-group">
            <label class="form-label" for="keterangan">Keterangan</label>
            <textarea id="keterangan" name="keterangan" placeholder="Catatan tambahan (opsional)"><?= htmlspecialchars($_POST['keterangan'] ?? '') ?></textarea>
        </div>

        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan Anggota</button>
            <a href="index.php?page=anggota" class="btn btn-outline">Batal</a>
        </div>
    </div>
</form>
