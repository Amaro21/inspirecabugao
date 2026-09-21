<?php
// api/handlers/activity_log.php — read access to the audit trail.
// Super Admin only; writing to the log happens via lib/logging.php's
// logActivity(), called from every other handler.

switch ($action) {

case 'activity_logs':
    if (!isAdmin()) jsonResponse(['error' => 'Unauthorized — Super Admin only.'], 401);
    $db = getDB();
    $where = []; $params = [];
    if (!empty($_GET['username']))   { $where[] = "username = ?";    $params[] = $_GET['username']; }
    if (!empty($_GET['log_action'])) { $where[] = "action = ?";      $params[] = $_GET['log_action']; }
    if (!empty($_GET['date_from']))  { $where[] = "created_at >= ?"; $params[] = $_GET['date_from'].' 00:00:00'; }
    if (!empty($_GET['date_to']))    { $where[] = "created_at <= ?"; $params[] = $_GET['date_to'].' 23:59:59'; }
    $sql = "SELECT * FROM activity_logs" . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . " ORDER BY created_at DESC LIMIT 500";
    $st = $db->prepare($sql);
    $st->execute($params);
    jsonResponse($st->fetchAll());

case 'activity_log_users':
    // Distinct usernames that appear in the log, for the filter dropdown.
    if (!isAdmin()) jsonResponse(['error' => 'Unauthorized — Super Admin only.'], 401);
    $db = getDB();
    jsonResponse($db->query("SELECT DISTINCT username, full_name FROM activity_logs WHERE username IS NOT NULL ORDER BY full_name")->fetchAll());

}
