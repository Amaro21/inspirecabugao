<?php
// api/index.php — thin router.
//
// All actual endpoint logic lives in api/handlers/*.php, grouped by domain
// (auth, stats, geography, facilities, incidents, users,
// activity_log). Shared helpers live in api/lib/*.php. This file's only
// job is: set up the request, figure out which handler file owns the
// requested action, and load exactly that one file.
//
// Why split it this way: the previous version of this file was a single
// ~1,100-line switch statement covering 45 different actions. That worked,
// but it meant every change — however small — touched one giant file, and
// it relied entirely on every case remembering to call jsonResponse()
// (which exits) rather than any structural guarantee against PHP's normal
// switch fall-through behavior. Splitting by domain doesn't change any
// behavior — every line of logic below was moved verbatim — it just means
// a bug in, say, incident handling can't accidentally sit two cases away
// from unrelated user-management code.

ob_start();

require_once '../config.php';
enforceHttps();
require_once 'lib/bootstrap.php';   // headers, body(), error handlers, calcAgeGroup()
require_once 'lib/recaptcha.php';   // verifyRecaptcha()
require_once 'lib/mail.php';        // safeSendMail(), sendViaGmailSMTP()
require_once 'lib/logging.php';     // logActivity()
require_once 'lib/photos.php';      // savePhotoFile(), deletePhotoFile()

$action = trim($_GET['action'] ?? '');

// Maps every supported action to the handler file responsible for it.
$routes = [
    // ---- auth.php ----
    'login'                  => 'auth',
    'logout'                 => 'auth',
    'update_profile'         => 'auth',
    'change_password'        => 'auth',
    'forgot_password'        => 'auth',
    'reset_password_confirm' => 'auth',
    'generate_recovery_code' => 'auth',
    'recovery_code_status'   => 'auth',
    'recover_with_code'      => 'auth',
    'me'                     => 'auth',
    'app_config'             => 'auth',

    // ---- stats.php ----
    'stats'    => 'stats',
    'map_data' => 'stats',
    'search'   => 'stats',

    // ---- geography.php (Streets -> Puroks -> Houses -> Members) ----
    'streets'      => 'geography',
    'street_add'   => 'geography',
    'street_edit'  => 'geography',
    'street_delete'=> 'geography',
    'puroks'       => 'geography',
    'purok_add'    => 'geography',
    'purok_edit'   => 'geography',
    'purok_delete' => 'geography',
    'houses'       => 'geography',
    'house_detail' => 'geography',
    'house_add'    => 'geography',
    'house_edit'   => 'geography',
    'house_delete' => 'geography',
    'member_add'   => 'geography',
    'member_edit'  => 'geography',
    'member_delete'=> 'geography',
    'fh_hh_report' => 'geography',
    'pwd_report'   => 'geography',

    // ---- facilities.php ----
    'facilities'      => 'facilities',
    'facility_add'    => 'facilities',
    'facility_edit'   => 'facilities',
    'facility_delete' => 'facilities',

    // ---- incidents.php ----
    'incidents_monthly'   => 'incidents',
    'incidents'           => 'incidents',
    'incident_report'     => 'incidents',
    'check_report_status' => 'incidents',
    'incident_update'     => 'incidents',
    'incident_delete'     => 'incidents',
    'incidents_pending'   => 'incidents',
    'incident_approve'    => 'incidents',
    'incident_reject'     => 'incidents',

    // ---- users.php (Super Admin account management) ----
    'users'       => 'users',
    'user_create' => 'users',
    'user_toggle' => 'users',
    'user_delete' => 'users',
    'user_role'   => 'users',

    // ---- activity_log.php ----
    'activity_logs'      => 'activity_log',
    'activity_log_users' => 'activity_log',

    // ---- backup.php ----
    'export_backup'     => 'backup',
    'check_auto_backup'  => 'backup',
];

if (!isset($routes[$action])) {
    jsonResponse(['error' => "Unknown action: $action"], 404);
}

require __DIR__ . '/handlers/' . $routes[$action] . '.php';

ob_end_flush();
