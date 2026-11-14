<?php
/**
 * IURAN — Generate Tagihan Periode Baru
 * Route: index.php?page=iuran-generate
 */

$db = getDB();
$error = '';

$nominalPerHari = (int)getPengaturan('nominal_per_hari');
if ($nominalPerHari <= 0) $nominalPerHari = 500;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $tglMulai   = $_POST['tgl_mulai'] ?? '';
    $tglSelesai = $_POST['tgl_selesai'] ?? '';
    $keterangan = trim($_POST['keterangan'] ?? '');

    if (!$tglMulai || !$tglSelesai) {
        $error = 'Tanggal mulai dan tanggal selesai wajib diisi.';
    } elseif (strtotime($tglSelesai) < strtotime($tglMulai)) {
        $error = 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
    } else {
        $jmlHari = selisihHari($tglMulai, $tglSelesai) + 1;
        $nominal = $jmlHari * ($nominalPerHari);

        // Cegah periode ganda
        $cek = $db->prepare("SELECT COUNT(*) FROM periode_tagihan WHERE tgl_mulai = ? AND tgl_selesai = ?");
        $cek->execute([$tglMulai, $tglSelesai]);
        if ((int)$cek->fetchColumn() > 0) {
            $error = 'Periode dengan rentang tanggal tersebut sudah ada.';
        } else {
            $db->beginTransaction();
            try {
                $stmt = $db->prepare("INSERT INTO periode_tagihan (tgl_mulai, tgl_selesai, jml_hari, nominal, keterangan, dibuat_oleh)
                    VALUES (?,?,?,?,?,?)");
                $stmt->execute([$tglMulai, $tglSelesai, $jmlHari, $nominal, $keterangan, $_SESSION['user']['id']]);
                $periodeId = (int)$db->lastInsertId();

                $anggotaAktif = $db->query("SELECT id FROM anggota WHERE status='aktif' AND wajib_iuran=1")->fetchAll();
                $ins = $db->prepare("INSERT INTO tagihan_iuran (anggota_id, periode_id, nominal, status) VALUES (?,?,?,'belum_bayar')");
                $jumlah = 0;
                foreach ($anggotaAktif as $a) {
                    $ins->execute([(int)$a['id'], $periodeId, $nominal]);
                    $jumlah++;
                }

                $db->commit();

                logAktivitas($_SESSION['user']['id'], 'Generate tagihan', 'periode_tagihan', $periodeId,
                    "Tagihan periode {$tglMulai} s/d {$tglSelesai} untuk {$jumlah} anggota");
                setFlash('success', "Tagihan periode berhasil dibuat untuk <strong>{$jumlah}</strong> anggota (total " . formatRupiah($nominal) . " per anggota).");
                redirect('index.php?page=iuran-detail&id=' . $periodeId);
            } catch (Throwable $e) {
                $db->rollBack();
                $error = 'Gagal membuat tagihan: ' . $e->getMessage();
            }
        }
    }
}
?>

<div class="card-header">
    <div>
        <h2>➕ Generate Tagihan Iuran</h2>
        <p class="text-muted" style="font-size:.87rem;">Tagihan otomatis dibuat untuk semua anggota aktif yang wajib iuran.</p>
    </div>
    <a href="index.php?page=iuran" class="btn btn-outline">← Kembali</a>
</div>

<?php if ($error): ?>
    <div class="alert alert-red"><?= htmlspecialchars($error) ?></div>
<?php endif; ?>

<form method="post" action="index.php?page=iuran-generate"
      data-per-hari="<?= $nominalPerHari ?>">
    <div class="grid-2">
        <div class="card">
            <div class="card-title">📆 Rentang Periode</div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="tgl_mulai">Tanggal Mulai *</label>
                    <input type="date" id="tgl_mulai" name="tgl_mulai" data-tgl-mulai required
                           value="<?= htmlspecialchars($_POST['tgl_mulai'] ?? date('Y-m-01')) ?>">
                </div>
                <div class="form-group">
                    <label class="form-label" for="tgl_selesai">Tanggal Selesai *</label>
                    <input type="date" id="tgl_selesai" name="tgl_selesai" data-tgl-selesai required
                           value="<?= htmlspecialchars($_POST['tgl_selesai'] ?? date('Y-m-t')) ?>">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="jml_hari">Jumlah Hari</label>
                <input type="number" id="jml_hari" name="jml_hari" data-jml-hari readonly
                       value="<?= (int)($_POST['jml_hari'] ?? 0) ?>">
                <div class="form-hint">Dihitung otomatis dari rentang tanggal.</div>
            </div>
            <div class="form-group">
                <label class="form-label" for="keterangan">Keterangan</label>
                <textarea id="keterangan" name="keterangan" placeholder="Misal: Iuran bulan November 2026"><?= htmlspecialchars($_POST['keterangan'] ?? '') ?></textarea>
            </div>
        </div>

        <div class="card">
            <div class="card-title">💵 Perhitungan</div>
            <div class="detail-list">
                <div class="detail-row"><span>Nominal per hari</span><span><?= formatRupiah($nominalPerHari) ?></span></div>
                <div class="detail-row"><span>Jumlah hari</span><span data-jml-hari-text><?= (int)($_POST['jml_hari'] ?? '-') ?></span></div>
                <div class="detail-row"><span>Nominal per anggota</span><span data-total-nominal style="color:var(--green-700);font-size:1.05rem;">-</span></div>
            </div>
            <div class="alert alert-blue mt-2" style="font-size:.82rem;">
                Tagihan akan dibuat untuk <strong>semua anggota aktif</strong> yang ditandai wajib iuran.
                Anggota yang dibebaskan tidak akan ditagih.
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary btn-block"
                        onclick="return confirm('Buat tagihan untuk semua anggota aktif?');">
                    📆 Generate Tagihan
                </button>
            </div>
        </div>
    </div>
</form>

<script>
    // Sinkronkan teks jumlah hari dengan input readonly
    document.addEventListener('DOMContentLoaded', function () {
        var jml = document.querySelector('[data-jml-hari]');
        var txt = document.querySelector('[data-jml-hari-text]');
        if (jml && txt) {
            var sync = function () { txt.textContent = jml.value || '-'; };
            jml.addEventListener('change', sync);
            setTimeout(sync, 50);
        }
    });
</script>
