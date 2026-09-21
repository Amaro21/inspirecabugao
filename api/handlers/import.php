<?php
// api/handlers/import.php — CSV bulk import of households/residents.

switch ($action) {

case 'bulk_import':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    if (!isset($_FILES['csv_file'])) jsonResponse(['error' => 'No file uploaded.'], 400);
    $file = $_FILES['csv_file'];
    if ($file['error'] !== UPLOAD_ERR_OK) jsonResponse(['error' => 'File upload error.'], 400);
    if (strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) !== 'csv') jsonResponse(['error' => 'Only CSV files are allowed.'], 400);

    $db     = getDB();
    $handle = fopen($file['tmp_name'], 'r');
    fgetcsv($handle); // skip header row
    $imported = $failed = 0;

    $db->beginTransaction();
    try {
        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) < 8) { $failed++; continue; }
            [$sname,$pname,$hnum,$hlat,$hlng,$fname,$mname,$lname,$gender,$age,$bdate] = array_pad($row, 11, '');

            // Get or create street
            $st = $db->prepare("SELECT id FROM streets WHERE name = ?");
            $st->execute([trim($sname)]);
            $sv = $st->fetch();
            if (!$sv) {
                $db->prepare("INSERT INTO streets (name) VALUES (?)")->execute([trim($sname)]);
                $sid = $db->lastInsertId();
            } else { $sid = $sv['id']; }

            // Get or create purok under this street
            $purokName = trim($pname) !== '' ? trim($pname) : 'Unassigned';
            $pst = $db->prepare("SELECT id FROM puroks WHERE street_id = ? AND name = ?");
            $pst->execute([$sid, $purokName]);
            $pv = $pst->fetch();
            if (!$pv) {
                $db->prepare("INSERT INTO puroks (street_id, name) VALUES (?, ?)")->execute([$sid, $purokName]);
                $pid = $db->lastInsertId();
            } else { $pid = $pv['id']; }

            // Get or create house under this purok
            $st = $db->prepare("SELECT id FROM houses WHERE purok_id = ? AND house_number = ?");
            $st->execute([$pid, trim($hnum)]);
            $hv = $st->fetch();
            if (!$hv) {
                $db->prepare("INSERT INTO houses (purok_id, house_number, lat, lng) VALUES (?,?,?,?)")
                   ->execute([$pid, trim($hnum), $hlat ?: null, $hlng ?: null]);
                $hid = $db->lastInsertId();
            } else { $hid = $hv['id']; }

            $g = strtolower(trim($gender));
            $a = strtolower(trim($age));
            if (!in_array($g, ['male','female']) || !in_array($a, ['adult','child','senior']) || empty(trim($fname)) || empty(trim($lname))) {
                $failed++; continue;
            }
            $db->prepare("INSERT INTO members (house_id, first_name, middle_name, last_name, gender, age_group, birth_date) VALUES (?,?,?,?,?,?,?)")
               ->execute([$hid, trim($fname), trim($mname), trim($lname), $g, $a, $bdate ?: null]);
            $imported++;
        }
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        jsonResponse(['error' => 'Import failed: ' . $e->getMessage()], 500);
    }
    fclose($handle);

    $uid = currentUser()['id'] ?? null;
    $db->prepare("INSERT INTO import_logs (user_id, filename, rows_imported, rows_failed) VALUES (?,?,?,?)")
       ->execute([$uid, $file['name'], $imported, $failed]);
    logActivity('bulk_import', "Ran bulk import \"{$file['name']}\" — $imported imported, $failed skipped.", 'import', null);

    jsonResponse(['success' => true, 'imported' => $imported, 'failed' => $failed,
        'message' => "Successfully imported $imported records. $failed rows skipped."]);

case 'import_logs':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $db = getDB();
    jsonResponse($db->query("SELECT il.*, u.full_name FROM import_logs il LEFT JOIN users u ON u.id=il.user_id ORDER BY il.imported_at DESC LIMIT 20")->fetchAll());

}
