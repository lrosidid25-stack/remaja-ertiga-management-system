<?php
/**
 * PENGATURAN — Iuran (jenis & nominal)
 * Route: index.php?page=pengaturan-iuran
 */

$db = getDB();
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $aksi = $_POST['aksi'] ?? '';

    if ($aksi === 'setting') {
        $nominal = (int)($_POST['nominal_per_hari'] ?? 0);
        if ($nominal <= 0) {
            $error = 'Nominal per hari harus lebih dari 0.';
        } else {
            updatePengaturan('nominal_per_hari', (string)$nominal);
            updatePengaturan('tgl_mulai_iuran', $_POST['tgl_mulai_iuran'] ?: date('Y-m-d'));
            setFlash('success', 'Pengaturan iuran disimpan.');
            redirect('index.php?page=pengaturan-iuran');
        }
    } elseif ($aksi === 'tambah_jenis') {
        $nama = trim($_POST['nama'] ?? '');
        $nom = (int)($_POST['nominal_per_hari'] ?? 0);
        if ($nama === '' || $nom <= 0) {
            $error = 'Nama dan nominal jenis iuran wajib diisi.';
        } else {
            $db->prepare("INSERT INTO jenis_iuran (nama, nominal_per_hari, tgl_berlaku, keterangan, aktif) VALUES (?,?,?,?,?)")
               ->execute([$nama, $nom, $_POST['tgl_berlaku'] ?: date('Y-m-d'), trim($_POST['keterangan'] ?? ''), 1]);
            setFlash('success', 'Jenis iuran ditambahkan.');
            redirect('index.php?page=pengaturan-iuran');
        }
    } elseif ($aksi === 'hapus_jenis') {
        $db->prepare("DELETE FROM jenis_iuran WHERE id = ?")->execute([(int)($_POST['id'] ?? 0)]);
        setFlash('success', 'Jenis iuran dihapus.');
        redirect('index.php?page=pengaturan-iuran');
    }
}

$p = getAllPengaturan();
$jenisList = $db->query("SELECT * FROM jenis_iuran ORDER BY id")->fetchAll();
?>

<div class="card-header">
    <div>
        <h2>💰 Pengaturan Iuran</h2>
        <p class="text-muted" style="font-size:.87rem;">Nominal dasar iuran dan jenis-jenis iuran organisasi.</p>
    </div>
    <a href="index.php?page=pengaturan" class="btn btn-outline">← Pengaturan</a>
</div>

<?php if ($error): ?><div class="alert alert-red"><?= htmlspecialchars($error) ?></div><?php endif; ?>

<div class="grid-2">
    <div class="card">
        <div class="card-title">⚙️ Nominal Dasar</div>
        <form method="post" action="index.php?page=pengaturan-iuran">
            <input type="hidden" name="aksi" value="setting">
            <div class="form-group">
                <label class="form-label" for="nominal_per_hari">Nominal Iuran per Hari (Rp)</label>
                <input type="number" id="nominal_per_hari" name="nominal_per_hari" min="1" required
                       value="<?= (int)($p['nominal_per_hari'] ?? 500) ?>">
                <div class="form-hint">Dipakai saat generate tagihan: nominal × jumlah hari.</div>
            </div>
            <div class="form-group">
                <label class="form-label" for="tgl_mulai_iuran">Tanggal Mulai Iuran</label>
                <input type="date" id="tgl_mulai_iuran" name="tgl_mulai_iuran" value="<?= htmlspecialchars($p['tgl_mulai_iuran'] ?? date('Y-m-d')) ?>">
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">💾 Simpan</button>
            </div>
        </form>
    </div>

    <div class="card">
        <div class="card-title">➕ Tambah Jenis Iuran</div>
        <form method="post" action="index.php?page=pengaturan-iuran">
            <input type="hidden" name="aksi" value="tambah_jenis">
            <div class="form-group">
                <label class="form-label" for="nama">Nama Jenis</label>
                <input type="text" id="nama" name="nama" required placeholder="Contoh: Iuran Harian">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="nominal">Nominal per Hari</label>
                    <input type="number" id="nominal" name="nominal_per_hari" min="1" required value="500">
                </div>
                <div class="form-group">
                    <label class="form-label" for="tgl_berlaku">Berlaku Sejak</label>
                    <input type="date" id="tgl_berlaku" name="tgl_berlaku" value="<?= date('Y-m-d') ?>">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="keterangan">Keterangan</label>
                <textarea id="keterangan" name="keterangan"></textarea>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">➕ Tambah</button>
            </div>
        </form>
    </div>
</div>

<div class="card">
    <div class="card-title">📋 Daftar Jenis Iuran</div>
    <?php if (!empty($jenisList)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>Nama</th><th>Nominal/Hari</th><th>Berlaku</th><th>Status</th><th>Keterangan</th><th>Aksi</th></tr></thead>
                <tbody>
                <?php foreach ($jenisList as $j): ?>
                    <tr>
                        <td style="font-weight:600;"><?= htmlspecialchars($j['nama']) ?></td>
                        <td><?= formatRupiah($j['nominal_per_hari']) ?></td>
                        <td style="font-size:.83rem;"><?= $j['tgl_berlaku'] ? formatTanggalPendek($j['tgl_berlaku']) : '-' ?></td>
                        <td><?= (int)$j['aktif'] === 1 ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-gray">Nonaktif</span>' ?></td>
                        <td style="font-size:.83rem;"><?= htmlspecialchars($j['keterangan'] ?: '-') ?></td>
                        <td>
                            <form method="post" action="index.php?page=pengaturan-iuran" onsubmit="return confirm('Hapus jenis iuran ini?');">
                                <input type="hidden" name="aksi" value="hapus_jenis">
                                <input type="hidden" name="id" value="<?= (int)$j['id'] ?>">
                                <button type="submit" class="btn btn-sm btn-outline-danger">Hapus</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state" style="padding:20px;"><p>Belum ada jenis iuran.</p></div>
    <?php endif; ?>
</div>
