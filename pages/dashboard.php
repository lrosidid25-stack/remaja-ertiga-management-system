<?php
/**
 * DASHBOARD — Ringkasan Semua Data
 */

$ringkasan = getDashboardRingkasan();
$db = getDB();

// Ringkasan iuran periode terbaru
$periode = $ringkasan['periode_terbaru'];

// 5 aktivitas terakhir
$aktivitas = $db->query("SELECT l.*, COALESCE(u.nama, 'Publik') as nama_user 
    FROM log_aktivitas l 
    LEFT JOIN users u ON l.user_id = u.id 
    ORDER BY l.id DESC LIMIT 8")->fetchAll();

// Tunggakan terbanyak (top 5)
$tunggakan = [];
if ($periode) {
    $stmt = $db->prepare("SELECT t.*, a.nir, a.nama as nama_anggota
        FROM tagihan_iuran t
        JOIN anggota a ON t.anggota_id = a.id
        WHERE t.periode_id = ? AND t.status != 'lunas'
        ORDER BY t.nominal DESC LIMIT 5");
    $stmt->execute([$periode['id']]);
    $tunggakan = $stmt->fetchAll();
}

// Kegiatan yang sedang berlangsung
$kegiatanAktif = $db->query("SELECT * FROM kegiatan WHERE status = 'berlangsung' ORDER BY tgl_mulai DESC LIMIT 3")->fetchAll();

// Pemasukan & pengeluaran bulan ini
$bulanIni = date('Y-m');
$pemasukanBulan = (int)$db->prepare("SELECT COALESCE(SUM(nominal), 0) FROM pemasukan WHERE tanggal LIKE ?")->fetchColumn([$bulanIni . '%']);
$pengeluaranBulan = (int)$db->prepare("SELECT COALESCE(SUM(nominal), 0) FROM pengeluaran WHERE tanggal LIKE ?")->fetchColumn([$bulanIni . '%']);
?>

<div class="card-header">
    <div>
        <h2>👋 Selamat datang, <?= htmlspecialchars($_SESSION['user']['nama']) ?>!</h2>
        <p class="text-muted" style="margin-top: 4px;">
            <?= formatTanggal(date('Y-m-d'), true) ?> · Role: 
            <span class="badge badge-<?= warnaRole($_SESSION['user']['role']) ?>"><?= labelRole($_SESSION['user']['role']) ?></span>
        </p>
    </div>
</div>

<!-- ============ STAT GRID ============ -->
<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-icon blue">👥</div>
        <div class="stat-content">
            <h4>Total Anggota</h4>
            <div class="stat-value"><?= $ringkasan['total_anggota'] ?></div>
            <div class="stat-sub">Anggota aktif</div>
        </div>
    </div>

    <div class="stat-card">
        <div class="stat-icon purple">💰</div>
        <div class="stat-content">
            <h4>Wajib Iuran</h4>
            <div class="stat-value"><?= $ringkasan['total_wajib_iuran'] ?></div>
            <div class="stat-sub">Anggota wajib setor</div>
        </div>
    </div>

    <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div class="stat-content">
            <h4>Lunas</h4>
            <div class="stat-value"><?= $ringkasan['lunas'] ?></div>
            <div class="stat-sub">Periode ini</div>
        </div>
    </div>

    <div class="stat-card">
        <div class="stat-icon red">❌</div>
        <div class="stat-content">
            <h4>Belum Bayar</h4>
            <div class="stat-value"><?= $ringkasan['belum_bayar'] ?></div>
            <div class="stat-sub">+ <?= $ringkasan['menunggu'] ?> menunggu konfirmasi</div>
        </div>
    </div>

    <div class="stat-card">
        <div class="stat-icon yellow">🏦</div>
        <div class="stat-content">
            <h4>Saldo Kas</h4>
            <div class="stat-value" style="font-size:1.2rem;"><?= formatRupiah($ringkasan['saldo']) ?></div>
            <div class="stat-sub">Total dana tersedia</div>
        </div>
    </div>

    <div class="stat-card">
        <div class="stat-icon cyan">📅</div>
        <div class="stat-content">
            <h4>Kegiatan Aktif</h4>
            <div class="stat-value"><?= $ringkasan['kegiatan_aktif'] ?></div>
            <div class="stat-sub">Kegiatan berjalan</div>
        </div>
    </div>
</div>

<!-- ============ ROW: PERIODE & KAS BULANAN ============ -->
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; margin-bottom: 20px;">

    <!-- Periode Iuran Terbaru -->
    <div class="card">
        <div class="card-title">📆 Periode Iuran Terbaru</div>
        <?php if ($periode): ?>
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
                <div style="font-weight: 700; font-size: 1rem; color: #1e293b;">
                    <?= formatTanggalPendek($periode['tgl_mulai']) ?> — <?= formatTanggalPendek($periode['tgl_selesai']) ?>
                </div>
                <div class="text-muted" style="font-size:0.85rem;"><?= $periode['jml_hari'] ?> hari · <?= formatRupiah($periode['nominal']) ?>/orang</div>
            </div>
            <div>
                <?php
                $totalLunasNominal = getTotalIuranLunas($periode['id']);
                $totalTagihan = getTotalTagihan($periode['id']);
                $persentase = $totalTagihan > 0 ? round(($totalLunasNominal / $totalTagihan) * 100) : 0;
                ?>
                <div style="text-align:right;">
                    <div style="font-weight:800;font-size:1.2rem;color:#16a34a;"><?= formatRupiah($totalLunasNominal) ?></div>
                    <div class="text-muted" style="font-size:0.8rem;">dari <?= formatRupiah($totalTagihan) ?></div>
                </div>
            </div>
        </div>
        <!-- Progress bar -->
        <div style="margin-top: 14px; background: #e2e8f0; border-radius: 10px; height: 10px; overflow: hidden;">
            <div style="width: <?= $persentase ?>%; background: linear-gradient(90deg, #16a34a, #22c55e); height: 100%; border-radius: 10px; transition: width 0.5s;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 0.8rem; color: #64748b;">
            <span><?= $persentase ?>% terkumpul</span>
            <span><?= $ringkasan['lunas'] ?>/<?= $ringkasan['lunas'] + $ringkasan['belum_bayar'] + $ringkasan['menunggu'] + $ringkasan['ditolak'] ?> anggota</span>
        </div>
        <div style="margin-top: 12px;">
            <a href="index.php?page=iuran-detail&id=<?= $periode['id'] ?>" class="btn btn-sm btn-outline">Lihat Detail →</a>
        </div>
        <?php else: ?>
        <div class="empty-state">
            <div class="empty-icon">📭</div>
            <h3>Belum ada periode tagihan</h3>
            <p>Generate tagihan pertama Anda</p>
            <?php if (bolehAkses(roleGenerateTagihan())): ?>
            <a href="index.php?page=iuran-generate" class="btn btn-primary mt-2">➕ Generate Tagihan</a>
            <?php endif; ?>
        </div>
        <?php endif; ?>
    </div>

    <!-- Kas Bulan Ini -->
    <div class="card">
        <div class="card-title">💵 Kas Bulan <?= date('F Y') ?></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div style="text-align: center;">
                <div style="font-size: 2rem;">📥</div>
                <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600;">Pemasukan</div>
                <div style="font-weight: 700; font-size: 1.05rem; color: #16a34a;"><?= formatRupiah($pemasukanBulan) ?></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 2rem;">📤</div>
                <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600;">Pengeluaran</div>
                <div style="font-weight: 700; font-size: 1.05rem; color: #dc2626;"><?= formatRupiah($pengeluaranBulan) ?></div>
            </div>
        </div>
        <div style="text-align: center; margin-top: 12px; padding: 10px; background: #f8fafc; border-radius: 8px;">
            <span style="font-size: 0.8rem; color: #64748b;">Saldo bulan ini: </span>
            <span style="font-weight: 800; font-size: 1rem; color: <?= ($pemasukanBulan - $pengeluaranBulan) >= 0 ? '#16a34a' : '#dc2626' ?>;">
                <?= formatRupiah($pemasukanBulan - $pengeluaranBulan) ?>
            </span>
        </div>
        <div style="margin-top: 12px;">
            <a href="index.php?page=laporan-bulanan" class="btn btn-sm btn-outline">📋 Laporan Bulanan</a>
        </div>
    </div>
</div>

<!-- ============ ROW: TUNGGAKAN & KEGIATAN ============ -->
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; margin-bottom: 20px;">

    <!-- Tunggakan Terbaru -->
    <div class="card">
        <div class="flex-between" style="margin-bottom: 16px;">
            <div class="card-title" style="margin-bottom:0;">⚠️ Tunggakan Terbaru</div>
            <a href="index.php?page=iuran-tunggakan" class="btn btn-sm btn-outline">Lihat Semua</a>
        </div>
        <?php if (!empty($tunggakan)): ?>
        <div class="table-container">
            <table>
                <thead>
                    <tr><th>NIR</th><th>Nama</th><th>Nominal</th><th>Status</th></tr>
                </thead>
                <tbody>
                    <?php foreach ($tunggakan as $t): ?>
                    <tr>
                        <td style="font-family:monospace;font-size:0.8rem;"><?= htmlspecialchars($t['nir']) ?></td>
                        <td><?= htmlspecialchars($t['nama_anggota']) ?></td>
                        <td><?= formatRupiah($t['nominal']) ?></td>
                        <td>
                            <?= match($t['status']) {
                                'belum_bayar' => '<span class="badge badge-red">Belum</span>',
                                'menunggu_konfirmasi' => '<span class="badge badge-yellow">Menunggu</span>',
                                'ditolak' => '<span class="badge badge-gray">Ditolak</span>',
                                default => $t['status']
                            } ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php else: ?>
        <div class="empty-state" style="padding:20px;">
            <div class="empty-icon">🎉</div>
            <h3>Semua lunas!</h3>
            <p>Tidak ada tunggakan saat ini</p>
        </div>
        <?php endif; ?>
    </div>

    <!-- Kegiatan Aktif -->
    <div class="card">
        <div class="flex-between" style="margin-bottom: 16px;">
            <div class="card-title" style="margin-bottom:0;">📅 Kegiatan Berlangsung</div>
            <a href="index.php?page=kegiatan" class="btn btn-sm btn-outline">Semua Kegiatan</a>
        </div>
        <?php if (!empty($kegiatanAktif)): ?>
            <?php foreach ($kegiatanAktif as $k): ?>
            <div style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="font-weight: 700; color: #1e293b;"><?= htmlspecialchars($k['nama_kegiatan']) ?></div>
                        <div style="font-size: 0.8rem; color: #64748b;">
                            📍 <?= htmlspecialchars($k['lokasi'] ?? '-') ?> · 
                            <?= formatTanggalPendek($k['tgl_mulai']) ?> — <?= formatTanggalPendek($k['tgl_selesai']) ?>
                        </div>
                    </div>
                    <span class="badge badge-blue">Berlangsung</span>
                </div>
                <?php if ($k['anggaran'] > 0): ?>
                <div style="margin-top: 8px; font-size:0.85rem; color:#64748b;">
                    Anggaran: <?= formatRupiah($k['anggaran']) ?> · 
                    Realisasi: <strong><?= formatRupiah($k['realisasi']) ?></strong>
                </div>
                <?php endif; ?>
                <a href="index.php?page=kegiatan-detail&id=<?= $k['id'] ?>" style="font-size:0.85rem;">Detail →</a>
            </div>
            <?php endforeach; ?>
        <?php else: ?>
        <div class="empty-state" style="padding: 20px;">
            <div class="empty-icon">📭</div>
            <h3>Tidak ada kegiatan berlangsung</h3>
            <p>Belum ada kegiatan yang sedang berjalan</p>
        </div>
        <?php endif; ?>
    </div>
</div>

<!-- ============ AKTIVITAS TERBARU ============ -->
<div class="card">
    <div class="flex-between" style="margin-bottom: 16px;">
        <div class="card-title" style="margin-bottom:0;">📝 Aktivitas Terbaru</div>
    </div>
    <?php if (!empty($aktivitas)): ?>
    <div class="table-container">
        <table>
            <thead>
                <tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Detail</th></tr>
            </thead>
            <tbody>
                <?php foreach ($aktivitas as $a): ?>
                <tr>
                    <td style="font-size:0.8rem; white-space:nowrap;">
                        <?= date('d/m H:i', strtotime($a['created_at'])) ?>
                    </td>
                    <td><?= htmlspecialchars($a['nama_user']) ?></td>
                    <td>
                        <?= match($a['aksi']) {
                            'Login' => '🔐 Login',
                            'Logout' => '🚪 Logout',
                            'Upload bukti transfer' => '📤 Upload',
                            default => '📌 ' . $a['aksi']
                        } ?>
                    </td>
                    <td style="font-size:0.85rem; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <?= htmlspecialchars($a['detail']) ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php else: ?>
    <div class="empty-state" style="padding: 20px;">
        <p>Belum ada aktivitas tercatat</p>
    </div>
    <?php endif; ?>
</div>

<!-- ============ QUICK ACTIONS ============ -->
<div class="card">
    <div class="card-title">⚡ Quick Actions</div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <?php if (bolehAkses(roleKelolaAnggota())): ?>
        <a href="index.php?page=anggota-tambah" class="btn btn-primary">➕ Tambah Anggota</a>
        <?php endif; ?>
        <?php if (bolehAkses(roleGenerateTagihan())): ?>
        <a href="index.php?page=iuran-generate" class="btn btn-success">📆 Generate Tagihan</a>
        <?php endif; ?>
        <?php if (bolehAkses(roleKonfirmasiBayar())): ?>
        <a href="index.php?page=konfirmasi" class="btn btn-warning">✅ Konfirmasi Bayar</a>
        <?php endif; ?>
        <?php if (bolehAkses(roleKelolaKeuangan())): ?>
        <a href="index.php?page=pemasukan-tambah" class="btn btn-info">📥 Catat Pemasukan</a>
        <a href="index.php?page=pengeluaran-tambah" class="btn btn-outline-danger">📤 Catat Pengeluaran</a>
        <?php endif; ?>
        <a href="index.php?page=kegiatan-tambah" class="btn btn-outline">📅 Tambah Kegiatan</a>
    </div>
</div>
