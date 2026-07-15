<?php
/**
 * FOOTER
 */
$pengaturan = getAllPengaturan();
$namaOrg = $pengaturan['nama_organisasi'] ?? 'Remaja Ertiga';
$dukuh = $pengaturan['dukuh'] ?? '';
$rt = $pengaturan['rt'] ?? '';
$rw = $pengaturan['rw'] ?? '';
$desa = $pengaturan['desa'] ?? '';
$kecamatan = $pengaturan['kecamatan'] ?? '';
$kabupaten = $pengaturan['kabupaten'] ?? '';
$provinsi = $pengaturan['provinsi'] ?? '';
?>
</main>

<footer class="footer">
    <div class="footer-container">
        <div class="footer-top">
            <div class="footer-brand">
                <h3>🏘️ <?= htmlspecialchars($namaOrg) ?></h3>
                <p>
                    <?php
                    $alamat = [];
                    if ($dukuh) $alamat[] = $dukuh;
                    if ($rt) $alamat[] = "RT {$rt}";
                    if ($rw) $alamat[] = "RW {$rw}";
                    if ($desa) $alamat[] = $desa;
                    if ($kecamatan) $alamat[] = $kecamatan;
                    if ($kabupaten) $alamat[] = $kabupaten;
                    if ($provinsi) $alamat[] = $provinsi;
                    echo htmlspecialchars(implode(', ', $alamat));
                    ?>
                </p>
            </div>
            <?php if (isLoggedIn()): ?>
            <div class="footer-links">
                <h4>Menu Cepat</h4>
                <a href="index.php?page=dashboard">Dashboard</a>
                <a href="index.php?page=anggota">Anggota</a>
                <a href="index.php?page=iuran">Iuran</a>
                <a href="index.php?page=laporan">Laporan</a>
            </div>
            <?php endif; ?>
            <div class="footer-links">
                <h4>Link Publik</h4>
                <a href="index.php">Cek Iuran</a>
                <a href="index.php?page=login">Login Pengurus</a>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; <?= date('Y') ?> <?= htmlspecialchars($namaOrg) ?>. Dibuat dengan ❤️ untuk kemajuan organisasi.</p>
        </div>
    </div>
</footer>

<script src="assets/js/app.js?v=1"></script>
</body>
</html>
