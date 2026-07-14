<?php
/**
 * VERCEL ENTRY POINT
 * Semua request masuk lewat sini
 * Database: Google Sheets (SQLite tidak bisa di Vercel serverless)
 * Auth: JWT cookie (PHP session tidak support di serverless)
 */

// JWT auth bootstrap (gantikan session_start)
require_once __DIR__ . '/../includes/jwt_auth.php';
jwt_bootstrap();

// Service account dari environment variable Vercel → simpan ke /tmp
$saFile = '/tmp/service-account.json';
if (!file_exists($saFile) && $saJson = getenv('GOOGLE_SERVICE_ACCOUNT_JSON')) {
    file_put_contents($saFile, $saJson);
}

// Set path agar include bekerja
$_SERVER['DOCUMENT_ROOT'] = __DIR__ . '/..';
chdir(__DIR__ . '/..');

// Include router utama
require __DIR__ . '/../_app.php';
