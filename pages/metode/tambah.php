<?php
/**
 * METODE PEMBAYARAN — Tambah
 * Route: index.php?page=metode-tambah
 */

$db = getDB();
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nama = trim($_POST['nama'] ?? '');
    if ($nama === '') {
        $error = 'Nama metode wajib diisi.';
    } else {
        $stmt = $db->prepare("INSERT INTO metode_pembayaran (jenis, nama, nomor, atas_nama, urutan, aktif) VALUES (?,?,?,?,?,?)");
        $stmt->execute([
            $_POST['jenis'] ?? 'tunai',
            $nama,
            trim($_POST['nomor'] ?? ''),
            trim($_POST['atas_nama'] ?? ''),
            (int)($_POST['urutan'] ?? 0),
            isset($_POST['aktif']) ? 1 : 0,
        ]);
        logAktivitas($_SESSION['user']['id'], 'Tambah metode bayar', 'metode_pembayaran', (int)$db->lastInsertId(), "Menambah metode {$nama}");
        setFlash('success', 'Metode pembayaran ditambahkan.');
        redirect('index.php?page=metode');
    }
}
?>

<div class="card-header">
    <div><h2>➕ Tambah Metode Pembayaran</h2></div>
    <a href="index.php?page=metode" class="btn btn-outline">← Kembali</a>
</div>

<?php if ($error): ?><div class="alert alert-red"><?= htmlspecialchars($error) ?></div><?php endif; ?>

<div class="card" style="max-width:640px;">
    <form method="post" action="index.php?page=metode-tambah">
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="jenis">Jenis</label>
                <select id="jenis" name="jenis">
                    <option value="tunai">Tunai</option>
                    <option value="transfer">Transfer Bank</option>
                    <option value="qris">QRIS</option>
                    <option value="e-wallet">E-Wallet</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="urutan">Urutan Tampil</label>
                <input type="number" id="urutan" name="urutan" value="<?= (int)($_POST['urutan'] ?? 0) ?>" min="0">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="nama">Nama Metode *</label>
            <input type="text" id="nama" name="nama" required placeholder="Contoh: BCA 1234567890" value="<?= htmlspecialchars($_POST['nama'] ?? '') ?>">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="nomor">Nomor Rekening / HP</label>
                <input type="text" id="nomor" name="nomor" value="<?= htmlspecialchars($_POST['nomor'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="atas_nama">Atas Nama</label>
                <input type="text" id="atas_nama" name="atas_nama" value="<?= htmlspecialchars($_POST['atas_nama'] ?? '') ?>">
            </div>
        </div>
        <div class="form-group checkbox-row">
            <input type="checkbox" id="aktif" name="aktif" value="1" checked>
            <label for="aktif" class="form-label" style="margin-bottom:0;">Tampilkan (aktif)</label>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan</button>
            <a href="index.php?page=metode" class="btn btn-outline">Batal</a>
        </div>
    </form>
</div>
