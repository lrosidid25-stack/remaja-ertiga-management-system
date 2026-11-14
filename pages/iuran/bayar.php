<?php
/**
 * IURAN — Tandai / Catat Pembayaran
 * Route: index.php?page=iuran-bayar&id=<tagihan_id>
 */

$db = getDB();
$id = (int)($_GET['id'] ?? 0);
$error = '';

$stmt = $db->prepare("SELECT t.*, a.nama, a.nir, p.tgl_mulai, p.tgl_selesai, p.jml_hari
    FROM tagihan_iuran t
    JOIN anggota a ON t.anggota_id = a.id
    JOIN periode_tagihan p ON t.periode_id = p.id
    WHERE t.id = ?");
$stmt->execute([$id]);
$tagihan = $stmt->fetch();

if (!$tagihan) {
    echo '<div class="card"><div class="empty-state"><div class="empty-icon">🔍</div><h3>Tagihan tidak ditemukan</h3>
        <a href="index.php?page=iuran" class="btn btn-primary mt-2">Kembali</a></div></div>';
    return;
}

$metodeList = $db->query("SELECT * FROM metode_pembayaran WHERE aktif = 1 ORDER BY urutan, id")->fetchAll();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $tglBayar = $_POST['tgl_bayar'] ?: date('Y-m-d');
    $metode   = trim($_POST['metode'] ?? '');
    $ket      = trim($_POST['keterangan'] ?? '');
    $statusBaru = ($_POST['status'] ?? 'lunas') === 'menunggu_konfirmasi' ? 'menunggu_konfirmasi' : 'lunas';

    $bukti = $tagihan['bukti_path'];
    if (!empty($_FILES['bukti']['name'])) {
        $up = uploadFile($_FILES['bukti'], __DIR__ . '/../../uploads/bukti', 'TRF_');
        if ($up) {
            $bukti = $up;
        } else {
            $error = 'Gagal mengunggah bukti. Pastikan format JPG/PNG dan maksimal 2 MB.';
        }
    }

    if ($error === '') {
        $stmt = $db->prepare("UPDATE tagihan_iuran SET
            status = ?, tgl_bayar = ?, metode = ?, keterangan = ?, bukti_path = ?,
            dicatat_oleh = ?, dikonfirmasi_oleh = ?, tgl_konfirmasi = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([
            $statusBaru, $tglBayar, $metode, $ket, $bukti,
            $_SESSION['user']['id'],
            $statusBaru === 'lunas' ? $_SESSION['user']['id'] : null,
            $id,
        ]);

        logAktivitas($_SESSION['user']['id'], 'Catat pembayaran', 'tagihan_iuran', $id,
            "Pembayaran iuran {$tagihan['nama']} periode {$tagihan['tgl_mulai']} s/d {$tagihan['tgl_selesai']}");
        setFlash('success', 'Pembayaran <strong>' . htmlspecialchars($tagihan['nama']) . '</strong> berhasil dicatat.');
        redirect('index.php?page=iuran-detail&id=' . (int)$tagihan['periode_id']);
    }
}
?>

<div class="card-header">
    <div>
        <h2>💵 Catat Pembayaran Iuran</h2>
        <p class="text-muted" style="font-size:.87rem;"><?= htmlspecialchars($tagihan['nama']) ?> · NIR <?= htmlspecialchars($tagihan['nir']) ?></p>
    </div>
    <a href="index.php?page=iuran-detail&id=<?= (int)$tagihan['periode_id'] ?>" class="btn btn-outline">← Kembali</a>
</div>

<?php if ($error): ?>
    <div class="alert alert-red"><?= htmlspecialchars($error) ?></div>
<?php endif; ?>

<div class="grid-2">
    <div class="card">
        <div class="card-title">📋 Informasi Tagihan</div>
        <div class="detail-list">
            <div class="detail-row"><span>Nama</span><span><?= htmlspecialchars($tagihan['nama']) ?></span></div>
            <div class="detail-row"><span>NIR</span><span style="font-family:ui-monospace,monospace;"><?= htmlspecialchars($tagihan['nir']) ?></span></div>
            <div class="detail-row"><span>Periode</span><span><?= formatTanggalPendek($tagihan['tgl_mulai']) ?> — <?= formatTanggalPendek($tagihan['tgl_selesai']) ?></span></div>
            <div class="detail-row"><span>Jumlah Hari</span><span><?= (int)$tagihan['jml_hari'] ?> hari</span></div>
            <div class="detail-row"><span>Nominal</span><span style="color:var(--green-700);font-size:1.1rem;"><?= formatRupiah($tagihan['nominal']) ?></span></div>
            <div class="detail-row"><span>Status Saat Ini</span><span><?= ucfirst(str_replace('_', ' ', htmlspecialchars($tagihan['status']))) ?></span></div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">✅ Form Pembayaran</div>
        <form method="post" action="index.php?page=iuran-bayar&id=<?= $id ?>" enctype="multipart/form-data">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="tgl_bayar">Tanggal Bayar</label>
                    <input type="date" id="tgl_bayar" name="tgl_bayar" value="<?= date('Y-m-d') ?>">
                </div>
                <div class="form-group">
                    <label class="form-label" for="metode">Metode</label>
                    <select id="metode" name="metode">
                        <option value="">- Pilih -</option>
                        <?php foreach ($metodeList as $m): ?>
                            <option value="<?= htmlspecialchars($m['nama']) ?>"><?= htmlspecialchars($m['nama']) ?></option>
                        <?php endforeach; ?>
                        <option value="Tunai">Tunai</option>
                        <option value="Transfer">Transfer</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="status">Status Setelah Dicatat</label>
                <select id="status" name="status">
                    <option value="lunas">✅ Langsung Lunas</option>
                    <option value="menunggu_konfirmasi" <?= $tagihan['status'] === 'menunggu_konfirmasi' ? 'selected' : '' ?>>⏳ Menunggu Konfirmasi</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="bukti">Bukti Pembayaran</label>
                <input type="file" id="bukti" name="bukti" accept="image/*">
                <?php if (!empty($tagihan['bukti_path'])): ?>
                    <div class="form-hint">Bukti sebelumnya: <a href="<?= htmlspecialchars($tagihan['bukti_path']) ?>" target="_blank" rel="noopener">lihat</a></div>
                <?php endif; ?>
            </div>
            <div class="form-group">
                <label class="form-label" for="keterangan">Keterangan</label>
                <textarea id="keterangan" name="keterangan" placeholder="Catatan pembayaran (opsional)"><?= htmlspecialchars($tagihan['keterangan'] ?? '') ?></textarea>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">💾 Simpan Pembayaran</button>
                <a href="index.php?page=iuran-detail&id=<?= (int)$tagihan['periode_id'] ?>" class="btn btn-outline">Batal</a>
            </div>
        </form>
    </div>
</div>
