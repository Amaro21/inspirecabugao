<?php
// config.php - INSPIRE System Configuration

// Make PHP's own date()/time() functions agree with the database
// timezone fix in getDB() below — without this, PHP's date() (used for
// things like resolved_at and password-reset token expiry) and MySQL's
// NOW() (used for approved_at, created_at, etc.) could each be using a
// DIFFERENT default timezone depending on how the host's PHP and MySQL
// were independently configured, causing exactly the kind of mismatch
// that made the 12-hour public-visibility countdown disagree between
// what the server stored and what a visitor's browser calculated.
date_default_timezone_set('Asia/Manila');

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'inspire_cabugao');
define('APP_NAME', 'INSPIRE');
define('APP_SUBTITLE', 'Barangay Cabugao, Bato, Catanduanes');

// Google reCAPTCHA v2 — get your own keys (free) at:
// https://www.google.com/recaptcha/admin/create
// Leave blank to disable CAPTCHA verification (e.g. while testing locally).
define('RECAPTCHA_SITE_KEY', '');
define('RECAPTCHA_SECRET_KEY', '');

// Gmail SMTP — used to actually deliver password reset emails. PHP's mail()
// is unreliable for reaching Gmail inboxes (often spam-filtered or rejected
// outright), so this sends through Google's own servers instead.
//
// Setup (5 minutes, free, uses any Gmail account you control):
// 1. Go to https://myaccount.google.com/security
// 2. Turn on "2-Step Verification" if it isn't already on (required)
// 3. Go to https://myaccount.google.com/apppasswords
// 4. Create an app password (name it e.g. "INSPIRE Cabugao") — copy the
//    16-character code it gives you (looks like: abcd efgh ijkl mnop)
// 5. Paste your Gmail address and that 16-character code below
//
// Leave GMAIL_SMTP_USER blank to fall back to PHP's built-in mail()
// instead (which usually only works once deployed on a real host, and
// even then isn't guaranteed to reach Gmail).
define('GMAIL_SMTP_USER', '');          // e.g. 'inspirecabugao@gmail.com'
define('GMAIL_SMTP_APP_PASSWORD', '');  // the 16-character app password (no spaces)

// HTTPS enforcement — leave FALSE for local development (XAMPP/localhost
// has no SSL certificate, so forcing HTTPS would just break login
// entirely). Once deployed to a real host with a real SSL certificate
// (most hosts give you one free via Let's Encrypt/AutoSSL — usually one
// click in their control panel), flip this to TRUE. Every login,
// password reset, and recovery-code use sends credentials over the
// network; without HTTPS those travel in plain readable text.
define('FORCE_HTTPS', false);

// Redirects HTTP -> HTTPS when FORCE_HTTPS is on. Checks X-Forwarded-Proto
// too, since many hosts terminate SSL at a proxy/load-balancer in front
// of PHP — in that setup $_SERVER['HTTPS'] alone can be unreliable even
// though the actual connection really is encrypted.
function enforceHttps() {
    if (!FORCE_HTTPS) return;
    $isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    if (!$isHttps && isset($_SERVER['HTTP_HOST'])) {
        $url = 'https://' . $_SERVER['HTTP_HOST'] . ($_SERVER['REQUEST_URI'] ?? '/');
        header('Location: ' . $url, true, 301);
        exit;
    }
}

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                // Force Philippine time (+08:00) on every connection, rather
                // than trusting whatever timezone the host's MySQL server
                // defaults to. Shared/free hosts very commonly default to
                // UTC regardless of where their customers actually are —
                // without this, NOW(), CURRENT_TIMESTAMP, and every
                // approved_at/created_at value get written and compared
                // using a different "now" than what the app and its users
                // actually mean by "now," causing exactly the kind of
                // mismatch where the 12-hour public-visibility countdown
                // disagrees between the server and the browser.
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+08:00'",
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['error' => 'DB error: ' . $e->getMessage()]));
        }
    }
    return $pdo;
}

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        // 'secure' only forces HTTPS-only cookies once FORCE_HTTPS is on —
        // turning this on while still serving over plain HTTP would mean
        // the browser refuses to send the cookie at all, breaking login.
        'secure'   => FORCE_HTTPS,
        // These two are always safe regardless of HTTPS status:
        // httponly blocks JavaScript from ever reading the session cookie
        // (mitigates session theft via XSS), samesite=Lax blocks the
        // cookie from being sent on most cross-site requests (CSRF
        // mitigation) while still allowing normal link-clicking to work
        // (e.g. the password reset link from an emailed link).
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function currentUser() { return $_SESSION['user'] ?? null; }
function isLoggedIn()  { return isset($_SESSION['user']); }
// Super Admin only — delete/dismiss actions and user account management
function isSuperAdmin(){ return ($_SESSION['user']['role'] ?? '') === 'super_admin'; }
function isAdmin()     { return ($_SESSION['user']['role'] ?? '') === 'super_admin'; }
// Any staff member (Super Admin or regular Admin) — nav/dashboard access
function isOfficial()  { return in_array($_SESSION['user']['role'] ?? '', ['super_admin','admin']); }
// Regular Admin only, NOT Super Admin — day-to-day population/incident
// data edits (e.g. facility photo uploads). Super Admin's role has
// narrowed to account management and activity monitoring; they no longer
// edit this data at all. Mirrors isOperationalStaff() on the frontend.
function isOperationalStaff() { return ($_SESSION['user']['role'] ?? '') === 'admin'; }

function requireLogin() {
    if (!isLoggedIn()) { header('Location: ../index.php'); exit; }
}
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}
?>
