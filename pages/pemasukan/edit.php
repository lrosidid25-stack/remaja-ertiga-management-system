<?php
/**
 * PEMASUKAN — Edit
 * Route: index.php?page=pemasukan-edit&id=..
 */

$db = getDB();
$id = (int)($_GET['id'] ?? 0);
$stmt = $db->prepare("SELECT * FROM pemasukan WHERE id = ?");
$stmt->execute([$id]);
$pemasukan = $stmt->fetch();

if (!$pemasukan) {
    echo '<div class="card"><div class="empty-state"><div class="empty-icon">🔍</div><h3>Catatan tidak ditemukan</h3>
        <a href="index.php?page=pemasukan" class="btn btn-primary mt-2">Kembali</a></div></div>';
    return;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nominal = (int)($_POST['nominal'] ?? 0);
    if ($nominal <= 0) {
        $error = 'Nominal harus lebih dari 0.';
    } else {
        $bukti = $pemasukan['bukti_path'];
        if (!empty($_FILES['bukti']['name'])) {
            $up = uploadFile($_FILES['bukti'], __DIR__ . '/../../uploads/nota', 'NOTA_');
            if ($up) $bukti = $up;
        }
        $stmt = $db->prepare("UPDATE pemasukan SET tanggal=?, kategori_id=?, kegiatan_id=?, sumber=?, nominal=?, keterangan=?, bukti_path=? WHERE id=?");
        $stmt->execute([
            $_POST['tanggal'] ?: date('Y-m-d'),
            ((int)($_POST['kategori_id'] ?? 0)) ?: null,
            ((int)($_POST['kegiatan_id'] ?? 0)) ?: null,
            trim($_POST['sumber'] ?? ''),
            $nominal,
            trim($_POST['keterangan'] ?? ''),
            $bukti,
            $id,
        ]);
        logAktivitas($_SESSION['user']['id'], 'Edit pemasukan', 'pemasukan', $id, 'Mengubah pemasukan ' . formatRupiah($nominal));
        setFlash('success', 'Catatan pemasukan diperbarui.');
        redirect('index.php?page=pemasukan');
    }
    $pemasukan = array_merge($pemasukan, $_POST);
}

$kategoriList = $db->query("SELECT * FROM kategori_pemasukan ORDER BY nama")->fetchAll();
$kegiatanList = $db->query("SELECT id, nama_kegiatan FROM kegiatan ORDER BY id DESC")->fetchAll();
?>

<div class="card-header">
    <div><h2>✏️ Edit Pemasukan</h2></div>
    <a href="index.php?page=pemasukan" class="btn btn-outline">← Kembali</a>
</div>

<?php if ($error): ?><div class="alert alert-red"><?= htmlspecialchars($error) ?></div><?php endif; ?>

<div class="card" style="max-width:720px;">
    <form method="post" action="index.php?page=pemasukan-edit&id=<?= $id ?>" enctype="multipart/form-data">
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="tanggal">Tanggal *</label>
                <input type="date" id="tanggal" name="tanggal" required value="<?= htmlspecialchars($pemasukan['tanggal']) ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="nominal">Nominal (Rp) *</label>
                <input type="number" id="nominal" name="nominal" min="1" required data-numeric value="<?= (int)$pemasukan['nominal'] ?>">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="kategori_id">Kategori</label>
                <select id="kategori_id" name="kategori_id">
                    <option value="0">- Pilih Kategori -</option>
                    <?php foreach ($kategoriList as $k): ?>
                        <option value="<?= (int)$k['id'] ?>" <?= (int)$pemasukan['kategori_id'] === (int)$k['id'] ? 'selected' : '' ?>><?= htmlspecialchars($k['nama']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="kegiatan_id">Kegiatan Terkait</label>
                <select id="kegiatan_id" name="kegiatan_id">
                    <option value="0">- Tidak terkait -</option>
                    <?php foreach ($kegiatanList as $g): ?>
                        <option value="<?= (int)$g['id'] ?>" <?= (int)$pemasukan['kegiatan_id'] === (int)$g['id'] ? 'selected' : '' ?>><?= htmlspecialchars($g['nama_kegiatan']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="sumber">Sumber Dana</label>
            <input type="text" id="sumber" name="sumber" value="<?= htmlspecialchars($pemasukan['sumber'] ?? '') ?>">
        </div>
        <div class="form-group">
            <label class="form-label" for="keterangan">Keterangan</label>
            <textarea id="keterangan" name="keterangan"><?= htmlspecialchars($pemasukan['keterangan'] ?? '') ?></textarea>
        </div>
        <div class="form-group">
            <label class="form-label" for="bukti">Ganti Bukti / Nota</label>
            <input type="file" id="bukti" name="bukti" accept="image/*">
            <?php if (!empty($pemasukan['bukti_path'])): ?>
                <div class="form-hint">Bukti saat ini: <a href="<?= htmlspecialchars($pemasukan['bukti_path']) ?>" target="_blank" rel="noopener">lihat</a></div>
            <?php endif; ?>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan Perubahan</button>
            <a href="index.php?page=pemasukan" class="btn btn-outline">Batal</a>
        </div>
    </form>
</div>
