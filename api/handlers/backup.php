<?php
// api/handlers/backup.php — Super Admin only: generates a complete,
// restorable SQL dump of the live database. Pure PHP (loops through
// tables via PDO) rather than shelling out to the mysqldump binary,
// because exec()/shell_exec() are routinely disabled on shared hosting —
// this works anywhere PDO does.
//
// To restore from a backup file: open phpMyAdmin -> select the database
// -> Import tab -> choose the .sql file -> Go. That's the same workflow
// already used throughout this project for database.sql/upgrade.sql.
//
// Two ways to get a backup:
//   - 'export_backup'     : manual, on-demand direct download
//   - 'check_auto_backup' : automatic — silently runs whenever a staff
//     member visits the Admin Dashboard, and if 7+ days have passed since
//     the last one, emails a fresh backup to the Super Admin's Gmail.
//     Deliberately emailed OFF the server rather than saved on it — on
//     free/shared hosting, a backup stored on the SAME account doesn't
//     protect you if that account gets suspended or wiped, since the
//     backup disappears right along with everything else.

// Builds the full SQL dump as a string. Shared by both the manual
// download and the automatic emailed backup below.
function generateBackupSql() {
    $db = getDB();
    $sql = "-- INSPIRE Cabugao — full database backup\n";
    $sql .= "-- Generated: " . date('Y-m-d H:i:s') . "\n";
    $sql .= "-- Restore via phpMyAdmin: select the database -> Import -> choose this file -> Go.\n\n";

    // Explicit dependency-safe order — every table is listed AFTER every
    // table it has a foreign key pointing to. We don't rely solely on SET
    // FOREIGN_KEY_CHECKS=0 above to paper over a bad ordering: some hosts'
    // phpMyAdmin import process doesn't reliably carry that session
    // setting across the whole file, which caused a real "foreign key
    // constraint incorrectly formed" error on a table created before the
    // table it references existed yet.
    // Forward order: parents before children (for CREATE TABLE — each table's
    // FK references must already exist before it is created).
    $createOrder = ['streets', 'users', 'puroks', 'houses', 'members', 'facilities', 'incidents', 'import_logs', 'activity_logs'];
    // Reverse order: children before parents (for DROP TABLE — removes the
    // FK references before the tables they point at are dropped, so MySQL
    // never hits a constraint violation regardless of FOREIGN_KEY_CHECKS).
    // This avoids relying on SET FOREIGN_KEY_CHECKS=0 entirely, which
    // InfinityFree's phpMyAdmin ignores completely.
    $dropOrder = array_reverse($createOrder);

    $allTables = $db->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $createTables = array_values(array_unique(array_merge(
        array_intersect($createOrder, $allTables),
        $allTables
    )));
    $dropTables = array_values(array_unique(array_merge(
        array_intersect($dropOrder, $allTables),
        array_reverse($allTables)
    )));

    // Phase 1: drop all tables in reverse dependency order (children first)
    $sql .= "-- Phase 1: Drop tables (children before parents, no FK conflicts)\n";
    foreach ($dropTables as $table) {
        $sql .= "DROP TABLE IF EXISTS `$table`;\n";
    }
    $sql .= "\n";

    // Phase 2: create tables + insert data in forward dependency order
    foreach ($createTables as $table) {
        $sql .= "-- --------------------------------------------------\n";
        $sql .= "-- Table: $table\n";
        $sql .= "-- --------------------------------------------------\n";

        $createRow = $db->query("SHOW CREATE TABLE `$table`")->fetch();
        $createSql = $createRow['Create Table'] ?? '';
        $sql .= $createSql . ";\n\n";

        $rowCount = (int)$db->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
        if ($rowCount === 0) { $sql .= "\n"; continue; }

        $stmt = $db->query("SELECT * FROM `$table`");
        $batch = [];
        $columns = null;

        $flushBatch = function() use (&$batch, &$columns, $table, &$sql) {
            if (!$batch) return;
            $colList = '`' . implode('`, `', $columns) . '`';
            $sql .= "INSERT INTO `$table` ($colList) VALUES\n";
            $sql .= implode(",\n", $batch) . ";\n";
            $batch = [];
        };

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if ($columns === null) $columns = array_keys($row);
            $values = array_map(function($v) use ($db) {
                if ($v === null) return 'NULL';
                return $db->quote($v);
            }, array_values($row));
            $batch[] = '(' . implode(', ', $values) . ')';
            if (count($batch) >= 50) $flushBatch();
        }
        $flushBatch();
        $sql .= "\n";
    }

    $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
    return $sql;
}

switch ($action) {

case 'export_backup':
    if (!isAdmin()) jsonResponse(['error' => 'Unauthorized — Super Admin only.'], 401);

    $filename = 'inspire_cabugao_backup_' . date('Y-m-d_His') . '.sql';
    $sql = generateBackupSql();

    // Discard the JSON headers/buffer bootstrap.php set up by default —
    // this response is a raw .sql file, not JSON.
    if (ob_get_level() > 0) ob_clean();
    header_remove('Content-Type');
    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    echo $sql;

    logActivity('backup_export', "Exported a full database backup ($filename).", 'system', null);
    exit;

case 'check_auto_backup':
    // Called silently from the Admin Dashboard on every visit by any
    // staff member — deliberately NOT restricted to Super Admin only,
    // since any staff member's visit can be the trigger that keeps
    // backups flowing even if the Super Admin personally hasn't logged
    // in for a while. The actual email always goes to the Super Admin's
    // address regardless of who triggered the check.
    if (!isOfficial()) jsonResponse(['ran' => false]);

    $db = getDB();
    $lastBackup = $db->query("SELECT MAX(created_at) FROM activity_logs WHERE action = 'auto_backup_sent'")->fetchColumn();
    $daysSince = $lastBackup ? (time() - strtotime($lastBackup)) / 86400 : 999;

    if ($daysSince < 7) {
        jsonResponse(['ran' => false, 'days_since_last' => round($daysSince, 1)]);
    }

    $superAdmin = $db->query("SELECT email, full_name FROM users WHERE role = 'super_admin' AND email IS NOT NULL AND email != '' ORDER BY id LIMIT 1")->fetch();
    if (!$superAdmin || empty($superAdmin['email'])) {
        // No Super Admin email on file to send to — log this once so it's
        // visible in the Activity Log instead of failing silently forever.
        logActivity('auto_backup_skipped', 'Automatic backup skipped — no Super Admin Gmail address on file to send it to.', 'system', null);
        jsonResponse(['ran' => false, 'reason' => 'no_email']);
    }

    $filename = 'inspire_cabugao_autobackup_' . date('Y-m-d_His') . '.sql';
    $sql = generateBackupSql();
    $sizeKb = round(strlen($sql) / 1024, 1);

    $sent = sendBackupEmail(
        $superAdmin['email'],
        'INSPIRE Cabugao — Weekly Automatic Backup',
        "Hi {$superAdmin['full_name']},\n\nAttached is your automatic weekly database backup ({$sizeKb} KB).\n\n"
        . "This was sent automatically because it's been 7+ days since the last backup, and someone visited the Admin Dashboard, which triggers this check.\n\n"
        . "To restore from this file if ever needed: open phpMyAdmin, select your database, go to the Import tab, choose this attached file, and click Go.\n\n"
        . "— INSPIRE Cabugao",
        $filename,
        $sql
    );

    if ($sent) {
        logActivity('auto_backup_sent', "Automatic weekly backup emailed to {$superAdmin['email']} ($filename, {$sizeKb} KB).", 'system', null);
        jsonResponse(['ran' => true, 'sent' => true]);
    } else {
        logActivity('auto_backup_skipped', "Automatic backup was due but the email failed to send (check Gmail SMTP settings in config.php).", 'system', null);
        jsonResponse(['ran' => true, 'sent' => false]);
    }

}
