<?php
// api/handlers/auth.php — login, logout, profile, and password recovery.
// Loaded by api/index.php only when $action belongs to this group.

switch ($action) {

case 'login':
    $d = body();
    $username = trim($d['username'] ?? '');
    $password = $d['password'] ?? '';

    if (empty($username) || empty($password)) {
        jsonResponse(['error' => 'Username and password are required.'], 400);
    }

    $db = getDB();
    $st = $db->prepare("SELECT * FROM users WHERE username = ? AND is_active = 1");
    $st->execute([$username]);
    $u = $st->fetch();

    $valid = false;
    if ($u) {
        $stored = $u['password'] ?? '';
        if (!empty($stored) && password_verify($password, $stored)) {
            $valid = true;
        } elseif (empty($stored) && !empty($password)) {
            // First-time login with empty hash — set it now
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $db->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([$hash, $u['id']]);
            $valid = true;
        }
    }

    if ($valid) {
        $_SESSION['user'] = [
            'id'        => $u['id'],
            'username'  => $u['username'],
            'full_name' => $u['full_name'],
            'role'      => $u['role'],
            'email'     => $u['email'] ?? '',
        ];
        logActivity('login', "Logged in.", 'user', $u['id']);
        jsonResponse(['success' => true, 'user' => $_SESSION['user']]);
    }

    jsonResponse(['error' => 'Invalid username or password.'], 401);

case 'logout':
    logActivity('logout', 'Logged out.', 'user', currentUser()['id'] ?? null);
    session_destroy();
    jsonResponse(['success' => true]);

case 'update_profile':
    if (!isLoggedIn()) jsonResponse(['error' => 'Not logged in.'], 401);
    $d = body();
    $fullName = trim($d['full_name'] ?? '');
    $email    = trim($d['email'] ?? '');
    if (empty($fullName)) jsonResponse(['error' => 'Full name is required.'], 400);
    if (!empty($email) && !preg_match('/^[^\s@]+@gmail\.com$/i', $email)) {
        jsonResponse(['error' => 'Please provide a valid Gmail address (must end in @gmail.com).'], 400);
    }
    $db  = getDB();
    $uid = currentUser()['id'];
    if (!empty($email)) {
        $st = $db->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
        $st->execute([$email, $uid]);
        if ($st->fetch()) jsonResponse(['error' => 'That Gmail address is already linked to another account.'], 409);
    }
    $db->prepare("UPDATE users SET full_name = ?, email = ? WHERE id = ?")
       ->execute([$fullName, $email ?: null, $uid]);
    // Refresh the session copy so the new name/email show immediately
    $_SESSION['user']['full_name'] = $fullName;
    $_SESSION['user']['email'] = $email;
    logActivity('update_profile', "Updated own profile (name: $fullName).", 'user', $uid);
    jsonResponse(['success' => true, 'user' => $_SESSION['user']]);

case 'change_password':
    if (!isLoggedIn()) jsonResponse(['error' => 'Not logged in.'], 401);
    $d = body();
    $current = $d['current_password'] ?? '';
    $new     = $d['new_password'] ?? '';
    if (empty($current) || empty($new)) {
        jsonResponse(['error' => 'Current and new password are required.'], 400);
    }
    if (strlen($new) < 6) {
        jsonResponse(['error' => 'New password must be at least 6 characters.'], 400);
    }
    $db  = getDB();
    $uid = currentUser()['id'];
    $st  = $db->prepare("SELECT * FROM users WHERE id = ?");
    $st->execute([$uid]);
    $u = $st->fetch();
    if (!$u || !password_verify($current, $u['password'] ?? '')) {
        jsonResponse(['error' => 'Current password is incorrect.'], 400);
    }
    $hash = password_hash($new, PASSWORD_DEFAULT);
    $db->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([$hash, $uid]);
    logActivity('change_password', 'Changed own password.', 'user', $uid);
    jsonResponse(['success' => true]);

case 'forgot_password':
    $d = body();
    $email = trim($d['email'] ?? '');
    if (empty($email)) {
        jsonResponse(['error' => 'Gmail address is required.'], 400);
    }
    $db = getDB();
    $st = $db->prepare("SELECT * FROM users WHERE email = ? AND is_active = 1");
    $st->execute([$email]);
    $u = $st->fetch();
    // Always respond the same way whether or not a match was found, so this
    // endpoint can't be used to discover which emails are registered.
    if ($u) {
        $token   = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', time() + 3600); // 1 hour
        $db->prepare("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?")
           ->execute([$token, $expires, $u['id']]);

        // PHP_SELF reflects the URL that was actually REQUESTED (api/index.php),
        // not this handler file (which is only reached via require). That
        // request still lives one level inside api/, so two dirname() calls
        // (api/handlers/auth.php's own depth is irrelevant here) gets us back
        // to the real app root where the public index.php lives.
        $appRoot = dirname(dirname($_SERVER['PHP_SELF']));
        $resetLink = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https://' : 'http://')
                   . $_SERVER['HTTP_HOST'] . $appRoot . '/index.php?reset_token=' . $token;
        $subject = 'INSPIRE Cabugao — Password Reset Request';
        $body    = "Hi {$u['full_name']},\n\nA password reset was requested for your INSPIRE admin account (username: {$u['username']}).\n\n"
                 . "Click the link below to set a new password. This link expires in 1 hour:\n{$resetLink}\n\n"
                 . "If you did not request this, you can safely ignore this email.\n\n— INSPIRE Cabugao";
        safeSendMail($email, $subject, $body, 'INSPIRE Cabugao');
        logActivity('forgot_password_request', "Requested a password reset link.", 'user', $u['id'], $u);
    }
    jsonResponse(['success' => true]);

case 'reset_password_confirm':
    $d = body();
    $token = trim($d['token'] ?? '');
    $new   = $d['new_password'] ?? '';
    if (empty($token) || empty($new)) {
        jsonResponse(['error' => 'Invalid request.'], 400);
    }
    if (strlen($new) < 6) {
        jsonResponse(['error' => 'New password must be at least 6 characters.'], 400);
    }
    $db = getDB();
    $st = $db->prepare("SELECT * FROM users WHERE reset_token = ? AND reset_expires >= NOW()");
    $st->execute([$token]);
    $u = $st->fetch();
    if (!$u) {
        jsonResponse(['error' => 'This reset link is invalid or has expired. Please request a new one.'], 400);
    }
    $hash = password_hash($new, PASSWORD_DEFAULT);
    $db->prepare("UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?")
       ->execute([$hash, $u['id']]);
    logActivity('reset_password_confirm', 'Reset password via emailed link.', 'user', $u['id'], $u);
    jsonResponse(['success' => true]);

case 'me':
    jsonResponse(['user' => currentUser(), 'logged_in' => isLoggedIn()]);

case 'app_config':
    // Public, no auth — only ever exposes the reCAPTCHA *site* key (not secret),
    // which is meant to be public anyway.
    jsonResponse(['recaptcha_site_key' => RECAPTCHA_SITE_KEY]);

// ── Break-glass recovery code ─────────────────────────────────────
// A "master key" for the Super Admin account specifically, for the one
// scenario the normal forgot-password flow can't cover: losing access to
// BOTH the account password AND the linked Gmail at the same time. The
// code is shown in plaintext exactly once at generation time and only
// ever stored as a hash afterward — there is no way to retrieve a lost
// code, only to generate a new one (which immediately invalidates any
// previous code).

case 'generate_recovery_code':
    if (!isAdmin()) jsonResponse(['error' => 'Unauthorized — Super Admin only.'], 401);
    $uid = currentUser()['id'];
    // Same safe alphabet as incident reference codes — no visually
    // ambiguous characters (0/O, 1/I/L), grouped for easier transcription.
    $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $raw = '';
    for ($g = 0; $g < 4; $g++) {
        if ($g > 0) $raw .= '-';
        for ($i = 0; $i < 4; $i++) $raw .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    $hash = password_hash($raw, PASSWORD_DEFAULT);
    $db = getDB();
    $db->prepare("UPDATE users SET recovery_code_hash = ? WHERE id = ?")->execute([$hash, $uid]);
    logActivity('recovery_code_generated', 'Generated a new account recovery code (any previous code is now invalid).', 'user', $uid);
    jsonResponse(['success' => true, 'code' => $raw]);

case 'recovery_code_status':
    if (!isAdmin()) jsonResponse(['error' => 'Unauthorized — Super Admin only.'], 401);
    $db = getDB();
    $st = $db->prepare("SELECT recovery_code_hash FROM users WHERE id = ?");
    $st->execute([currentUser()['id']]);
    jsonResponse(['has_code' => !empty($st->fetchColumn())]);

case 'recover_with_code':
    // Public — this IS the path for when you can't log in at all. Deliberately
    // gives the same generic error for "no such user" and "wrong code" so it
    // can't be used to discover valid usernames.
    $d = body();
    $username = trim($d['username'] ?? '');
    $code     = trim($d['code'] ?? '');
    $new      = $d['new_password'] ?? '';
    if (empty($username) || empty($code) || empty($new)) {
        jsonResponse(['error' => 'Username, recovery code, and new password are required.'], 400);
    }
    if (strlen($new) < 6) {
        jsonResponse(['error' => 'New password must be at least 6 characters.'], 400);
    }
    $db = getDB();
    $st = $db->prepare("SELECT * FROM users WHERE username = ? AND role = 'super_admin' AND is_active = 1");
    $st->execute([$username]);
    $u = $st->fetch();
    if (!$u || empty($u['recovery_code_hash']) || !password_verify($code, $u['recovery_code_hash'])) {
        jsonResponse(['error' => 'Invalid username or recovery code.'], 401);
    }
    $hash = password_hash($new, PASSWORD_DEFAULT);
    // Single-use: the code is cleared the moment it's used. A fresh one
    // must be generated (while logged in) before this path works again.
    $db->prepare("UPDATE users SET password = ?, recovery_code_hash = NULL WHERE id = ?")
       ->execute([$hash, $u['id']]);
    logActivity('recovery_code_used', 'Regained access and reset password using the break-glass recovery code.', 'user', $u['id'], $u);
    jsonResponse(['success' => true]);

}
// Public self-registration removed — staff accounts are created by the
// Super Admin via the Admin Dashboard → Users tab (see 'user_create').
