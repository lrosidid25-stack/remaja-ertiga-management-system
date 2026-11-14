<?php
/**
 * PENGELUARAN — Tambah
 * Route: index.php?page=pengeluaran-tambah
 */

$db = getDB();
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nominal = (int)($_POST['nominal'] ?? 0);
    if ($nominal <= 0) {
        $error = 'Nominal harus lebih dari 0.';
    } else {
        $bukti = '';
        if (!empty($_FILES['bukti']['name'])) {
            $up = uploadFile($_FILES['bukti'], __DIR__ . '/../../uploads/nota', 'NOTA_');
            if ($up) $bukti = $up;
        }

        $stmt = $db->prepare("INSERT INTO pengeluaran (tanggal, kategori_id, kegiatan_id, keperluan, nominal, keterangan, bukti_path, dicatat_oleh)
            VALUES (?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $_POST['tanggal'] ?: date('Y-m-d'),
            ((int)($_POST['kategori_id'] ?? 0)) ?: null,
            ((int)($_POST['kegiatan_id'] ?? 0)) ?: null,
            trim($_POST['keperluan'] ?? ''),
            $nominal,
            trim($_POST['keterangan'] ?? ''),
            $bukti,
            $_SESSION['user']['id'],
        ]);

        $newId = (int)$db->lastInsertId();
        logAktivitas($_SESSION['user']['id'], 'Tambah pengeluaran', 'pengeluaran', $newId,
            'Pengeluaran ' . formatRupiah($nominal) . ' - ' . trim($_POST['keperluan'] ?? ''));
        setFlash('success', 'Pengeluaran sebesar <strong>' . formatRupiah($nominal) . '</strong> berhasil dicatat.');
        redirect('index.php?page=pengeluaran');
    }
}

$kategoriList = $db->query("SELECT * FROM kategori_pengeluaran ORDER BY nama")->fetchAll();
$kegiatanList = $db->query("SELECT id, nama_kegiatan FROM kegiatan ORDER BY id DESC")->fetchAll();
?>

<div class="card-header">
    <div>
        <h2>➕ Catat Pengeluaran</h2>
        <p class="text-muted" style="font-size:.87rem;">Catat pengeluaran kas organisasi.</p>
    </div>
    <a href="index.php?page=pengeluaran" class="btn btn-outline">← Kembali</a>
</div>

<?php if ($error): ?><div class="alert alert-red"><?= htmlspecialchars($error) ?></div><?php endif; ?>

<div class="card" style="max-width:720px;">
    <form method="post" action="index.php?page=pengeluaran-tambah" enctype="multipart/form-data">
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="tanggal">Tanggal *</label>
                <input type="date" id="tanggal" name="tanggal" required value="<?= htmlspecialchars($_POST['tanggal'] ?? date('Y-m-d')) ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="nominal">Nominal (Rp) *</label>
                <input type="number" id="nominal" name="nominal" min="1" required data-numeric
                       value="<?= htmlspecialchars($_POST['nominal'] ?? '') ?>" placeholder="Contoh: 75000">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="kategori_id">Kategori</label>
                <select id="kategori_id" name="kategori_id">
                    <option value="0">- Pilih Kategori -</option>
                    <?php foreach ($kategoriList as $k): ?>
                        <option value="<?= (int)$k['id'] ?>" <?= (int)($_POST['kategori_id'] ?? 0) === (int)$k['id'] ? 'selected' : '' ?>><?= htmlspecialchars($k['nama']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="kegiatan_id">Kegiatan Terkait</label>
                <select id="kegiatan_id" name="kegiatan_id">
                    <option value="0">- Tidak terkait -</option>
                    <?php foreach ($kegiatanList as $g): ?>
                        <option value="<?= (int)$g['id'] ?>" <?= (int)($_POST['kegiatan_id'] ?? 0) === (int)$g['id'] ? 'selected' : '' ?>><?= htmlspecialchars($g['nama_kegiatan']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="keperluan">Keperluan *</label>
            <input type="text" id="keperluan" name="keperluan" required placeholder="Contoh: Konsumsi rapat pengurus"
                   value="<?= htmlspecialchars($_POST['keperluan'] ?? '') ?>">
        </div>
        <div class="form-group">
            <label class="form-label" for="keterangan">Keterangan</label>
            <textarea id="keterangan" name="keterangan" placeholder="Catatan tambahan"><?= htmlspecialchars($_POST['keterangan'] ?? '') ?></textarea>
        </div>
        <div class="form-group">
            <label class="form-label" for="bukti">Bukti / Nota</label>
            <input type="file" id="bukti" name="bukti" accept="image/*">
            <div class="form-hint">JPG/PNG maksimal 2 MB.</div>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan Pengeluaran</button>
            <a href="index.php?page=pengeluaran" class="btn btn-outline">Batal</a>
        </div>
    </form>
</div>
