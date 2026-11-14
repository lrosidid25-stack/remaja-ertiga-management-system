<?php
/**
 * PENGATURAN — Kelola Pengguna
 * Route: index.php?page=pengaturan-users
 */

requireRole(roleKelolaUser());
$db = getDB();
$error = '';
$editId = (int)($_GET['edit'] ?? 0);
$editUser = null;

if ($editId > 0) {
    $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$editId]);
    $editUser = $stmt->fetch();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $aksi = $_POST['aksi'] ?? '';

    if ($aksi === 'simpan') {
        $username = trim($_POST['username'] ?? '');
        $nama = trim($_POST['nama'] ?? '');
        $role = $_POST['role'] ?? 'humas';
        $password = $_POST['password'] ?? '';
        $id = (int)($_POST['id'] ?? 0);

        if ($username === '' || $nama === '') {
            $error = 'Username dan nama wajib diisi.';
        } elseif (!array_key_exists($role, getDaftarRole())) {
            $error = 'Role tidak valid.';
        } else {
            $cek = $db->prepare("SELECT COUNT(*) FROM users WHERE username = ? AND id != ?");
            $cek->execute([$username, $id]);
            if ((int)$cek->fetchColumn() > 0) {
                $error = 'Username sudah digunakan.';
            } elseif ($id === 0) {
                if (strlen($password) < 6) {
                    $error = 'Password minimal 6 karakter.';
                } else {
                    $db->prepare("INSERT INTO users (username, password, nama, role, no_hp, aktif) VALUES (?,?,?,?,?,?)")
                       ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $nama, $role, trim($_POST['no_hp'] ?? ''), isset($_POST['aktif']) ? 1 : 0]);
                    logAktivitas($_SESSION['user']['id'], 'Tambah user', 'users', (int)$db->lastInsertId(), "Menambah pengguna {$username}");
                    setFlash('success', 'Pengguna ditambahkan.');
                    redirect('index.php?page=pengaturan-users');
                }
            } else {
                if ($password !== '') {
                    if (strlen($password) < 6) {
                        $error = 'Password minimal 6 karakter.';
                    } else {
                        $db->prepare("UPDATE users SET username=?, nama=?, role=?, no_hp=?, aktif=?, password=? WHERE id=?")
                           ->execute([$username, $nama, $role, trim($_POST['no_hp'] ?? ''), isset($_POST['aktif']) ? 1 : 0,
                                     password_hash($password, PASSWORD_DEFAULT), $id]);
                    }
                } else {
                    $db->prepare("UPDATE users SET username=?, nama=?, role=?, no_hp=?, aktif=? WHERE id=?")
                       ->execute([$username, $nama, $role, trim($_POST['no_hp'] ?? ''), isset($_POST['aktif']) ? 1 : 0, $id]);
                }

                if ($error === '') {
                    logAktivitas($_SESSION['user']['id'], 'Edit user', 'users', $id, "Mengubah pengguna {$username}");
                    setFlash('success', 'Data pengguna diperbarui.');
                    redirect('index.php?page=pengaturan-users');
                }
            }
        }
    } elseif ($aksi === 'hapus') {
        $idHapus = (int)($_POST['id'] ?? 0);
        if ($idHapus === (int)$_SESSION['user']['id']) {
            setFlash('error', 'Anda tidak dapat menghapus akun sendiri.');
        } else {
            $db->prepare("DELETE FROM users WHERE id = ?")->execute([$idHapus]);
            logAktivitas($_SESSION['user']['id'], 'Hapus user', 'users', $idHapus, 'Menghapus pengguna');
            setFlash('success', 'Pengguna dihapus.');
        }
        redirect('index.php?page=pengaturan-users');
    }
}

$users = $db->query("SELECT * FROM users ORDER BY id")->fetchAll();
?>

<div class="card-header">
    <div>
        <h2>👤 Kelola Pengguna</h2>
        <p class="text-muted" style="font-size:.87rem;">Akun pengurus yang dapat mengakses sistem.</p>
    </div>
    <a href="index.php?page=pengaturan" class="btn btn-outline">← Pengaturan</a>
</div>

<?php if ($error): ?><div class="alert alert-red"><?= htmlspecialchars($error) ?></div><?php endif; ?>

<div class="card">
    <div class="card-title"><?= $editUser ? '✏️ Edit Pengguna: ' . htmlspecialchars($editUser['nama']) : '➕ Tambah Pengguna' ?></div>
    <form method="post" action="index.php?page=pengaturan-users<?= $editUser ? '&edit=' . (int)$editUser['id'] : '' ?>">
        <input type="hidden" name="aksi" value="simpan">
        <input type="hidden" name="id" value="<?= $editUser ? (int)$editUser['id'] : 0 ?>">
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="username">Username *</label>
                <input type="text" id="username" name="username" required value="<?= htmlspecialchars($editUser['username'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label" for="nama">Nama Lengkap *</label>
                <input type="text" id="nama" name="nama" required value="<?= htmlspecialchars($editUser['nama'] ?? '') ?>">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label" for="role">Role</label>
                <select id="role" name="role">
                    <?php foreach (getDaftarRole() as $v => $l): ?>
                        <option value="<?= $v ?>" <?= ($editUser['role'] ?? '') === $v ? 'selected' : '' ?>><?= $l ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="no_hp">No. HP</label>
                <input type="tel" id="no_hp" name="no_hp" value="<?= htmlspecialchars($editUser['no_hp'] ?? '') ?>">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label" for="password">Password <?= $editUser ? '(kosongkan bila tidak diubah)' : '*' ?></label>
            <input type="password" id="password" name="password" <?= $editUser ? '' : 'required' ?> minlength="6" autocomplete="new-password">
        </div>
        <div class="form-group checkbox-row">
            <input type="checkbox" id="aktif" name="aktif" value="1" <?= (!$editUser || (int)$editUser['aktif'] === 1) ? 'checked' : '' ?>>
            <label for="aktif" class="form-label" style="margin-bottom:0;">Akun aktif (bisa login)</label>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan</button>
            <?php if ($editUser): ?>
                <a href="index.php?page=pengaturan-users" class="btn btn-outline">Batal Edit</a>
            <?php endif; ?>
        </div>
    </form>
</div>

<div class="card">
    <div class="card-title">📋 Daftar Pengguna (<?= count($users) ?>)</div>
    <div class="table-container">
        <table>
            <thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>No. HP</th><th>Status</th><th>Login Terakhir</th><th>Aksi</th></tr></thead>
            <tbody>
            <?php foreach ($users as $u): ?>
                <tr>
                    <td style="font-family:ui-monospace,monospace;font-size:.83rem;"><?= htmlspecialchars($u['username']) ?></td>
                    <td style="font-weight:600;"><?= htmlspecialchars($u['nama']) ?></td>
                    <td><span class="badge badge-<?= warnaRole($u['role']) ?>"><?= labelRole($u['role']) ?></span></td>
                    <td style="font-size:.83rem;"><?= htmlspecialchars($u['no_hp'] ?: '-') ?></td>
                    <td><?= (int)$u['aktif'] === 1 ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-gray">Nonaktif</span>' ?></td>
                    <td style="font-size:.8rem;"><?= $u['last_login'] ? date('d/m/Y H:i', strtotime($u['last_login'])) : '-' ?></td>
                    <td>
                        <div class="btn-group">
                            <a href="index.php?page=pengaturan-users&edit=<?= (int)$u['id'] ?>" class="btn btn-sm btn-outline">Edit</a>
                            <?php if ((int)$u['id'] !== (int)$_SESSION['user']['id']): ?>
                                <form method="post" action="index.php?page=pengaturan-users" onsubmit="return confirm('Hapus pengguna ini?');">
                                    <input type="hidden" name="aksi" value="hapus">
                                    <input type="hidden" name="id" value="<?= (int)$u['id'] ?>">
                                    <button type="submit" class="btn btn-sm btn-outline-danger">Hapus</button>
                                </form>
                            <?php endif; ?>
                        </div>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
