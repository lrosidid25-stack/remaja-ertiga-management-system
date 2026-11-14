<?php
function formatRupiah(int|float $angka): string { return 'Rp' . number_format($angka, 0, ',', '.'); }
function formatTanggal(string $tanggal, bool $denganHari = false): string {
    if (empty($tanggal)) return '-'; $time = strtotime($tanggal);
    $hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    $bulan = [1=>'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    $h = $hari[date('w',$time)]; $d = date('d',$time); $m = $bulan[(int)date('m',$time)]; $y = date('Y',$time);
    return $denganHari ? "$h, $d $m $y" : "$d $m $y";
}
function formatTanggalPendek(string $tanggal): string { if(empty($tanggal)) return '-'; return date('d/m/Y', strtotime($tanggal)); }

/**
 * Cache pengaturan per-request: header, footer, dan halaman sering
 * memanggil fungsi ini berkali-kali. Di Vercel setiap query = satu
 * perjalanan jaringan, jadi cache ini memotong 2–3 request per halaman.
 */
$GLOBALS['re_pengaturan_cache'] = null;

function getAllPengaturan(): array {
    if (is_array($GLOBALS['re_pengaturan_cache'] ?? null)) return $GLOBALS['re_pengaturan_cache'];
    $db = getDB();
    $data = [];
    try {
        $s = $db->query("SELECT kunci,nilai FROM pengaturan");
        while ($row = $s->fetch()) $data[$row['kunci']] = $row['nilai'];
    } catch (Throwable $e) {
        $data = [];
    }
    $GLOBALS['re_pengaturan_cache'] = $data;
    return $data;
}
/** Reset cache pengaturan (dipakai setelah updatePengaturan). */
function reResetPengaturanCache(): void { $GLOBALS['re_pengaturan_cache'] = null; }
function getPengaturan(string $kunci): string {
    $all = getAllPengaturan();
    return $all[$kunci] ?? '';
}
function updatePengaturan(string $kunci, string $nilai): void {
    $db = getDB();
    $db->prepare("INSERT INTO pengaturan (kunci,nilai) VALUES (?,?) ON CONFLICT(kunci) DO UPDATE SET nilai=?")
       ->execute([$kunci, $nilai, $nilai]);
    // Buang cache per-request (statik pada getAllPengaturan)
    if (function_exists('reResetPengaturanCache')) reResetPengaturanCache();
}

function generateNIR(): string { $db=getDB(); do { $nir=''; for($i=0;$i<12;$i++) $nir.=rand(0,9); $s=$db->prepare("SELECT COUNT(*) FROM anggota WHERE nir=?"); $s->execute([$nir]); } while($s->fetchColumn()>0); return $nir; }
function selisihHari(string $tgl1, string $tgl2): int { return (int)(new DateTime($tgl1))->diff(new DateTime($tgl2))->days; }

function setFlash(string $tipe, string $pesan): void {
    // Simpan di session (lokal & Vercel). Cookie hanya dipakai bila header
    // belum terkirim, agar tidak memicu "headers already sent".
    $_SESSION['flash'] = ['tipe' => $tipe, 'pesan' => $pesan];
    if (!headers_sent()) {
        $data = json_encode(['tipe' => $tipe, 'pesan' => $pesan]);
        setcookie('re_flash', $data, [
            'expires' => time() + 60,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => isset($_SERVER['HTTPS']),
        ]);
    }
}
function getFlash(): string {
    // Cek cookie dulu (Vercel), fallback ke session (lokal)
    // Bersihkan KEDUANYA agar tidak double-display
    $flashData = null;
    if (isset($_COOKIE['re_flash'])) {
        $flashData = json_decode($_COOKIE['re_flash'], true);
    }
    if (!$flashData && isset($_SESSION['flash'])) {
        $flashData = $_SESSION['flash'];
    }
    // Hapus cookie & session flash
    if (!headers_sent() && isset($_COOKIE['re_flash'])) {
        setcookie('re_flash', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => isset($_SERVER['HTTPS']),
        ]);
    }
    unset($_SESSION['flash']);
    if ($flashData) {
        $w = match($flashData['tipe']) {
            'success' => 'green', 'error' => 'red', 'warning' => 'yellow', 'info' => 'blue',
            default => 'gray'
        };
        return "<div class='alert alert-{$w}'>" . htmlspecialchars($flashData['pesan']) . "</div>";
    }
    return '';
}
function redirect(string $url): never { header("Location: {$url}"); exit; }

/**
 * Jalankan query dengan parameter lalu ambil nilai kolom pertama.
 * Aman untuk SQLite (lokal) maupun SupabaseDB (Vercel).
 */
function dbFetchColumn($db, string $sql, array $params = []) {
    $stmt = $db->prepare($sql);
    if ($stmt === false) return 0;
    $stmt->execute($params);
    return $stmt->fetchColumn();
}

function uploadFile(array $file, string $targetDir, string $prefix = ''): string|false {
    if(($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) return false;
    $ext=strtolower(pathinfo($file['name'] ?? '',PATHINFO_EXTENSION));
    if(!in_array($ext,['jpg','jpeg','png','gif','webp'])) return false;
    if(($file['size'] ?? 0) > 2*1024*1024) return false;
    if(!is_dir($targetDir) && !@mkdir($targetDir, 0775, true)) return false;
    $filename=$prefix.date('Ymd_His').'_'.bin2hex(random_bytes(4)).'.'.$ext;
    $dest=$targetDir.'/'.$filename;

    // Simpan lokal (atau ke /tmp bila filesystem read-only, mis. Vercel)
    if(!move_uploaded_file($file['tmp_name'],$dest)) return false;
    
    // Upload ke Google Drive (jika service account tersedia)
    $folderId = match(true) {
        str_contains($targetDir,'bukti') || $prefix==='TRF_' => GDRIVE_BUKTI_FOLDER,
        str_contains($targetDir,'foto')  || $prefix==='AGT_' => GDRIVE_FOTO_FOLDER,
        str_contains($targetDir,'nota')  || $prefix==='NOTA_'=> GDRIVE_NOTA_FOLDER,
        str_contains($targetDir,'logo')  || $prefix==='LOGO_'=> GDRIVE_LOGO_FOLDER,
        default => GDRIVE_BUKTI_FOLDER
    };
    $driveUrl = gdrive_upload($dest, $filename, $folderId);
    
    return $driveUrl ?: $dest; // Prioritaskan URL Drive, fallback ke lokal
}

function logAktivitas(int $userId, string $aksi, string $tabelTerkait='', int $dataId=0, string $detail=''): void {
    $db=getDB(); $db->prepare("INSERT INTO log_aktivitas (user_id,aksi,tabel_terkait,data_id,detail) VALUES (?,?,?,?,?)")->execute([$userId,$aksi,$tabelTerkait,$dataId,$detail]);
}

function bolehAkses(array $roles): bool { return isset($_SESSION['user']) && in_array($_SESSION['user']['role'],$roles); }
function roleKelolaAnggota(): array { return ['super_admin','sekretaris','wakil_sekretaris']; }
function roleKelolaKeuangan(): array { return ['super_admin','bendahara','wakil_bendahara']; }
function roleKonfirmasiBayar(): array { return ['super_admin','bendahara','wakil_bendahara','humas']; }
function roleTandaiLunas(): array { return ['super_admin','bendahara','wakil_bendahara','humas']; }
function roleKelolaPengaturan(): array { return ['super_admin']; }
function roleKelolaUser(): array { return ['super_admin']; }
function roleGenerateTagihan(): array { return ['super_admin','bendahara','wakil_bendahara']; }

function getNamaUser(int $id): string { $db=getDB(); $s=$db->prepare("SELECT nama FROM users WHERE id=?"); $s->execute([$id]); $r=$s->fetch(); return $r?$r['nama']:'-'; }
function getNamaAnggota(int $id): string { $db=getDB(); $s=$db->prepare("SELECT nama FROM anggota WHERE id=?"); $s->execute([$id]); $r=$s->fetch(); return $r?$r['nama']:'-'; }
function getTotalIuranLunas(int $periodeId): int { $db=getDB(); return (int)dbFetchColumn($db, "SELECT COALESCE(SUM(nominal),0) FROM tagihan_iuran WHERE periode_id=? AND status='lunas'", [$periodeId]); }
function getTotalTagihan(int $periodeId): int { $db=getDB(); return (int)dbFetchColumn($db, "SELECT COALESCE(SUM(nominal),0) FROM tagihan_iuran WHERE periode_id=?", [$periodeId]); }

function getDashboardRingkasan(): array {
    $db = getDB();

    // Satu query agregat untuk semua angka statistik (hemat 6 request di Vercel)
    $row = [];
    try {
        $stmt = $db->query("SELECT
                (SELECT COUNT(*) FROM anggota WHERE status='aktif') AS total_anggota,
                (SELECT COUNT(*) FROM anggota WHERE status='aktif' AND wajib_iuran=1) AS total_wajib,
                (SELECT COALESCE(SUM(nominal),0) FROM pemasukan) AS total_masuk,
                (SELECT COALESCE(SUM(nominal),0) FROM pengeluaran) AS total_keluar,
                (SELECT COUNT(*) FROM kegiatan WHERE status IN ('direncanakan','berlangsung')) AS kegiatan_aktif");
        $row = $stmt->fetch() ?: [];
    } catch (Throwable $e) {
        $row = [];
    }

    $periode = $db->query("SELECT * FROM periode_tagihan ORDER BY id DESC LIMIT 1")->fetch();

    $totalLunas = $totalBelum = $totalMenunggu = $totalDitolak = 0;
    if ($periode) {
        // Satu query untuk 4 status sekaligus
        try {
            $s = $db->prepare("SELECT
                    SUM(CASE WHEN status='lunas' THEN 1 ELSE 0 END) AS lunas,
                    SUM(CASE WHEN status='belum_bayar' THEN 1 ELSE 0 END) AS belum,
                    SUM(CASE WHEN status='menunggu_konfirmasi' THEN 1 ELSE 0 END) AS menunggu,
                    SUM(CASE WHEN status='ditolak' THEN 1 ELSE 0 END) AS ditolak
                FROM tagihan_iuran WHERE periode_id = ?");
            $s->execute([(int)$periode['id']]);
            $st = $s->fetch() ?: [];
            $totalLunas    = (int)($st['lunas'] ?? 0);
            $totalBelum    = (int)($st['belum'] ?? 0);
            $totalMenunggu = (int)($st['menunggu'] ?? 0);
            $totalDitolak  = (int)($st['ditolak'] ?? 0);
        } catch (Throwable $e) { /* biarkan 0 */ }
    }

    $totalPemasukan   = (int)($row['total_masuk'] ?? 0);
    $totalPengeluaran = (int)($row['total_keluar'] ?? 0);

    return [
        'total_anggota'     => (int)($row['total_anggota'] ?? 0),
        'total_wajib_iuran' => (int)($row['total_wajib'] ?? 0),
        'periode_terbaru'   => $periode,
        'lunas'             => $totalLunas,
        'belum_bayar'       => $totalBelum,
        'menunggu'          => $totalMenunggu,
        'ditolak'           => $totalDitolak,
        'total_pemasukan'   => $totalPemasukan,
        'total_pengeluaran' => $totalPengeluaran,
        'saldo'             => $totalPemasukan - $totalPengeluaran,
        'kegiatan_aktif'    => (int)($row['kegiatan_aktif'] ?? 0),
    ];
}

function getStatusIuranByNIR(string $nir): ?array {
    $db=getDB(); $s=$db->prepare("SELECT * FROM anggota WHERE nir=?"); $s->execute([$nir]); $anggota=$s->fetch();
    if(!$anggota) return null;
    $periode=$db->query("SELECT * FROM periode_tagihan ORDER BY id DESC LIMIT 1")->fetch();
    if(!$periode) return ['anggota'=>$anggota,'periode'=>null,'tagihan'=>null,'riwayat'=>[]];
    $s=$db->prepare("SELECT * FROM tagihan_iuran WHERE anggota_id=? AND periode_id=?"); $s->execute([$anggota['id'],$periode['id']]); $tagihan=$s->fetch();
    $s=$db->prepare("SELECT t.*,p.tgl_mulai,p.tgl_selesai FROM tagihan_iuran t JOIN periode_tagihan p ON t.periode_id=p.id WHERE t.anggota_id=? ORDER BY p.id DESC LIMIT 6"); $s->execute([$anggota['id']]); $riwayat=$s->fetchAll();
    return ['anggota'=>$anggota,'periode'=>$periode,'tagihan'=>$tagihan,'riwayat'=>$riwayat];
}

function getTunggakan(?int $periodeId=null): array {
    $db=getDB(); if($periodeId===null){ $p=$db->query("SELECT id FROM periode_tagihan ORDER BY id DESC LIMIT 1")->fetch(); if(!$p) return []; $periodeId=$p['id']; }
    $s=$db->prepare("SELECT t.*,a.nir,a.nama as nama_anggota,a.no_hp,a.alamat FROM tagihan_iuran t JOIN anggota a ON t.anggota_id=a.id WHERE t.periode_id=? AND t.status!='lunas' ORDER BY a.nama"); $s->execute([$periodeId]); return $s->fetchAll();
}

function getPagination(int $total, int $perPage, int $currentPage, string $baseUrl): array {
    $tp=max(1,(int)ceil($total/$perPage)); $cp=max(1,min($currentPage,$tp)); $off=($cp-1)*$perPage;
    return ['total'=>$total,'per_page'=>$perPage,'current_page'=>$cp,'total_pages'=>$tp,'offset'=>$off,'has_prev'=>$cp>1,'has_next'=>$cp<$tp,'prev_page'=>$cp-1,'next_page'=>$cp+1,'base_url'=>$baseUrl];
}

function renderPagination(array $p): string {
    if($p['total_pages']<=1) return '';
    $base = htmlspecialchars($p['base_url']);
    $h='<div class="pagination">';
    if($p['has_prev']) $h.="<a href='{$base}&hal={$p['prev_page']}' class='page-link'>&laquo;</a>";
    // Tampilkan maksimal 7 nomor halaman di sekitar halaman aktif
    $start=max(1,$p['current_page']-3); $end=min($p['total_pages'],$start+6); $start=max(1,$end-6);
    for($i=$start;$i<=$end;$i++) $h.=($i==$p['current_page'])?"<span class='page-link active'>{$i}</span>":"<a href='{$base}&hal={$i}' class='page-link'>{$i}</a>";
    if($p['has_next']) $h.="<a href='{$base}&hal={$p['next_page']}' class='page-link'>&raquo;</a>";
    return $h.'</div>';
}

function downloadCSV(string $filename, array $headers, array $rows): void {
    // Buang buffer HTML yang mungkin sudah terbentuk sebelum mengirim file
    while (ob_get_level() > 0) { ob_end_clean(); }
    header('Content-Type: text/csv; charset=utf-8'); header("Content-Disposition: attachment; filename={$filename}.csv");
    $o=fopen('php://output','w');
    fputcsv($o,$headers,',','"','');
    foreach($rows as $r) fputcsv($o,$r,',','"','');
    fclose($o); exit;
}
