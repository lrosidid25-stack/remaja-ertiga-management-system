<?php
define("GOOGLE_SPREADSHEET_ID", "1HOq4XrX4v5u8f77ao2aEDakqPQL_sxK2qSrZIaJ_0qQ");
define("GOOGLE_SERVICE_ACCOUNT_FILE", __DIR__ . "/service-account.json");
$scopes = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'];
define("GDRIVE_ROOT_FOLDER", "11JttHkQ9UeR8imb0TLp1sffVm6wIUk7T");
define("GDRIVE_BUKTI_FOLDER", "1GGvwg5HcWUQtUMXTABz3jeEp_nIQlkhm");
define("GDRIVE_FOTO_FOLDER", "1Dmc3JjkeSAh9mmBUnBGzA2-I8peX3Utk");
define("GDRIVE_NOTA_FOLDER", "1sRqsyr1KYcIAT9WWjOLdHYWc7IkbGi1p");
define("GDRIVE_LOGO_FOLDER", "1kmcFBCXcbjlUKskjRKntj_viDP86HSgs");
define("SHEET_PENGATURAN", "pengaturan");
define("SHEET_USERS", "users");
$sheets = ['anggota','periode_kepengurusan','kategori_pemasukan','kategori_pengeluaran','metode_pembayaran','periode_tagihan','tagihan_iuran','pemasukan','pengeluaran','kegiatan','log_aktivitas'];
foreach ($sheets as $s) {
    define("SHEET_" . strtoupper($s), $s);
}