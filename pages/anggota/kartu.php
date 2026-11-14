<?php
/**
 * ANGGOTA — Kartu Anggota (bisa dicetak)
 * Route: index.php?page=anggota-kartu&id=..
 */

$db = getDB();
$id = (int)($_GET['id'] ?? 0);
$stmt = $db->prepare("SELECT * FROM anggota WHERE id = ?");
$stmt->execute([$id]);
$anggota = $stmt->fetch();

$pengaturan = getAllPengaturan();
$namaOrg = ($pengaturan['nama_organisasi'] ?? '') ?: 'Remaja Ertiga';
$alamatParts = array_filter([
    $pengaturan['dukuh'] ?? '',
    !empty($pengaturan['rt']) ? 'RT ' . $pengaturan['rt'] : '',
    !empty($pengaturan['rw']) ? 'RW ' . $pengaturan['rw'] : '',
    $pengaturan['desa'] ?? '',
    $pengaturan['kecamatan'] ?? '',
]);
?>
<div class="card-header no-print">
    <div>
        <h2>🪪 Kartu Anggota</h2>
        <p class="text-muted" style="font-size:.87rem;">Kartu identitas anggota organisasi.</p>
    </div>
    <div class="btn-group">
        <button class="btn btn-primary" data-print>🖨️ Cetak Kartu</button>
        <a href="index.php?page=anggota" class="btn btn-outline">← Kembali</a>
    </div>
</div>

<?php if (!$anggota): ?>
    <div class="card"><div class="empty-state"><div class="empty-icon">🔍</div><h3>Anggota tidak ditemukan</h3></div></div>
<?php else: ?>
    <div class="kartu-anggota">
        <div class="kartu-head">
            <div style="font-size:1.8rem;margin-bottom:4px;">🏘️</div>
            <h3><?= htmlspecialchars($namaOrg) ?></h3>
            <?php if ($alamatParts): ?>
                <p><?= htmlspecialchars(implode(', ', $alamatParts)) ?></p>
            <?php endif; ?>
            <p style="margin-top:6px;letter-spacing:.16em;font-size:.68rem;text-transform:uppercase;">Kartu Anggota</p>
        </div>
        <div class="kartu-body">
            <?php if (!empty($anggota['foto'])): ?>
                <img src="<?= htmlspecialchars($anggota['foto']) ?>" alt="Foto"
                     style="width:88px;height:88px;object-fit:cover;border-radius:50%;margin:0 auto 12px;border:3px solid var(--green-100);">
            <?php else: ?>
                <div style="width:88px;height:88px;border-radius:50%;margin:0 auto 12px;display:grid;place-items:center;font-size:2rem;background:var(--green-50);border:3px solid var(--green-100);">
                    <?= $anggota['jenis_kelamin'] === 'P' ? '👩' : '👨' ?>
                </div>
            <?php endif; ?>
            <div style="font-weight:800;font-size:1.05rem;color:var(--slate-900);"><?= htmlspecialchars($anggota['nama']) ?></div>
            <div class="text-muted" style="font-size:.78rem;margin-top:2px;">
                <?= $anggota['jenis_kelamin'] === 'P' ? 'Perempuan' : 'Laki-laki' ?>
                <?= $anggota['tgl_lahir'] ? ' · ' . formatTanggal($anggota['tgl_lahir']) : '' ?>
            </div>
            <div class="kartu-nir">NIR <?= htmlspecialchars($anggota['nir']) ?></div>
            <?php if (!empty($anggota['tgl_bergabung'])): ?>
                <div class="text-muted" style="font-size:.75rem;margin-top:10px;">Bergabung <?= formatTanggal($anggota['tgl_bergabung']) ?></div>
            <?php endif; ?>
            <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--slate-200);font-size:.7rem;color:var(--slate-500);">
                Kartu ini sah selama terdaftar sebagai anggota aktif.
            </div>
        </div>
    </div>
<?php endif; ?>
