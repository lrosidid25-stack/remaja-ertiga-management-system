<?php
/**
 * METODE PEMBAYARAN — Daftar
 * Route: index.php?page=metode
 */

$db = getDB();

if (($_GET['aksi'] ?? '') === 'hapus' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    requireRole(roleKelolaKeuangan());
    $idHapus = (int)($_POST['id'] ?? 0);
    $db->prepare("DELETE FROM metode_pembayaran WHERE id = ?")->execute([$idHapus]);
    logAktivitas($_SESSION['user']['id'], 'Hapus metode bayar', 'metode_pembayaran', $idHapus, 'Menghapus metode pembayaran');
    setFlash('success', 'Metode pembayaran dihapus.');
    redirect('index.php?page=metode');
}

$list = $db->query("SELECT * FROM metode_pembayaran ORDER BY urutan, id")->fetchAll();
$labelJenis = ['tunai' => '💵 Tunai', 'transfer' => '🏦 Transfer Bank', 'qris' => '📱 QRIS', 'e-wallet' => '📲 E-Wallet'];
?>

<div class="card-header">
    <div>
        <h2>💳 Metode Pembayaran</h2>
        <p class="text-muted" style="font-size:.87rem;">Daftar cara pembayaran yang ditampilkan ke anggota.</p>
    </div>
    <?php if (bolehAkses(roleKelolaKeuangan())): ?>
        <a href="index.php?page=metode-tambah" class="btn btn-primary">➕ Tambah Metode</a>
    <?php endif; ?>
</div>

<div class="card">
    <?php if (!empty($list)): ?>
        <div class="table-container">
            <table>
                <thead><tr><th>Urutan</th><th>Jenis</th><th>Nama</th><th>Nomor</th><th>Atas Nama</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                <?php foreach ($list as $m): ?>
                    <tr>
                        <td><?= (int)$m['urutan'] ?></td>
                        <td><?= $labelJenis[$m['jenis']] ?? htmlspecialchars($m['jenis']) ?></td>
                        <td style="font-weight:600;"><?= htmlspecialchars($m['nama']) ?></td>
                        <td style="font-family:ui-monospace,monospace;font-size:.84rem;"><?= htmlspecialchars($m['nomor'] ?: '-') ?></td>
                        <td><?= htmlspecialchars($m['atas_nama'] ?: '-') ?></td>
                        <td><?= (int)$m['aktif'] === 1 ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-gray">Nonaktif</span>' ?></td>
                        <td>
                            <?php if (bolehAkses(roleKelolaKeuangan())): ?>
                                <div class="btn-group">
                                    <a href="index.php?page=metode-edit&id=<?= (int)$m['id'] ?>" class="btn btn-sm btn-outline">Edit</a>
                                    <form method="post" action="index.php?page=metode&aksi=hapus" onsubmit="return confirm('Hapus metode ini?');">
                                        <input type="hidden" name="id" value="<?= (int)$m['id'] ?>">
                                        <button type="submit" class="btn btn-sm btn-outline-danger">Hapus</button>
                                    </form>
                                </div>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <div class="empty-icon">💳</div>
            <h3>Belum ada metode pembayaran</h3>
            <p>Tambahkan metode seperti tunai atau transfer bank.</p>
        </div>
    <?php endif; ?>
</div>
