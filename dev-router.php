<?php
/**
 * DEV ROUTER — hanya untuk server lokal / preview
 *
 * Meniru perilaku vercel.json:
 *   /assets/*                 → file statis (css/js/gambar)
 *   /uploads/*               → file statis gambar (blokir selain gambar)
 *   lainnya                  → index.php (router aplikasi)
 *
 * Tidak dipakai di Vercel (production memakai api/index.php + routes vercel.json).
 * Hanya folder aset publik yang boleh disajikan langsung, supaya file
 * seperti remaja_ertiga.db atau config/*.php tidak bisa diunduh.
 */

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = '/' . ltrim($path, '/');

$isAsset = str_starts_with($path, '/assets/');
$isUpload = str_starts_with($path, '/uploads/');
$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$allowedUploadExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

$file = realpath(__DIR__ . $path);
$insideRepo = $file && str_starts_with($file, __DIR__ . DIRECTORY_SEPARATOR);

if ($insideRepo && is_file($file) && ($isAsset || ($isUpload && in_array($ext, $allowedUploadExt, true)))) {
    return false; // biarkan server built-in menyajikan file aset
}

$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/index.php';
