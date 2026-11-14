<?php
/**
 * METODE PEMBAYARAN — Edit
 * Route: index.php?page=metode-edit&id=..
 */

$db = getDB();
$id = (int)($_GET['id'] ?? 0);
$stmt = $db->prepare("SELECT * FROM metode_pembayaran WHERE id = ?");
$stmt->execute([$id]);
$metode = $stmt->fetch();

if (!$metode) {
    echo '<div class="card"><div class="empty-state"><div class="empty-icon">🔍</div><h3>Metode tidak ditemukan</h3>
        <a href="index.php?page=metode" class="btn btn-primary mt-2">Kembali</a></div></div>';
    return;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nama = trim($_POST['nama'] ?? '');
    if ($nama === '') {
        $error = 'Nama metode wajib diisi.';
    } else {
        $stmt = $db->prepare("UPDATE metode_pembayaran SET jenis=?, nama=?, nomor=?, atas_nama=?, urutan=?, aktif=? WHERE id=?");
        $stmt->execute([
            $_POST['jenis'] ?? 'tunai',
            $nama,
            trim($_POST['nomor'] ?? ''),
            trim($_POST['atas_nama'] ?? ''),
            (int)($_POST['urutan'] ?? 0),
            isset($_POST['aktif']) ? 1 : 0,
            $id,
        ]);
        logAktivitas($_SESSION['user']['id'], 'Edit metode bayar', 'metode_pembayaran', $id, "Mengubah metode {$nama}");
        setFlash('success', 'Metode pembayaran diperbarui.');
        redirect('index.php?page=metode');
    }
    $metode = array_merge($metode, $_POST);
}
?>

<div class="card-header">
    <div><h2>✏️ Edit Metode Pembayaran</h2></div>
    <a href="index.php?page=metode" class="btn btn-outline">← Kembali</a>
</div>

<?php if ($error): ?><div class="alert alert-red"><?= htmlspecialchars($error) ?></div><?php endif; ?>

<div class="card" style="max-width:640px;">
    <form method="post" action="index.php?page=metode-edit&id=<?= $id ?>">
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="jenis">Jenis</label>
                <select id="jenis" name="jenis">
                    <?php foreach (['tunai' => 'Tunai', 'transfer' => 'Transfer Bank', 'qris' => 'QRIS', 'e-wallet' => 'E-Wallet'] as $v => $l): ?>
                        <option value="<?= $v ?>" <?= $metode['jenis'] === $v ? 'selected' : '' ?>><?= $l ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="urutan">Urutan Tampil</label>
                <input type="number" id="urutan" name="urutan" value="<?= (int)$metode['urutan'] ?>" min="0">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="nama">Nama Metode *</label>
            <input type="text" id="nama" name="nama" required value="<?= htmlspecialchars($metode['nama']) ?>">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="nomor">Nomor Rekening / HP</label>
                <input type="text" id="nomor" name="nomor" value="<?= htmlspecialchars($metode['nomor'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="atas_nama">Atas Nama</label>
                <input type="text" id="atas_nama" name="atas_nama" value="<?= htmlspecialchars($metode['atas_nama'] ?? '') ?>">
            </div>
        </div>
        <div class="form-group checkbox-row">
            <input type="checkbox" id="aktif" name="aktif" value="1" <?= (int)$metode['aktif'] === 1 ? 'checked' : '' ?>>
            <label for="aktif" class="form-label" style="margin-bottom:0;">Tampilkan (aktif)</label>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan Perubahan</button>
            <a href="index.php?page=metode" class="btn btn-outline">Batal</a>
        </div>
    </form>
</div>
