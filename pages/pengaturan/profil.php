<?php
/**
 * PENGATURAN — Profil Organisasi
 * Route: index.php?page=pengaturan-profil
 */

$error = '';
$sukses = '';

$fields = [
    'nama_organisasi' => 'Nama Organisasi',
    'dukuh' => 'Dukuh',
    'rt' => 'RT',
    'rw' => 'RW',
    'desa' => 'Desa',
    'kecamatan' => 'Kecamatan',
    'kabupaten' => 'Kabupaten',
    'provinsi' => 'Provinsi',
    'nama_ketua' => 'Nama Ketua',
    'no_hp_organisasi' => 'No. HP Organisasi',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (trim($_POST['nama_organisasi'] ?? '') === '') {
        $error = 'Nama organisasi wajib diisi.';
    } else {
        foreach ($fields as $k => $label) {
            updatePengaturan($k, trim($_POST[$k] ?? ''));
        }

        if (!empty($_FILES['logo']['name'])) {
            $up = uploadFile($_FILES['logo'], __DIR__ . '/../../uploads/logo', 'LOGO_');
            if ($up) updatePengaturan('logo', $up);
        }

        logAktivitas($_SESSION['user']['id'], 'Ubah profil', 'pengaturan', 0, 'Mengubah profil organisasi');
        setFlash('success', 'Profil organisasi berhasil disimpan.');
        redirect('index.php?page=pengaturan-profil');
    }
}

$p = getAllPengaturan();
?>

<div class="card-header">
    <div>
        <h2>🏘️ Profil Organisasi</h2>
        <p class="text-muted" style="font-size:.87rem;">Data ini tampil di halaman publik, kartu anggota, dan laporan.</p>
    </div>
    <a href="index.php?page=pengaturan" class="btn btn-outline">← Pengaturan</a>
</div>

<?php if ($error): ?><div class="alert alert-red"><?= htmlspecialchars($error) ?></div><?php endif; ?>

<div class="card" style="max-width:760px;">
    <form method="post" action="index.php?page=pengaturan-profil" enctype="multipart/form-data">
        <div class="form-group">
            <label class="form-label" for="nama_organisasi">Nama Organisasi *</label>
            <input type="text" id="nama_organisasi" name="nama_organisasi" required
                   value="<?= htmlspecialchars($p['nama_organisasi'] ?? '') ?>">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="dukuh">Dukuh</label>
                <input type="text" id="dukuh" name="dukuh" value="<?= htmlspecialchars($p['dukuh'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="desa">Desa</label>
                <input type="text" id="desa" name="desa" value="<?= htmlspecialchars($p['desa'] ?? '') ?>">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="rt">RT</label>
                <input type="text" id="rt" name="rt" value="<?= htmlspecialchars($p['rt'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="rw">RW</label>
                <input type="text" id="rw" name="rw" value="<?= htmlspecialchars($p['rw'] ?? '') ?>">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="kecamatan">Kecamatan</label>
                <input type="text" id="kecamatan" name="kecamatan" value="<?= htmlspecialchars($p['kecamatan'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="kabupaten">Kabupaten</label>
                <input type="text" id="kabupaten" name="kabupaten" value="<?= htmlspecialchars($p['kabupaten'] ?? '') ?>">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="provinsi">Provinsi</label>
            <input type="text" id="provinsi" name="provinsi" value="<?= htmlspecialchars($p['provinsi'] ?? '') ?>">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="nama_ketua">Nama Ketua</label>
                <input type="text" id="nama_ketua" name="nama_ketua" value="<?= htmlspecialchars($p['nama_ketua'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="no_hp_organisasi">No. HP Organisasi</label>
                <input type="tel" id="no_hp_organisasi" name="no_hp_organisasi" value="<?= htmlspecialchars($p['no_hp_organisasi'] ?? '') ?>">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="logo">Logo Organisasi</label>
            <input type="file" id="logo" name="logo" accept="image/*">
            <?php if (!empty($p['logo'])): ?>
                <div class="form-hint">Logo saat ini: <a href="<?= htmlspecialchars($p['logo']) ?>" target="_blank" rel="noopener">lihat</a></div>
            <?php endif; ?>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan Profil</button>
            <a href="index.php?page=pengaturan" class="btn btn-outline">Batal</a>
        </div>
    </form>
</div>
