<?php
// api/handlers/users.php — account management (Super Admin only).
// Creating new accounts here always grants the regular Admin role; there
// is intentionally no code path here that can create another Super Admin.

switch ($action) {

case 'users':
    if (!isAdmin()) jsonResponse(['error' => 'Unauthorized — Super Admin only.'], 401);
    $db = getDB();
    jsonResponse($db->query("SELECT id, username, full_name, role, email, contact, is_active, created_at FROM users ORDER BY role, full_name")->fetchAll());

case 'user_create':
    if (!isAdmin()) jsonResponse(['error' => 'Unauthorized — Super Admin only.'], 401);
    $d = body();
    $username  = trim($d['username']  ?? '');
    $password  = $d['password']  ?? '';
    $full_name = trim($d['full_name'] ?? '');
    $email     = trim($d['email']     ?? '');
    if (empty($username) || empty($password) || empty($full_name) || empty($email)) {
        jsonResponse(['error' => 'Full name, username, password and Gmail are required.'], 400);
    }
    if (strlen($password) < 6) {
        jsonResponse(['error' => 'Password must be at least 6 characters.'], 400);
    }
    if (!preg_match('/^[^\s@]+@gmail\.com$/i', $email)) {
        jsonResponse(['error' => 'Please provide a valid Gmail address (must end in @gmail.com).'], 400);
    }
    $db = getDB();
    $st = $db->prepare("SELECT id FROM users WHERE username = ?");
    $st->execute([$username]);
    if ($st->fetch()) jsonResponse(['error' => 'Username already taken.'], 409);

    $st = $db->prepare("SELECT id FROM users WHERE email = ?");
    $st->execute([$email]);
    if ($st->fetch()) jsonResponse(['error' => 'That Gmail address is already linked to another account.'], 409);

    $hash = password_hash($password, PASSWORD_DEFAULT);
    // Accounts created here are always regular Admin — only this code path
    // can create new accounts, and it never grants Super Admin.
    $st = $db->prepare("INSERT INTO users (username, password, full_name, role, email) VALUES (?, ?, ?, 'admin', ?)");
    $st->execute([$username, $hash, $full_name, $email]);
    $newId = $db->lastInsertId();
    logActivity('user_create', "Created Admin account \"$username\" ($full_name).", 'user', $newId);
    jsonResponse(['success' => true, 'id' => $newId]);

case 'user_toggle':
    if (!isAdmin()) jsonResponse(['error' => 'Unauthorized — Super Admin only.'], 401);
    $d = body();
    $targetId = (int)($d['id'] ?? 0);
    if ($targetId === (int)(currentUser()['id'] ?? 0)) {
        jsonResponse(['error' => 'You cannot deactivate your own account.'], 400);
    }
    $db = getDB();
    $tst = $db->prepare("SELECT username, full_name FROM users WHERE id = ?");
    $tst->execute([$targetId]);
    $trow = $tst->fetch();
    $tname = $trow ? "{$trow['full_name']} ({$trow['username']})" : "#$targetId";
    $db->prepare("UPDATE users SET is_active = ? WHERE id = ?")->execute([(int)$d['is_active'], $targetId]);
    $verb = (int)$d['is_active'] ? 'Activated' : 'Deactivated';
    logActivity('user_toggle', "$verb account \"$tname\".", 'user', $targetId);
    jsonResponse(['success' => true]);

case 'user_delete':
    if (!isAdmin()) jsonResponse(['error' => 'Unauthorized — Super Admin only.'], 401);
    $d = body();
    $targetId = (int)($d['id'] ?? 0);
    if ($targetId === (int)(currentUser()['id'] ?? 0)) {
        jsonResponse(['error' => 'You cannot delete your own account.'], 400);
    }
    $db = getDB();
    $st = $db->prepare("SELECT username, full_name FROM users WHERE id = ?");
    $st->execute([$targetId]);
    $trow = $st->fetch();
    if (!$trow) jsonResponse(['error' => 'Account not found.'], 404);
    // Historical incidents/facilities/import logs are preserved — the FK is
    // ON DELETE SET NULL, so deleting the account just unlinks them, it
    // doesn't erase the underlying records.
    $db->prepare("DELETE FROM users WHERE id = ?")->execute([$targetId]);
    logActivity('user_delete', "Deleted account \"{$trow['full_name']} ({$trow['username']})\".", 'user', $targetId);
    jsonResponse(['success' => true]);

case 'user_role':
    if (!isAdmin()) jsonResponse(['error' => 'Unauthorized — Super Admin only.'], 401);
    $d = body();
    if (!in_array($d['role'] ?? '', ['admin','super_admin'])) {
        jsonResponse(['error' => 'Invalid role.'], 400);
    }
    $db = getDB();
    $rst = $db->prepare("SELECT username, full_name FROM users WHERE id = ?");
    $rst->execute([(int)$d['id']]);
    $rrow = $rst->fetch();
    $rname = $rrow ? "{$rrow['full_name']} ({$rrow['username']})" : "#{$d['id']}";
    $db->prepare("UPDATE users SET role = ? WHERE id = ?")->execute([$d['role'], (int)$d['id']]);
    logActivity('user_role', "Changed role of \"$rname\" to \"{$d['role']}\".", 'user', (int)$d['id']);
    jsonResponse(['success' => true]);

}
