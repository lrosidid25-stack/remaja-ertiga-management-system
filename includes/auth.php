<?php
/**
 * AUTENTIKASI & OTORISASI
 * 
 * LOKAL: PHP Session
 * VERCEL: JWT Cookie (via jwt_auth.php)
 */

function isLoggedIn(): bool { 
    return isset($_SESSION['user']); 
}

function hasRole(string $role): bool { 
    return isset($_SESSION['user']) && $_SESSION['user']['role'] === $role; 
}

function requireLogin(): void { 
    if (!isLoggedIn()) { 
        setFlash('warning', 'Silakan login terlebih dahulu.'); 
        redirect('index.php?page=login'); 
    } 
}

function requireRole(array $roles): void { 
    requireLogin(); 
    if (!bolehAkses($roles)) { 
        setFlash('error', 'Anda tidak memiliki akses.'); 
        redirect('index.php?page=dashboard'); 
    } 
}

/**
 * Proses login — set session (lokal) atau JWT cookie (Vercel)
 */
function prosesLogin(string $username, string $password): bool {
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM users WHERE username = ? AND aktif = 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    
    if ($user && password_verify($password, $user['password'])) {
        $stmt = $db->prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$user['id']]);
        
        $userData = [
            'id'       => $user['id'],
            'username' => $user['username'],
            'nama'     => $user['nama'],
            'role'     => $user['role'],
            'no_hp'    => $user['no_hp'],
        ];
        
        // Set auth: JWT di Vercel, session di lokal
        if (getenv('VERCEL') || getenv('VERCEL_ENV')) {
            jwt_set_login($userData);
        }
        $_SESSION['user'] = $userData;
        
        logAktivitas($user['id'], 'Login', 'users', $user['id'], "User {$user['nama']} login");
        return true;
    }
    return false;
}

/**
 * Proses logout — hapus session + JWT cookie
 */
function prosesLogout(): void {
    if (isset($_SESSION['user'])) { 
        logAktivitas($_SESSION['user']['id'], 'Logout', 'users', $_SESSION['user']['id'], "User {$_SESSION['user']['nama']} logout"); 
    }
    
    // Clear JWT cookie (Vercel)
    jwt_clear_login();
    
    // Clear session
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

function getDaftarRole(): array { 
    return [
        'super_admin' => 'Super Admin', 'ketua' => 'Ketua', 'wakil_ketua' => 'Wakil Ketua',
        'sekretaris' => 'Sekretaris', 'wakil_sekretaris' => 'Wakil Sekretaris',
        'bendahara' => 'Bendahara', 'wakil_bendahara' => 'Wakil Bendahara', 'humas' => 'Humas'
    ]; 
}

function labelRole(string $role): string { 
    $d = getDaftarRole(); 
    return $d[$role] ?? $role; 
}

function warnaRole(string $role): string { 
    return match($role) { 
        'super_admin' => 'purple', 'ketua' => 'red', 'wakil_ketua' => 'orange',
        'sekretaris' => 'blue', 'wakil_sekretaris' => 'cyan',
        'bendahara' => 'green', 'wakil_bendahara' => 'teal', 'humas' => 'gray',
        default => 'gray' 
    }; 
}
