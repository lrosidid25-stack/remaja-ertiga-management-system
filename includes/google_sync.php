<?php
/**
 * GOOGLE SYNC — integrasi opsional Google Sheets (arsip) & Google Drive (upload)
 *
 * Semua fungsi di sini bersifat OPSIONAL / best-effort:
 * - Jika service account belum dikonfigurasi, fungsi return false/null
 *   dan aplikasi tetap berjalan normal memakai database (lokasi lokal / Supabase).
 * - Tidak pernah men-throw exception agar tidak mematikan halaman.
 */

require_once __DIR__ . '/../config/google_config.php';

/**
 * Ambil access token OAuth2 dari service account (JWT grant).
 */
function gdrive_token(): ?string {
    static $cached = null;
    static $expires = 0;
    if ($cached && time() < $expires - 60) {
        return $cached;
    }

    $file = GOOGLE_SERVICE_ACCOUNT_FILE;
    if (!is_file($file)) return null;

    $sa = json_decode((string)@file_get_contents($file), true);
    if (!$sa || empty($sa['client_email']) || empty($sa['private_key'])) return null;

    $now = time();
    $header = ['alg' => 'RS256', 'typ' => 'JWT'];
    $claim = [
        'iss'   => $sa['client_email'],
        'scope' => 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
        'aud'   => 'https://oauth2.googleapis.com/token',
        'exp'   => $now + 3600,
        'iat'   => $now,
    ];

    $b64 = fn($d) => rtrim(strtr(base64_encode($d), '+/', '-_'), '=');
    $unsigned = $b64(json_encode($header)) . '.' . $b64(json_encode($claim));

    $key = @openssl_pkey_get_private($sa['private_key']);
    if (!$key) return null;

    $sig = '';
    if (!@openssl_sign($unsigned, $sig, $key, OPENSSL_ALGO_SHA256)) return null;

    $jwt = $unsigned . '.' . $b64($sig);
    $body = http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion'  => $jwt,
    ]);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (PHP_VERSION_ID < 80000 && is_resource($ch)) curl_close($ch);

    if ($code !== 200 || !$res) return null;
    $data = json_decode($res, true);
    if (empty($data['access_token'])) return null;

    $cached = $data['access_token'];
    $expires = $now + (int)($data['expires_in'] ?? 3600);
    return $cached;
}

/**
 * Upload file ke Google Drive. Return URL publik atau false.
 */
function gdrive_upload(string $path, string $filename, string $folderId): string|false {
    if (!is_file($path)) return false;
    $token = gdrive_token();
    if (!$token) return false;

    $meta = json_encode(['name' => $filename, 'parents' => $folderId ? [$folderId] : []]);
    $boundary = 'r3m4j4' . bin2hex(random_bytes(8));
    $content = (string)file_get_contents($path);

    $body  = "--{$boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{$meta}\r\n";
    $body .= "--{$boundary}\r\nContent-Type: " . (mime_content_type($path) ?: 'application/octet-stream') . "\r\n\r\n";
    $body .= $content . "\r\n--{$boundary}--";

    $ch = curl_init('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => [
            "Authorization: Bearer {$token}",
            "Content-Type: multipart/related; boundary={$boundary}",
        ],
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (PHP_VERSION_ID < 80000 && is_resource($ch)) curl_close($ch);

    if ($code !== 200 || !$res) return false;
    $data = json_decode($res, true);
    $id = $data['id'] ?? '';
    if (!$id) return false;

    // Jadikan bisa dibaca siapa saja yang punya link
    $perm = curl_init("https://www.googleapis.com/drive/v3/files/{$id}/permissions");
    curl_setopt_array($perm, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['role' => 'reader', 'type' => 'anyone']),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$token}", 'Content-Type: application/json'],
    ]);
    curl_exec($perm);
    if (PHP_VERSION_ID < 80000 && is_resource($perm)) curl_close($perm);

    return "https://drive.google.com/uc?export=view&id={$id}";
}

/**
 * Sinkronisasi ringan ke Google Sheets (arsip opsional). Best-effort.
 * Contoh pemakaian: gsheet_append('Anggota', [[...]]).
 */
function gsheet_append(string $sheetName, array $row): bool {
    $token = gdrive_token();
    if (!$token || !defined('GOOGLE_SPREADSHEET_ID')) return false;

    $range = urlencode($sheetName . '!A1');
    $url = 'https://sheets.googleapis.com/v4/spreadsheets/' . GOOGLE_SPREADSHEET_ID
         . "/values/{$range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS";

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['values' => [$row]]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$token}", 'Content-Type: application/json'],
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (PHP_VERSION_ID < 80000 && is_resource($ch)) curl_close($ch);

    return $code >= 200 && $code < 300;
}
