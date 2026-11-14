<?php
/**
 * NOTIFIKASI — Pengingat Tunggakan
 * Route: index.php?page=notifikasi
 */

$db = getDB();

$periodeList = $db->query("SELECT * FROM periode_tagihan ORDER BY id DESC LIMIT 24")->fetchAll();
$periodeId = (int)($_GET['periode'] ?? 0);
if ($periodeId === 0 && !empty($periodeList)) $periodeId = (int)$periodeList[0]['id'];

$periode = null;
foreach ($periodeList as $p) if ((int)$p['id'] === $periodeId) $periode = $p;

$tunggakan = $periodeId ? getTunggakan($periodeId) : [];
$totalNominal = array_sum(array_map(fn($t) => (int)$t['nominal'], $tunggakan));
$denganHp = array_values(array_filter($tunggakan, fn($t) => !empty($t['no_hp'])));

$template = "Halo {nama}, iuran {organisasi} periode {periode} sebesar {nominal} belum tercatat lunas. "
          . "Mohon segera melakukan pembayaran atau konfirmasi ke bendahara. Terima kasih 🙏";

$namaOrg = getPengaturan('nama_organisasi') ?: 'Remaja Ertiga';
?>

<div class="card-header">
    <div>
        <h2>📢 Notifikasi &amp; Pengingat</h2>
        <p class="text-muted" style="font-size:.87rem;">Kirim pengingat iuran ke anggota yang belum membayar via WhatsApp.</p>
    </div>
    <a href="index.php?page=iuran-tunggakan" class="btn btn-outline">⚠️ Lihat Tunggakan</a>
</div>

<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-icon red">👥</div>
        <div class="stat-content"><h4>Menunggak</h4><div class="stat-value"><?= count($tunggakan) ?></div><div class="stat-sub">anggota</div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon yellow">💰</div>
        <div class="stat-content"><h4>Total Tunggakan</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalNominal) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon green">📱</div>
        <div class="stat-content"><h4>Bisa Dihubungi</h4><div class="stat-value"><?= count($denganHp) ?></div><div class="stat-sub">punya nomor HP</div></div>
    </div>
</div>

<div class="card">
    <form method="get" action="index.php" class="flex-between" style="gap:10px;align-items:flex-end;">
        <input type="hidden" name="page" value="notifikasi">
        <div style="flex:1;min-width:240px;">
            <label class="form-label">Periode</label>
            <select name="periode" onchange="this.form.submit()">
                <?php if (empty($periodeList)): ?><option value="">Belum ada periode</option><?php endif; ?>
                <?php foreach ($periodeList as $p): ?>
                    <option value="<?= (int)$p['id'] ?>" <?= (int)$p['id'] === $periodeId ? 'selected' : '' ?>>
                        <?= formatTanggalPendek($p['tgl_mulai']) ?> — <?= formatTanggalPendek($p['tgl_selesai']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <button type="submit" class="btn btn-primary">Tampilkan</button>
    </form>
</div>

<div class="card">
    <div class="card-title">✉️ Template Pesan</div>
    <div class="form-group">
        <textarea id="template" rows="3"><?= htmlspecialchars($template) ?></textarea>
        <div class="form-hint">Variabel tersedia: {nama}, {organisasi}, {periode}, {nominal}. Pesan terbuka di WhatsApp Anda.</div>
    </div>
</div>

<div class="card">
    <div class="card-title">📋 Daftar Penerima Pengingat</div>
    <?php if (!empty($tunggakan)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>Nama</th><th>NIR</th><th>Nominal</th><th>No. HP</th><th>Aksi</th></tr></thead>
                <tbody>
                <?php foreach ($tunggakan as $t): ?>
                    <tr>
                        <td style="font-weight:600;"><?= htmlspecialchars($t['nama_anggota']) ?></td>
                        <td style="font-family:ui-monospace,monospace;font-size:.8rem;"><?= htmlspecialchars($t['nir']) ?></td>
                        <td><?= formatRupiah($t['nominal']) ?></td>
                        <td style="font-size:.84rem;"><?= htmlspecialchars($t['no_hp'] ?: '-') ?></td>
                        <td>
                            <?php if (!empty($t['no_hp'])):
                                $hp = preg_replace('/^0/', '62', preg_replace('/\D/', '', $t['no_hp']));
                                $pesan = strtr($template, [
                                    '{nama}' => $t['nama_anggota'],
                                    '{organisasi}' => $namaOrg,
                                    '{periode}' => formatTanggalPendek($periode['tgl_mulai'] ?? '') . ' s/d ' . formatTanggalPendek($periode['tgl_selesai'] ?? ''),
                                    '{nominal}' => formatRupiah($t['nominal']),
                                ]);
                            ?>
                                <a class="btn btn-sm btn-success" target="_blank" rel="noopener"
                                   href="https://wa.me/<?= htmlspecialchars($hp) ?>?text=<?= rawurlencode($pesan) ?>">📱 Kirim WA</a>
                            <?php else: ?>
                                <span class="text-muted" style="font-size:.78rem;">Nomor HP belum diisi</span>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <div class="mt-2" style="background:var(--slate-50);border:1px solid var(--slate-200);border-radius:12px;padding:14px;">
            <div class="form-label">Pratinjau Pesan (anggota pertama)</div>
            <p id="preview" style="font-size:.85rem;color:var(--slate-600);white-space:pre-wrap;"></p>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <div class="empty-icon">🎉</div>
            <h3>Tidak ada tunggakan</h3>
            <p>Semua anggota sudah lunas pada periode ini.</p>
        </div>
    <?php endif; ?>
</div>

<script>
(function () {
    var tpl = document.getElementById('template');
    var preview = document.getElementById('preview');
    if (!tpl || !preview) return;
    var data = <?= json_encode([
        'nama' => $tunggakan[0]['nama_anggota'] ?? 'Nama Anggota',
        'organisasi' => $namaOrg,
        'periode' => formatTanggalPendek($periode['tgl_mulai'] ?? '') . ' s/d ' . formatTanggalPendek($periode['tgl_selesai'] ?? ''),
        'nominal' => formatRupiah($tunggakan[0]['nominal'] ?? 0),
    ], JSON_UNESCAPED_UNICODE) ?>;

    function render() {
        var p = tpl.value;
        Object.keys(data).forEach(function (k) {
            p = p.split('{' + k + '}').join(data[k]);
        });
        preview.textContent = p;
    }
    tpl.addEventListener('input', render);
    render();
})();
</script>
