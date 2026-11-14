<?php
/**
 * IURAN — Daftar Tunggakan
 * Route: index.php?page=iuran-tunggakan
 */

$db = getDB();

$periodeList = $db->query("SELECT * FROM periode_tagihan ORDER BY id DESC LIMIT 36")->fetchAll();
$periodeId = (int)($_GET['periode'] ?? 0);
if ($periodeId === 0 && !empty($periodeList)) {
    $periodeId = (int)$periodeList[0]['id'];
}

$tunggakan = $periodeId ? getTunggakan($periodeId) : [];
$totalNominal = array_sum(array_map(fn($t) => (int)$t['nominal'], $tunggakan));

$periodeAktif = null;
foreach ($periodeList as $p) {
    if ((int)$p['id'] === $periodeId) { $periodeAktif = $p; break; }
}
?>

<div class="card-header">
    <div>
        <h2>⚠️ Tunggakan Iuran</h2>
        <p class="text-muted" style="font-size:.87rem;">Daftar anggota yang belum melunasi iuran pada periode terpilih.</p>
    </div>
    <a href="index.php?page=iuran" class="btn btn-outline">← Kembali</a>
</div>

<div class="card">
    <form method="get" action="index.php" class="flex-between" style="gap:10px;align-items:flex-end;">
        <input type="hidden" name="page" value="iuran-tunggakan">
        <div style="flex:1;min-width:240px;">
            <label class="form-label">Pilih Periode</label>
            <select name="periode" onchange="this.form.submit()">
                <?php if (empty($periodeList)): ?>
                    <option value="">Belum ada periode</option>
                <?php endif; ?>
                <?php foreach ($periodeList as $p): ?>
                    <option value="<?= (int)$p['id'] ?>" <?= (int)$p['id'] === $periodeId ? 'selected' : '' ?>>
                        <?= formatTanggalPendek($p['tgl_mulai']) ?> — <?= formatTanggalPendek($p['tgl_selesai']) ?> (<?= formatRupiah($p['nominal']) ?>)
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="btn-group">
            <button type="submit" class="btn btn-primary">Tampilkan</button>
        </div>
    </form>
</div>

<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-icon red">👥</div>
        <div class="stat-content"><h4>Jumlah Menunggak</h4><div class="stat-value"><?= count($tunggakan) ?></div><div class="stat-sub">anggota</div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon yellow">💰</div>
        <div class="stat-content"><h4>Total Tunggakan</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalNominal) ?></div><div class="stat-sub">belum masuk kas</div></div>
    </div>
</div>

<div class="card">
    <div class="card-title">Daftar Tunggakan<?= $periodeAktif ? ' — ' . formatTanggalPendek($periodeAktif['tgl_mulai']) . ' s/d ' . formatTanggalPendek($periodeAktif['tgl_selesai']) : '' ?></div>
    <?php if (!empty($tunggakan)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>NIR</th><th>Nama</th><th>No. HP</th><th>Nominal</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                <?php foreach ($tunggakan as $t): ?>
                    <tr>
                        <td style="font-family:ui-monospace,monospace;font-size:.8rem;"><?= htmlspecialchars($t['nir']) ?></td>
                        <td>
                            <a href="index.php?page=anggota-detail&id=<?= (int)$t['anggota_id'] ?>" style="font-weight:600;"><?= htmlspecialchars($t['nama_anggota']) ?></a>
                        </td>
                        <td style="font-size:.83rem;"><?= htmlspecialchars($t['no_hp'] ?: '-') ?></td>
                        <td><?= formatRupiah($t['nominal']) ?></td>
                        <td>
                            <?= $t['status'] === 'menunggu_konfirmasi'
                                ? '<span class="badge badge-yellow">Menunggu</span>'
                                : '<span class="badge badge-red">Belum Bayar</span>' ?>
                        </td>
                        <td>
                            <div class="btn-group">
                                <?php if (bolehAkses(roleTandaiLunas())): ?>
                                    <a href="index.php?page=iuran-bayar&id=<?= (int)$t['id'] ?>" class="btn btn-sm btn-success">Bayar</a>
                                <?php endif; ?>
                                <?php if (!empty($t['no_hp'])): ?>
                                    <?php
                                    $hp = preg_replace('/^0/', '62', preg_replace('/\D/', '', $t['no_hp']));
                                    $pesan = rawurlencode("Halo {$t['nama_anggota']}, iuran periode "
                                        . formatTanggalPendek($periodeAktif['tgl_mulai'] ?? '')
                                        . " s/d " . formatTanggalPendek($periodeAktif['tgl_selesai'] ?? '')
                                        . " sebesar " . formatRupiah($t['nominal']) . " belum tercatat lunas. Mohon segera diselesaikan. Terima kasih. 🙏");
                                    ?>
                                    <a href="https://wa.me/<?= htmlspecialchars($hp) ?>?text=<?= $pesan ?>" target="_blank" rel="noopener" class="btn btn-sm btn-outline">WA</a>
                                <?php endif; ?>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <div class="empty-icon">🎉</div>
            <h3>Tidak ada tunggakan</h3>
            <p>Semua tagihan pada periode ini sudah lunas.</p>
        </div>
    <?php endif; ?>
</div>
