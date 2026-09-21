<?php
// api/lib/bootstrap.php — request setup shared by every endpoint:
// JSON headers, input parsing, and a global error handler that always
// replies with JSON instead of leaking a raw PHP error page.

// ── Headers ──────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');

// No CORS headers on purpose. This app's own frontend always calls the
// API via a relative path on the same domain — browsers never apply CORS
// rules to same-origin requests at all, so this app never needed them.
// A wildcard Access-Control-Allow-Origin: * (the previous setting here)
// serves no purpose for the app's own use; it only grants OTHER websites
// permission to read this API's responses from a logged-in user's
// browser. Removing it restores the normal same-origin-only default,
// which is what every request this app actually makes relies on anyway.

// ── Input helper ─────────────────────────────────────────
// Accepts JSON body OR regular POST form data
function body() {
    $raw = file_get_contents('php://input');
    if ($raw) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) return $decoded;
    }
    return $_POST ?: [];
}

// Calculate age group from birth_date
function calcAgeGroup($birth_date) {
    if (!$birth_date) return 'adult';
    $age = (int)date_diff(date_create($birth_date), date_create('today'))->y;
    if ($age <= 11) return 'child';
    if ($age >= 60) return 'senior';
    return 'adult';
}

// ── Global error handler → always return JSON ────────────
set_exception_handler(function($e) {
    ob_clean();
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $e->getMessage()]);
    exit;
});
set_error_handler(function($errno, $errstr) {
    // Respect the @ suppression operator (e.g. @mail()) — when a statement is
    // prefixed with @, PHP temporarily sets error_reporting to 0 for it.
    // Without this check, suppressed warnings still crashed the whole request.
    if (error_reporting() === 0) return false;
    throw new ErrorException($errstr, $errno);
});
