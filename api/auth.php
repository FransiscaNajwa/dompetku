<?php
// =============================================
// auth.php — Login & Register
// POST /api/auth.php?action=register
// POST /api/auth.php?action=login
// =============================================

require_once 'config.php';
setCORS();

$action = $_GET['action'] ?? '';
$body   = getBody();

// ---------- REGISTER ----------
if ($action === 'register') {
    $name     = trim($body['name']     ?? '');
    $username = strtolower(trim($body['username'] ?? ''));
    $password = $body['password'] ?? '';

    if (!$name || !$username || !$password)
        respondError('Nama, username, dan password wajib diisi.');
    if (strlen($username) < 3)
        respondError('Username minimal 3 karakter.');
    if (!preg_match('/^[a-z0-9_]+$/', $username))
        respondError('Username hanya boleh huruf kecil, angka, dan underscore.');
    if (strlen($password) < 6)
        respondError('Password minimal 6 karakter.');

    $db = getDB();

    // Cek username sudah ada
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
    $stmt->execute([$username]);
    if ($stmt->fetch()) respondError('Username sudah digunakan.');

    // Simpan user
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $db->prepare('INSERT INTO users (username, name, password) VALUES (?, ?, ?)');
    $stmt->execute([$username, $name, $hash]);
    $userId = $db->lastInsertId();

    // Insert default categories
    $defaultCats = [
        ['🍽️', 'Food'], ['🚗', 'Transport'], ['📱', 'Kouta'],
        ['🛒', 'Groceries'], ['👨‍👩‍👧', 'Orang Tua'], ['🏠', 'Kost'],
        ['💰', 'RDPU'], ['📦', 'ETC'],
    ];
    $stmtCat = $db->prepare('INSERT INTO categories (user_id, emoji, name, sort_order) VALUES (?, ?, ?, ?)');
    foreach ($defaultCats as $i => $cat)
        $stmtCat->execute([$userId, $cat[0], $cat[1], $i]);

    // Insert default platforms
    $platforms = ['JAGO', 'BYU', 'SEABANK', 'BIBIT', 'Tunai'];
    $stmtPlat  = $db->prepare('INSERT INTO saving_platforms (user_id, name, sort_order) VALUES (?, ?, ?)');
    foreach ($platforms as $i => $p) $stmtPlat->execute([$userId, $p, $i]);

    // Insert default portfolios
    $portfolios = ['Dana Wisuda', 'Dana Tabungan', 'Dana Darurat'];
    $stmtPort   = $db->prepare('INSERT INTO portfolios (user_id, name, sort_order) VALUES (?, ?, ?)');
    foreach ($portfolios as $i => $p) $stmtPort->execute([$userId, $p, $i]);

    // Insert default semester
    $now   = new DateTime();
    $start = $now->format('Y-m');
    $now->modify('+5 months');
    $end   = $now->format('Y-m');
    $stmtSem = $db->prepare('INSERT INTO semesters (user_id, name, start_month, end_month) VALUES (?, ?, ?, ?)');
    $stmtSem->execute([$userId, 'Semester 1', $start, $end]);

    $token = createToken($userId, $username);
    respond(['success' => true, 'token' => $token, 'user' => ['id' => $userId, 'username' => $username, 'name' => $name]]);
}

// ---------- LOGIN ----------
if ($action === 'login') {
    $username = strtolower(trim($body['username'] ?? ''));
    $password = $body['password'] ?? '';

    if (!$username || !$password) respondError('Username dan password wajib diisi.');

    $db   = getDB();
    $stmt = $db->prepare('SELECT id, username, name, password FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password']))
        respondError('Username atau password salah.', 401);

    $token = createToken($user['id'], $user['username']);
    respond(['success' => true, 'token' => $token, 'user' => ['id' => $user['id'], 'username' => $user['username'], 'name' => $user['name']]]);
}

// ---------- UPDATE PROFILE ----------
if ($action === 'update_profile') {
    $auth    = requireAuth();
    $newName = trim($body['name']     ?? '');
    $newUser = strtolower(trim($body['username'] ?? ''));

    if (!$newName || !$newUser) respondError('Nama dan username wajib diisi.');
    if (strlen($newUser) < 3)   respondError('Username minimal 3 karakter.');
    if (!preg_match('/^[a-z0-9_]+$/', $newUser)) respondError('Username tidak valid.');

    $db = getDB();
    if ($newUser !== $auth['username']) {
        $stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$newUser]);
        if ($stmt->fetch()) respondError('Username sudah digunakan.');
    }
    $stmt = $db->prepare('UPDATE users SET name = ?, username = ? WHERE id = ?');
    $stmt->execute([$newName, $newUser, $auth['user_id']]);

    $token = createToken($auth['user_id'], $newUser);
    respond(['success' => true, 'token' => $token, 'user' => ['username' => $newUser, 'name' => $newName]]);
}

// ---------- CHANGE PASSWORD ----------
if ($action === 'change_password') {
    $auth    = requireAuth();
    $oldPass = $body['old_password'] ?? '';
    $newPass = $body['new_password'] ?? '';

    if (!$oldPass || !$newPass) respondError('Password lama dan baru wajib diisi.');
    if (strlen($newPass) < 6)   respondError('Password baru minimal 6 karakter.');

    $db   = getDB();
    $stmt = $db->prepare('SELECT password FROM users WHERE id = ?');
    $stmt->execute([$auth['user_id']]);
    $user = $stmt->fetch();

    if (!password_verify($oldPass, $user['password'])) respondError('Password lama salah.');

    $hash = password_hash($newPass, PASSWORD_BCRYPT);
    $stmt = $db->prepare('UPDATE users SET password = ? WHERE id = ?');
    $stmt->execute([$hash, $auth['user_id']]);
    respond(['success' => true, 'message' => 'Password berhasil diubah.']);
}

respondError('Action tidak dikenal.', 404);