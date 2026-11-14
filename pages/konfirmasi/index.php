<?php
/**
 * KONFIRMASI — Verifikasi Pembayaran yang Menunggu
 * Route: index.php?page=konfirmasi
 */

$db = getDB();

// Aksi konfirmasi / tolak
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $tagihanId = (int)($_POST['tagihan_id'] ?? 0);
    $aksi = $_POST['aksi'] ?? '';

    if ($tagihanId > 0 && in_array($aksi, ['terima', 'tolak'], true)) {
        $stmt = $db->prepare("SELECT t.*, a.nama FROM tagihan_iuran t JOIN anggota a ON t.anggota_id=a.id WHERE t.id = ?");
        $stmt->execute([$tagihanId]);
        $tgh = $stmt->fetch();

        if ($tgh) {
            if ($aksi === 'terima') {
                $db->prepare("UPDATE tagihan_iuran SET status='lunas', dikonfirmasi_oleh=?, tgl_konfirmasi=CURRENT_TIMESTAMP,
                    tgl_bayar = CASE WHEN tgl_bayar IS NULL OR tgl_bayar='' THEN ? ELSE tgl_bayar END,
                    updated_at=CURRENT_TIMESTAMP WHERE id=?")
                   ->execute([$_SESSION['user']['id'], date('Y-m-d'), $tagihanId]);
                logAktivitas($_SESSION['user']['id'], 'Konfirmasi bayar', 'tagihan_iuran', $tagihanId,
                    "Konfirmasi pembayaran {$tgh['nama']} sebesar " . formatRupiah($tgh['nominal']));
                setFlash('success', 'Pembayaran <strong>' . htmlspecialchars($tgh['nama']) . '</strong> dikonfirmasi LUNAS.');
            } else {
                $db->prepare("UPDATE tagihan_iuran SET status='ditolak', dikonfirmasi_oleh=?, tgl_konfirmasi=CURRENT_TIMESTAMP,
                    updated_at=CURRENT_TIMESTAMP WHERE id=?")
                   ->execute([$_SESSION['user']['id'], $tagihanId]);
                logAktivitas($_SESSION['user']['id'], 'Tolak bayar', 'tagihan_iuran', $tagihanId,
                    "Menolak pembayaran {$tgh['nama']}");
                setFlash('warning', 'Pembayaran <strong>' . htmlspecialchars($tgh['nama']) . '</strong> ditolak.');
            }
        }
    }
    redirect('index.php?page=konfirmasi');
}

$menunggu = $db->query("SELECT t.*, a.nir, a.nama, a.no_hp, p.tgl_mulai, p.tgl_selesai
    FROM tagihan_iuran t
    JOIN anggota a ON t.anggota_id = a.id
    JOIN periode_tagihan p ON t.periode_id = p.id
    WHERE t.status = 'menunggu_konfirmasi'
    ORDER BY t.updated_at ASC, t.id ASC")->fetchAll();

$riwayatKonfirmasi = $db->query("SELECT t.*, a.nama
    FROM tagihan_iuran t JOIN anggota a ON t.anggota_id = a.id
    WHERE t.tgl_konfirmasi IS NOT NULL
    ORDER BY t.tgl_konfirmasi DESC LIMIT 10")->fetchAll();

$totalNominal = array_sum(array_map(fn($t) => (int)$t['nominal'], $menunggu));
?>

<div class="card-header">
    <div>
        <h2>✅ Konfirmasi Pembayaran</h2>
        <p class="text-muted" style="font-size:.87rem;">Verifikasi pembayaran iuran yang diunggah anggota.</p>
    </div>
    <a href="index.php?page=iuran" class="btn btn-outline">💰 Ke Iuran</a>
</div>

<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-icon yellow">⏳</div>
        <div class="stat-content"><h4>Menunggu</h4><div class="stat-value"><?= count($menunggu) ?></div><div class="stat-sub">pembayaran</div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon blue">💰</div>
        <div class="stat-content"><h4>Nilai</h4><div class="stat-value" style="font-size:1.1rem;"><?= formatRupiah($totalNominal) ?></div><div class="stat-sub">menunggu verifikasi</div></div>
    </div>
</div>

<div class="card">
    <div class="card-title">⏳ Menunggu Konfirmasi (<?= count($menunggu) ?>)</div>
    <?php if (!empty($menunggu)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>Nama</th><th>Periode</th><th>Nominal</th><th>Tanggal Bayar</th><th>Bukti</th><th>Aksi</th></tr></thead>
                <tbody>
                <?php foreach ($menunggu as $m): ?>
                    <tr>
                        <td>
                            <div style="font-weight:700;"><?= htmlspecialchars($m['nama']) ?></div>
                            <div style="font-family:ui-monospace,monospace;font-size:.74rem;color:var(--slate-500);"><?= htmlspecialchars($m['nir']) ?></div>
                        </td>
                        <td style="font-size:.83rem;"><?= formatTanggalPendek($m['tgl_mulai']) ?> — <?= formatTanggalPendek($m['tgl_selesai']) ?></td>
                        <td><?= formatRupiah($m['nominal']) ?></td>
                        <td style="font-size:.83rem;"><?= $m['tgl_bayar'] ? formatTanggalPendek($m['tgl_bayar']) : '-' ?></td>
                        <td>
                            <?php if (!empty($m['bukti_path'])): ?>
                                <a href="<?= htmlspecialchars($m['bukti_path']) ?>" target="_blank" rel="noopener" class="btn btn-sm btn-outline">📎 Lihat</a>
                            <?php else: ?>
                                <span class="text-muted" style="font-size:.78rem;">Tidak ada</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <form method="post" action="index.php?page=konfirmasi" style="display:flex;gap:6px;">
                                <input type="hidden" name="tagihan_id" value="<?= (int)$m['id'] ?>">
                                <button type="submit" name="aksi" value="terima" class="btn btn-sm btn-success">✅ Terima</button>
                                <button type="submit" name="aksi" value="tolak" class="btn btn-sm btn-outline-danger"
                                        onclick="return confirm('Tolak pembayaran ini?');">❌ Tolak</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <div class="empty-icon">🎉</div>
            <h3>Tidak ada yang menunggu</h3>
            <p>Semua pembayaran sudah diverifikasi.</p>
        </div>
    <?php endif; ?>
</div>

<div class="card">
    <div class="card-title">🕘 Riwayat Konfirmasi Terakhir</div>
    <?php if (!empty($riwayatKonfirmasi)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>Nama</th><th>Nominal</th><th>Status</th><th>Dikonfirmasi</th></tr></thead>
                <tbody>
                <?php foreach ($riwayatKonfirmasi as $r): ?>
                    <tr>
                        <td><?= htmlspecialchars($r['nama']) ?></td>
                        <td><?= formatRupiah($r['nominal']) ?></td>
                        <td>
                            <?= $r['status'] === 'lunas'
                                ? '<span class="badge badge-green">Lunas</span>'
                                : '<span class="badge badge-gray">' . ucfirst(str_replace('_', ' ', htmlspecialchars($r['status']))) . '</span>' ?>
                        </td>
                        <td style="font-size:.83rem;"><?= $r['tgl_konfirmasi'] ? date('d/m/Y H:i', strtotime($r['tgl_konfirmasi'])) : '-' ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state" style="padding:20px;"><p>Belum ada riwayat konfirmasi.</p></div>
    <?php endif; ?>
</div>
