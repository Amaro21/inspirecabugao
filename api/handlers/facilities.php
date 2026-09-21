<?php
// api/handlers/facilities.php — schools, health centers, government
// offices, and other named points of interest on the map.

switch ($action) {

case 'facilities':
    $db  = getDB();
    $cat = $_GET['category'] ?? '';
    if ($cat) {
        $st = $db->prepare("SELECT * FROM facilities WHERE category = ? ORDER BY name");
        $st->execute([$cat]);
    } else {
        $st = $db->query("SELECT * FROM facilities ORDER BY category, name");
    }
    jsonResponse($st->fetchAll());

case 'facility_add':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    if (empty($d['name']) || empty($d['category'])) jsonResponse(['error' => 'Name and category required.'], 400);
    $db  = getDB();
    $uid = currentUser()['id'] ?? null;
    // Photo upload is regular Admin only (not Super Admin) — enforced
    // here, not just hidden in the UI, so Super Admin can't add one even
    // by calling the API directly. Super Admin's role has narrowed to
    // account management and activity monitoring; they no longer edit
    // facility data at all.
    $photo = isOperationalStaff() ? savePhotoFile($d['photo'] ?? null, 'facilities') : null;
    $db->prepare("INSERT INTO facilities (name, category, description, lat, lng, address, contact, operating_hours, photo, added_by) VALUES (?,?,?,?,?,?,?,?,?,?)")
       ->execute([trim($d['name']), $d['category'], trim($d['description'] ?? ''), $d['lat'] ?? null, $d['lng'] ?? null, trim($d['address'] ?? ''), trim($d['contact'] ?? ''), trim($d['operating_hours'] ?? ''), $photo, $uid]);
    $newId = $db->lastInsertId();
    logActivity('facility_add', "Added facility \"{$d['name']}\".", 'facility', $newId);
    jsonResponse(['success' => true, 'id' => $newId]);

case 'facility_edit':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    $db = getDB();

    $fields = [
        'name'            => trim($d['name']),
        'category'        => $d['category'],
        'description'     => trim($d['description'] ?? ''),
        'lat'             => $d['lat'] ?? null,
        'lng'             => $d['lng'] ?? null,
        'address'         => trim($d['address'] ?? ''),
        'contact'         => trim($d['contact'] ?? ''),
        'operating_hours' => trim($d['operating_hours'] ?? ''),
    ];

    // Photo is regular Admin only (not Super Admin). A Super Admin's
    // edit never includes 'photo' in $fields at all, so the existing
    // photo (if any) is left completely untouched by this UPDATE.
    if (isOperationalStaff()) {
        $oldPhotoStmt = $db->prepare("SELECT photo FROM facilities WHERE id = ?");
        $oldPhotoStmt->execute([(int)$d['id']]);
        $oldPhoto = $oldPhotoStmt->fetchColumn();
        if (!empty($d['photo']) && strpos($d['photo'], 'data:image/') === 0) {
            $newPhoto = savePhotoFile($d['photo'], 'facilities');
            if ($newPhoto) {
                if ($oldPhoto) deletePhotoFile($oldPhoto);
                $fields['photo'] = $newPhoto;
            }
        } elseif (!empty($d['remove_photo'])) {
            if ($oldPhoto) deletePhotoFile($oldPhoto);
            $fields['photo'] = null;
        }
    }

    $setClause = implode(', ', array_map(fn($k) => "$k=?", array_keys($fields)));
    $db->prepare("UPDATE facilities SET $setClause WHERE id=?")
       ->execute([...array_values($fields), (int)$d['id']]);

    logActivity('facility_edit', "Edited facility \"{$d['name']}\".", 'facility', (int)$d['id']);
    jsonResponse(['success' => true]);

case 'facility_delete':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    $db = getDB();
    $fst = $db->prepare("SELECT name, photo FROM facilities WHERE id = ?");
    $fst->execute([(int)($d['id'] ?? 0)]);
    $frow = $fst->fetch();
    if ($frow && !empty($frow['photo'])) deletePhotoFile($frow['photo']);
    $db->prepare("DELETE FROM facilities WHERE id = ?")->execute([(int)($d['id'] ?? 0)]);
    logActivity('facility_delete', "Deleted facility \"" . ($frow['name'] ?? '#'.$d['id']) . "\".", 'facility', (int)($d['id'] ?? 0));
    jsonResponse(['success' => true]);

}
