<?php
/**
 * KONEKSI DATABASE & INISIALISASI TABEL
 * - LOKAL: SQLite (remaja_ertiga.db)
 * - VERCEL: Supabase PostgreSQL (via REST API)
 */

// ===== Supabase Configuration =====
define('SUPABASE_URL', 'https://rilnglxfbbzmxvmxlsjm.supabase.co');
define('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpbG5nbHhmYmJ6bXh2bXhsc2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNDkzNDYsImV4cCI6MjA5OTYyNTM0Nn0.5enZLSKSQKObC45d7NhkqbP35aR63wVNIgrigCi66w8');

define('DB_PATH', __DIR__ . '/../remaja_ertiga.db');

// Auto-detect environment
if (getenv('VERCEL') || getenv('VERCEL_ENV')) {
    // ===== VERCEL MODE: Supabase =====
    require_once __DIR__ . '/supabase_db.php';
    function getDB(): SupabaseDB { return new SupabaseDB(); }
    function initDatabase(): void { /* Tabel sudah dibuat di Supabase */ }

} else {
    // ===== LOKAL MODE: SQLite =====
    require_once __DIR__ . '/../includes/google_sync.php';
}

if (!function_exists('getDB')) {
function getDB(): PDO {
    static $db = null;
    if ($db === null) {
        $db = new PDO('sqlite:' . DB_PATH);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $db->exec("PRAGMA journal_mode=WAL");
        $db->exec("PRAGMA foreign_keys=ON");
    }
    return $db;
}

function initDatabase(): void {
    $db = getDB();
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL, nama TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'humas',
        no_hp TEXT DEFAULT '', aktif INTEGER DEFAULT 1, last_login DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    $db->exec("CREATE TABLE IF NOT EXISTS anggota (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nir TEXT NOT NULL UNIQUE, nama TEXT NOT NULL,
        jenis_kelamin TEXT DEFAULT 'L', tempat_lahir TEXT DEFAULT '', tgl_lahir TEXT DEFAULT '',
        alamat TEXT DEFAULT '', no_hp TEXT DEFAULT '', wajib_iuran INTEGER DEFAULT 1,
        status TEXT DEFAULT 'aktif', tgl_bergabung TEXT DEFAULT '', foto TEXT DEFAULT '',
        keterangan TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    $db->exec("CREATE TABLE IF NOT EXISTS periode_kepengurusan (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nama_periode TEXT NOT NULL, tgl_mulai TEXT NOT NULL,
        tgl_selesai TEXT NOT NULL, ketua_id INTEGER, keterangan TEXT DEFAULT '',
        aktif INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ketua_id) REFERENCES users(id) ON DELETE SET NULL)");
    $db->exec("CREATE TABLE IF NOT EXISTS pengaturan (kunci TEXT PRIMARY KEY, nilai TEXT DEFAULT '', keterangan TEXT DEFAULT '')");
    $db->exec("CREATE TABLE IF NOT EXISTS jenis_iuran (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL, nominal_per_hari INTEGER DEFAULT 500,
        tgl_berlaku TEXT DEFAULT '', keterangan TEXT DEFAULT '', aktif INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    $db->exec("CREATE TABLE IF NOT EXISTS periode_tagihan (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tgl_mulai TEXT NOT NULL, tgl_selesai TEXT NOT NULL,
        jml_hari INTEGER NOT NULL, nominal INTEGER NOT NULL, keterangan TEXT DEFAULT '',
        dibuat_oleh INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dibuat_oleh) REFERENCES users(id) ON DELETE SET NULL)");
    $db->exec("CREATE TABLE IF NOT EXISTS tagihan_iuran (
        id INTEGER PRIMARY KEY AUTOINCREMENT, anggota_id INTEGER NOT NULL, periode_id INTEGER NOT NULL,
        nominal INTEGER NOT NULL, status TEXT DEFAULT 'belum_bayar', tgl_bayar TEXT DEFAULT '',
        metode TEXT DEFAULT '', bukti_path TEXT DEFAULT '', keterangan TEXT DEFAULT '',
        dicatat_oleh INTEGER, dikonfirmasi_oleh INTEGER, tgl_konfirmasi DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE,
        FOREIGN KEY (periode_id) REFERENCES periode_tagihan(id) ON DELETE CASCADE,
        FOREIGN KEY (dicatat_oleh) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (dikonfirmasi_oleh) REFERENCES users(id) ON DELETE SET NULL)");
    $db->exec("CREATE TABLE IF NOT EXISTS metode_pembayaran (
        id INTEGER PRIMARY KEY AUTOINCREMENT, jenis TEXT NOT NULL, nama TEXT NOT NULL,
        nomor TEXT DEFAULT '', atas_nama TEXT DEFAULT '', logo TEXT DEFAULT '',
        urutan INTEGER DEFAULT 0, aktif INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    $db->exec("CREATE TABLE IF NOT EXISTS kategori_pemasukan (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL, keterangan TEXT DEFAULT '', aktif INTEGER DEFAULT 1)");
    $db->exec("CREATE TABLE IF NOT EXISTS pemasukan (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tanggal TEXT NOT NULL, kategori_id INTEGER,
        kegiatan_id INTEGER, sumber TEXT DEFAULT '', nominal INTEGER NOT NULL, keterangan TEXT DEFAULT '',
        bukti_path TEXT DEFAULT '', dicatat_oleh INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kategori_id) REFERENCES kategori_pemasukan(id) ON DELETE SET NULL,
        FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE SET NULL,
        FOREIGN KEY (dicatat_oleh) REFERENCES users(id) ON DELETE SET NULL)");
    $db->exec("CREATE TABLE IF NOT EXISTS kategori_pengeluaran (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL, keterangan TEXT DEFAULT '', aktif INTEGER DEFAULT 1)");
    $db->exec("CREATE TABLE IF NOT EXISTS pengeluaran (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tanggal TEXT NOT NULL, kategori_id INTEGER,
        kegiatan_id INTEGER, keperluan TEXT DEFAULT '', nominal INTEGER NOT NULL, keterangan TEXT DEFAULT '',
        bukti_path TEXT DEFAULT '', dicatat_oleh INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kategori_id) REFERENCES kategori_pengeluaran(id) ON DELETE SET NULL,
        FOREIGN KEY (kegiatan_id) REFERENCES kegiatan(id) ON DELETE SET NULL,
        FOREIGN KEY (dicatat_oleh) REFERENCES users(id) ON DELETE SET NULL)");
    $db->exec("CREATE TABLE IF NOT EXISTS kegiatan (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nama_kegiatan TEXT NOT NULL, deskripsi TEXT DEFAULT '',
        tgl_mulai TEXT DEFAULT '', tgl_selesai TEXT DEFAULT '', lokasi TEXT DEFAULT '',
        anggaran INTEGER DEFAULT 0, realisasi INTEGER DEFAULT 0, status TEXT DEFAULT 'direncanakan',
        penanggung_jawab INTEGER, keterangan TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (penanggung_jawab) REFERENCES users(id) ON DELETE SET NULL)");
    $db->exec("CREATE TABLE IF NOT EXISTS log_aktivitas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, aksi TEXT NOT NULL,
        tabel_terkait TEXT DEFAULT '', data_id INTEGER DEFAULT 0, detail TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL)");
    seedDefaultData($db);
}

function seedDefaultData(PDO $db): void {
    $count = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    if ($count == 0) {
        $db->exec("INSERT INTO users (username, password, nama, role, aktif) VALUES
            ('admin',   '" . password_hash('admin123', PASSWORD_DEFAULT) . "', 'Super Admin',     'super_admin', 1),
            ('ketua',   '" . password_hash('ketua123', PASSWORD_DEFAULT) . "', 'Ketua Remaja Ertiga', 'ketua', 1),
            ('bendahara','" . password_hash('bendahara123', PASSWORD_DEFAULT) . "', 'Bendahara', 'bendahara', 1),
            ('sekretaris','" . password_hash('sekretaris123', PASSWORD_DEFAULT) . "', 'Sekretaris', 'sekretaris', 1),
            ('humas1',  '" . password_hash('humas123', PASSWORD_DEFAULT) . "', 'Humas 1',        'humas', 1),
            ('humas2',  '" . password_hash('humas123', PASSWORD_DEFAULT) . "', 'Humas 2',        'humas', 1)
        ");
    }
    $count = $db->query("SELECT COUNT(*) FROM pengaturan")->fetchColumn();
    if ($count == 0) {
        $db->exec("INSERT INTO pengaturan (kunci, nilai, keterangan) VALUES
            ('nama_organisasi','Remaja Ertiga','Nama organisasi'),('rt','03','RT'),('rw','04','RW'),
            ('dukuh','Legok Denokan','Nama dukuh'),('desa','Gondoryo','Desa'),('kecamatan','Jambu','Kecamatan'),
            ('kabupaten','Semarang','Kabupaten'),('provinsi','Jawa Tengah','Provinsi'),
            ('nominal_per_hari','500','Nominal iuran per hari'),('tgl_mulai_iuran','2026-07-01','Tanggal mulai iuran'),
            ('fonnte_token','','Token API Fonnte'),('logo','','Path logo organisasi')
        ");
    }
    $count = $db->query("SELECT COUNT(*) FROM kategori_pemasukan")->fetchColumn();
    if ($count == 0) {
        $db->exec("INSERT INTO kategori_pemasukan (nama, keterangan) VALUES
            ('Iuran Anggota','Iuran rutin anggota'),('Iuran Insidental','Iuran tidak rutin'),
            ('Sponsor','Dana sponsor'),('Donasi Warga','Donasi dari warga'),
            ('Bantuan RT/RW/Desa','Bantuan dari lembaga'),('Hasil Usaha','Hasil usaha organisasi'),
            ('Denda','Denda anggota'),('Lain-lain','Pemasukan lainnya')
        ");
    }
    $count = $db->query("SELECT COUNT(*) FROM kategori_pengeluaran")->fetchColumn();
    if ($count == 0) {
        $db->exec("INSERT INTO kategori_pengeluaran (nama, keterangan) VALUES
            ('Peringatan 17 Agustus','Kegiatan HUT RI'),('Kegiatan Ramadhan & Takbiran','Kegiatan bulan Ramadhan'),
            ('Kegiatan Olahraga','Kegiatan olahraga'),('Kegiatan Keagamaan','Kegiatan keagamaan'),
            ('Kegiatan Sosial & Gotong Royong','Kegiatan sosial'),('Konsumsi Rapat','Konsumsi rapat pengurus'),
            ('Perlengkapan Organisasi','Perlengkapan organisasi'),('Santunan & Takziah','Santunan dan takziah'),
            ('Jenguk Orang Sakit','Menjenguk orang sakit'),('Transportasi','Biaya transportasi'),
            ('Cetak & Fotokopi','Biaya cetak dan fotokopi'),('Lain-lain','Pengeluaran lainnya')
        ");
    }
    $count = $db->query("SELECT COUNT(*) FROM jenis_iuran")->fetchColumn();
    if ($count == 0) {
        $db->exec("INSERT INTO jenis_iuran (name, nominal_per_hari, tgl_berlaku, keterangan) VALUES
            ('Iuran Harian', 500, '2026-07-01', 'Iuran harian anggota Remaja Ertiga')
        ");
    }
    $count = $db->query("SELECT COUNT(*) FROM metode_pembayaran")->fetchColumn();
    if ($count == 0) {
        $db->exec("INSERT INTO metode_pembayaran (jenis, nama, nomor, atas_nama, urutan) VALUES
            ('tunai', 'Tunai / Bayar Langsung', '', '', 1)
        ");
    }
}
} // end if (!function_exists('getDB'))
