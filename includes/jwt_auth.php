<?php
/**
 * JWT AUTH — Pengganti PHP Session untuk Vercel
 * 
 * Vercel serverless tidak mendukung PHP session tradisional.
 * Autentikasi pakai JWT cookie.
 * 
 * Lokal: tetap pakai session PHP standar
 */

define('JWT_SECRET', getenv('JWT_SECRET') ?: 'r3m4j4-3rt1g4-2026-s3cr3t-k3y!!');
define('JWT_COOKIE', 're_token');
define('JWT_EXPIRY', 86400); // 24 jam

/**
 * Encode payload jadi JWT token
 */
function jwt_encode(array $payload): string {
    $header = jwt_b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['iat'] = time();
    $payload['exp'] = time() + JWT_EXPIRY;
    $body = jwt_b64(json_encode($payload));
    $sig = jwt_b64(hash_hmac('sha256', "$header.$body", JWT_SECRET, true));
    return "$header.$body.$sig";
}

/**
 * Decode JWT token, return payload atau null jika invalid/expired
 */
function jwt_decode(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    
    [$header, $body, $sig] = $parts;
    $expected = jwt_b64(hash_hmac('sha256', "$header.$body", JWT_SECRET, true));
    
    if (!hash_equals($expected, $sig)) return null;
    
    $payload = json_decode(base64_decode(strtr($body, '-_', '+/')), true);
    if (!$payload || ($payload['exp'] ?? 0) < time()) return null;
    
    return $payload;
}

/**
 * Set JWT cookie ke browser
 */
function jwt_set_login(array $userData): void {
    $payload = [
        'id'       => $userData['id'],
        'username' => $userData['username'],
        'nama'     => $userData['nama'],
        'role'     => $userData['role'],
        'no_hp'    => $userData['no_hp'] ?? '',
    ];
    $token = jwt_encode($payload);
    
    setcookie(JWT_COOKIE, $token, [
        'expires'  => time() + JWT_EXPIRY,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => isset($_SERVER['HTTPS']),
    ]);
}

/**
 * Hapus JWT cookie (logout)
 */
function jwt_clear_login(): void {
    setcookie(JWT_COOKIE, '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => isset($_SERVER['HTTPS']),
    ]);
}

/**
 * Ambil payload dari JWT cookie
 */
function jwt_get_payload(): ?array {
    if (empty($_COOKIE[JWT_COOKIE])) return null;
    return jwt_decode($_COOKIE[JWT_COOKIE]);
}

/**
 * Base64URL encode (RFC 7515)
 */
function jwt_b64(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

// ============================================================
// BOOTSTRAP: populate $_SESSION['user'] dari JWT (Vercel)
// atau biarkan session PHP normal (lokal)
// ============================================================
function jwt_bootstrap(): void {
    if (getenv('VERCEL') || getenv('VERCEL_ENV')) {
        // VERCEL: populate $_SESSION['user'] dari JWT cookie
        $payload = jwt_get_payload();
        if ($payload) {
            $_SESSION['user'] = [
                'id'       => $payload['id'],
                'username' => $payload['username'],
                'nama'     => $payload['nama'],
                'role'     => $payload['role'],
                'no_hp'    => $payload['no_hp'],
            ];
        }
    } else {
        // LOKAL: PHP session standar
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }
}
