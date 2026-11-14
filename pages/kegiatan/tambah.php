<?php
/**
 * KEGIATAN — Tambah
 * Route: index.php?page=kegiatan-tambah
 */

$db = getDB();
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $namaKegiatan = trim($_POST['nama_kegiatan'] ?? '');
    if ($namaKegiatan === '') {
        $error = 'Nama kegiatan wajib diisi.';
    } else {
        $stmt = $db->prepare("INSERT INTO kegiatan
            (nama_kegiatan, deskripsi, tgl_mulai, tgl_selesai, lokasi, anggaran, realisasi, status, penanggung_jawab, keterangan)
            VALUES (?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $namaKegiatan,
            trim($_POST['deskripsi'] ?? ''),
            $_POST['tgl_mulai'] ?: date('Y-m-d'),
            $_POST['tgl_selesai'] ?: ($_POST['tgl_mulai'] ?: date('Y-m-d')),
            trim($_POST['lokasi'] ?? ''),
            (int)($_POST['anggaran'] ?? 0),
            (int)($_POST['realisasi'] ?? 0),
            $_POST['status'] ?? 'direncanakan',
            ((int)($_POST['penanggung_jawab'] ?? 0)) ?: null,
            trim($_POST['keterangan'] ?? ''),
        ]);
        $newId = (int)$db->lastInsertId();
        logAktivitas($_SESSION['user']['id'], 'Tambah kegiatan', 'kegiatan', $newId, "Menambah kegiatan {$namaKegiatan}");
        setFlash('success', 'Kegiatan berhasil ditambahkan.');
        redirect('index.php?page=kegiatan-detail&id=' . $newId);
    }
}

$users = $db->query("SELECT id, nama, role FROM users WHERE aktif = 1 ORDER BY nama")->fetchAll();
?>

<div class="card-header">
    <div><h2>➕ Tambah Kegiatan</h2></div>
    <a href="index.php?page=kegiatan" class="btn btn-outline">← Kembali</a>
</div>

<?php if ($error): ?><div class="alert alert-red"><?= htmlspecialchars($error) ?></div><?php endif; ?>

<div class="card" style="max-width:760px;">
    <form method="post" action="index.php?page=kegiatan-tambah">
        <div class="form-group">
            <label class="form-label" for="nama_kegiatan">Nama Kegiatan *</label>
            <input type="text" id="nama_kegiatan" name="nama_kegiatan" required value="<?= htmlspecialchars($_POST['nama_kegiatan'] ?? '') ?>">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="tgl_mulai">Tanggal Mulai</label>
                <input type="date" id="tgl_mulai" name="tgl_mulai" value="<?= htmlspecialchars($_POST['tgl_mulai'] ?? date('Y-m-d')) ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="tgl_selesai">Tanggal Selesai</label>
                <input type="date" id="tgl_selesai" name="tgl_selesai" value="<?= htmlspecialchars($_POST['tgl_selesai'] ?? date('Y-m-d')) ?>">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="lokasi">Lokasi</label>
                <input type="text" id="lokasi" name="lokasi" value="<?= htmlspecialchars($_POST['lokasi'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="status">Status</label>
                <select id="status" name="status">
                    <?php foreach (['direncanakan' => 'Direncanakan', 'berlangsung' => 'Berlangsung', 'selesai' => 'Selesai', 'dibatalkan' => 'Dibatalkan'] as $v => $l): ?>
                        <option value="<?= $v ?>" <?= ($_POST['status'] ?? 'direncanakan') === $v ? 'selected' : '' ?>><?= $l ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="anggaran">Anggaran (Rp)</label>
                <input type="number" id="anggaran" name="anggaran" min="0" value="<?= (int)($_POST['anggaran'] ?? 0) ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="realisasi">Realisasi (Rp)</label>
                <input type="number" id="realisasi" name="realisasi" min="0" value="<?= (int)($_POST['realisasi'] ?? 0) ?>">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="penanggung_jawab">Penanggung Jawab</label>
            <select id="penanggung_jawab" name="penanggung_jawab">
                <option value="0">- Pilih -</option>
                <?php foreach ($users as $u): ?>
                    <option value="<?= (int)$u['id'] ?>" <?= (int)($_POST['penanggung_jawab'] ?? 0) === (int)$u['id'] ? 'selected' : '' ?>>
                        <?= htmlspecialchars($u['nama']) ?> (<?= labelRole($u['role']) ?>)
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label" for="deskripsi">Deskripsi</label>
            <textarea id="deskripsi" name="deskripsi"><?= htmlspecialchars($_POST['deskripsi'] ?? '') ?></textarea>
        </div>
        <div class="form-group">
            <label class="form-label" for="keterangan">Keterangan</label>
            <textarea id="keterangan" name="keterangan"><?= htmlspecialchars($_POST['keterangan'] ?? '') ?></textarea>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan Kegiatan</button>
            <a href="index.php?page=kegiatan" class="btn btn-outline">Batal</a>
        </div>
    </form>
</div>
