<?php
/**
 * KONEKSI DATABASE - Google Sheets Edition
 */
require_once __DIR__ . '/google_config.php';
require_once __DIR__ . '/../includes/google_sheets_api.php';
function initDatabase(): void {
    $settings = gsheets_read(SHEET_PENGATURAN);
    if (count($settings) <= 1) {
        gsheets_write(SHEET_PENGATURAN, [
            ['kunci','nilai','keterangan'],
            ['nama_organisasi','Remaja Ertiga','Nama organisasi'],
            ['rt','03','RT'],
            ['rw','04','RW'],
            ['nominal_per_hari','500','Nominal per hari'],
            ['fonnte_token','','Token Fonnte'],
        ]);
    }
}