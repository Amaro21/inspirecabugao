<?php
// api/lib/logging.php — non-repudiation audit trail.
// Snapshots the acting user's identity at the moment of the action, so the
// record stays accurate even if that account is later renamed or deleted.

function logActivity($action, $description, $targetType = null, $targetId = null, $overrideUser = null) {
    try {
        $u  = $overrideUser ?? currentUser();
        $db = getDB();
        $db->prepare("INSERT INTO activity_logs (user_id, username, full_name, role, action, description, target_type, target_id, ip_address) VALUES (?,?,?,?,?,?,?,?,?)")
           ->execute([
               $u['id'] ?? null,
               $u['username'] ?? null,
               $u['full_name'] ?? null,
               $u['role'] ?? null,
               $action,
               $description,
               $targetType,
               $targetId,
               $_SERVER['REMOTE_ADDR'] ?? null,
           ]);
    } catch (Exception $e) {
        // Never let a logging failure break the actual request
    }
}
