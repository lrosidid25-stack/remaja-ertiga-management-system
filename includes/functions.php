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

function getPengaturan(string $kunci): string { $db=getDB(); $s=$db->prepare("SELECT nilai FROM pengaturan WHERE kunci=?"); $s->execute([$kunci]); $r=$s->fetch(); return $r?$r['nilai']:''; }
function getAllPengaturan(): array { $db=getDB(); $s=$db->query("SELECT kunci,nilai FROM pengaturan"); $r=[]; while($row=$s->fetch()) $r[$row['kunci']]=$row['nilai']; return $r; }
function updatePengaturan(string $kunci, string $nilai): void { $db=getDB(); $db->prepare("INSERT INTO pengaturan (kunci,nilai) VALUES (?,?) ON CONFLICT(kunci) DO UPDATE SET nilai=?")->execute([$kunci,$nilai,$nilai]); }

function generateNIR(): string { $db=getDB(); do { $nir=''; for($i=0;$i<12;$i++) $nir.=rand(0,9); $s=$db->prepare("SELECT COUNT(*) FROM anggota WHERE nir=?"); $s->execute([$nir]); } while($s->fetchColumn()>0); return $nir; }
function selisihHari(string $tgl1, string $tgl2): int { return (int)(new DateTime($tgl1))->diff(new DateTime($tgl2))->days; }

function setFlash(string $tipe, string $pesan): void {
    // Cookie-based flash (kompatibel Vercel & lokal)
    $data = json_encode(['tipe' => $tipe, 'pesan' => $pesan]);
    setcookie('re_flash', $data, [
        'expires' => time() + 60,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => isset($_SERVER['HTTPS']),
    ]);
    // Juga set ke session untuk backward compatibility lokal
    $_SESSION['flash'] = ['tipe' => $tipe, 'pesan' => $pesan];
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
    // Selalu hapus cookie & session flash
    setcookie('re_flash', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => isset($_SERVER['HTTPS']),
    ]);
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

function uploadFile(array $file, string $targetDir, string $prefix = ''): string|false {
    if($file['error']!==UPLOAD_ERR_OK) return false;
    $ext=strtolower(pathinfo($file['name'],PATHINFO_EXTENSION));
    if(!in_array($ext,['jpg','jpeg','png','gif','webp'])) return false;
    if($file['size']>2*1024*1024) return false;
    $filename=$prefix.date('Ymd_His').'_'.bin2hex(random_bytes(4)).'.'.$ext;
    $dest=$targetDir.'/'.$filename;
    
    // Simpan lokal
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
function getTotalIuranLunas(int $periodeId): int { $db=getDB(); return (int)$db->prepare("SELECT COALESCE(SUM(nominal),0) FROM tagihan_iuran WHERE periode_id=? AND status='lunas'")->fetchColumn([$periodeId]); }
function getTotalTagihan(int $periodeId): int { $db=getDB(); return (int)$db->prepare("SELECT COALESCE(SUM(nominal),0) FROM tagihan_iuran WHERE periode_id=?")->fetchColumn([$periodeId]); }

function getDashboardRingkasan(): array {
    $db=getDB(); $totalAnggota=$db->query("SELECT COUNT(*) FROM anggota WHERE status='aktif'")->fetchColumn();
    $totalWajibIuran=$db->query("SELECT COUNT(*) FROM anggota WHERE status='aktif' AND wajib_iuran=1")->fetchColumn();
    $periode=$db->query("SELECT * FROM periode_tagihan ORDER BY id DESC LIMIT 1")->fetch();
    $totalLunas=0;$totalBelum=0;$totalMenunggu=0;$totalDitolak=0;
    if($periode){ $totalLunas=(int)$db->prepare("SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=? AND status='lunas'")->fetchColumn();
        $totalBelum=(int)$db->prepare("SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=? AND status='belum_bayar'")->fetchColumn();
        $totalMenunggu=(int)$db->prepare("SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=? AND status='menunggu_konfirmasi'")->fetchColumn();
        $totalDitolak=(int)$db->prepare("SELECT COUNT(*) FROM tagihan_iuran WHERE periode_id=? AND status='ditolak'")->fetchColumn(); }
    $totalPemasukan=(int)$db->query("SELECT COALESCE(SUM(nominal),0) FROM pemasukan")->fetchColumn();
    $totalPengeluaran=(int)$db->query("SELECT COALESCE(SUM(nominal),0) FROM pengeluaran")->fetchColumn();
    $saldo=$totalPemasukan-$totalPengeluaran;
    $kegiatanAktif=$db->query("SELECT COUNT(*) FROM kegiatan WHERE status IN ('direncanakan','berlangsung')")->fetchColumn();
    return ['total_anggota'=>(int)$totalAnggota,'total_wajib_iuran'=>(int)$totalWajibIuran,'periode_terbaru'=>$periode,'lunas'=>$totalLunas,'belum_bayar'=>$totalBelum,'menunggu'=>$totalMenunggu,'ditolak'=>$totalDitolak,'total_pemasukan'=>$totalPemasukan,'total_pengeluaran'=>$totalPengeluaran,'saldo'=>$saldo,'kegiatan_aktif'=>$kegiatanAktif];
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
    if($p['total_pages']<=1) return ''; $h='<div class="pagination">';
    if($p['has_prev']) $h.="<a href='{$p['base_url']}&page={$p['prev_page']}' class='page-link'>&laquo;</a>";
    for($i=1;$i<=$p['total_pages'];$i++) $h.=($i==$p['current_page'])?"<span class='page-link active'>{$i}</span>":"<a href='{$p['base_url']}&page={$i}' class='page-link'>{$i}</a>";
    if($p['has_next']) $h.="<a href='{$p['base_url']}&page={$p['next_page']}' class='page-link'>&raquo;</a>";
    return $h.'</div>';
}

function downloadCSV(string $filename, array $headers, array $rows): void {
    header('Content-Type: text/csv; charset=utf-8'); header("Content-Disposition: attachment; filename={$filename}.csv");
    $o=fopen('php://output','w'); fputcsv($o,$headers); foreach($rows as $r) fputcsv($o,$r); fclose($o); exit;
}
