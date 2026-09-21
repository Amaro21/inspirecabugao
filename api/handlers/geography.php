<?php
// api/handlers/geography.php — the Streets -> Puroks -> Houses -> Members
// hierarchy. All CRUD for the geographic/household side of the system.

switch ($action) {

// ===================== STREETS =====================
case 'streets':
    $db = getDB();
    $rows = $db->query("
        SELECT s.*, COUNT(DISTINCT h.id) house_count, COUNT(m.id) population,
               SUM(m.gender='male') males, SUM(m.gender='female') females,
               SUM(m.age_group='child') children, SUM(m.age_group='senior') seniors,
               SUM(m.is_pwd=1) pwd_count
        FROM streets s
        LEFT JOIN puroks p ON p.street_id = s.id
        LEFT JOIN houses h ON h.purok_id = p.id
        LEFT JOIN members m ON m.house_id = h.id
        GROUP BY s.id ORDER BY s.name
    ")->fetchAll();
    jsonResponse($rows);

case 'puroks':
    $db = getDB();
    $rows = $db->query("
        SELECT p.*, st.name street_name,
               COUNT(DISTINCT h.id) house_count,
               COUNT(m.id) population
        FROM puroks p
        JOIN streets st ON st.id = p.street_id
        LEFT JOIN houses h ON h.purok_id = p.id
        LEFT JOIN members m ON m.house_id = h.id
        GROUP BY p.id ORDER BY st.name, p.name
    ")->fetchAll();
    jsonResponse($rows);

case 'purok_add':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized — officials only.'], 401);
    $d = body();
    if (empty(trim($d['name'] ?? '')) || empty($d['street_id'])) {
        jsonResponse(['error' => 'Purok name and parent street are required.'], 400);
    }
    $db = getDB();
    $lat = isset($d['lat']) && $d['lat'] !== '' ? (float)$d['lat'] : null;
    $lng = isset($d['lng']) && $d['lng'] !== '' ? (float)$d['lng'] : null;
    $db->prepare("INSERT INTO puroks (street_id, name, description, lat, lng) VALUES (?, ?, ?, ?, ?)")
       ->execute([(int)$d['street_id'], trim($d['name']), trim($d['description'] ?? ''), $lat, $lng]);
    $newId = $db->lastInsertId();
    logActivity('purok_add', "Added purok \"{$d['name']}\".", 'purok', $newId);
    jsonResponse(['success' => true, 'id' => $newId]);

case 'purok_delete':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    $db = getDB();
    $pst = $db->prepare("SELECT name FROM puroks WHERE id = ?");
    $pst->execute([(int)($d['id'] ?? 0)]);
    $pname = $pst->fetchColumn();
    $db->prepare("DELETE FROM puroks WHERE id = ?")->execute([(int)($d['id'] ?? 0)]);
    logActivity('purok_delete', "Deleted purok \"" . ($pname ?: '#'.$d['id']) . "\" (and all its houses/members).", 'purok', (int)($d['id'] ?? 0));
    jsonResponse(['success' => true]);

case 'purok_edit':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized — officials only.'], 401);
    $d = body();
    $id = (int)($d['id'] ?? 0);
    if (empty(trim($d['name'] ?? '')) || empty($d['street_id'])) {
        jsonResponse(['error' => 'Purok name and parent street are required.'], 400);
    }
    $db = getDB();
    $old = $db->prepare("SELECT name FROM puroks WHERE id = ?");
    $old->execute([$id]);
    $oldName = $old->fetchColumn();
    $lat = isset($d['lat']) && $d['lat'] !== '' ? (float)$d['lat'] : null;
    $lng = isset($d['lng']) && $d['lng'] !== '' ? (float)$d['lng'] : null;
    $db->prepare("UPDATE puroks SET street_id=?, name=?, description=?, lat=?, lng=? WHERE id=?")
       ->execute([(int)$d['street_id'], trim($d['name']), trim($d['description'] ?? ''), $lat, $lng, $id]);
    $desc = ($oldName && $oldName !== trim($d['name']))
        ? "Renamed purok \"$oldName\" to \"{$d['name']}\"."
        : "Edited purok \"{$d['name']}\".";
    logActivity('purok_edit', $desc, 'purok', $id);
    jsonResponse(['success' => true]);

case 'street_add':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized — officials only.'], 401);
    $d = body();
    if (empty(trim($d['name'] ?? ''))) jsonResponse(['error' => 'Street name required.'], 400);
    $db = getDB();
    $db->prepare("INSERT INTO streets (name, description, lat, lng) VALUES (?, ?, ?, ?)")
       ->execute([trim($d['name']), trim($d['description'] ?? ''), $d['lat'] ?? null, $d['lng'] ?? null]);
    $newId = $db->lastInsertId();
    logActivity('street_add', "Added street \"{$d['name']}\".", 'street', $newId);
    jsonResponse(['success' => true, 'id' => $newId]);

case 'street_delete':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    $db = getDB();
    $sst = $db->prepare("SELECT name FROM streets WHERE id = ?");
    $sst->execute([(int)($d['id'] ?? 0)]);
    $sname = $sst->fetchColumn();
    $db->prepare("DELETE FROM streets WHERE id = ?")->execute([(int)($d['id'] ?? 0)]);
    logActivity('street_delete', "Deleted street \"" . ($sname ?: '#'.$d['id']) . "\" (and all its puroks/houses/members).", 'street', (int)($d['id'] ?? 0));
    jsonResponse(['success' => true]);

case 'street_edit':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized — officials only.'], 401);
    $d = body();
    $id = (int)($d['id'] ?? 0);
    if (empty(trim($d['name'] ?? ''))) jsonResponse(['error' => 'Street name required.'], 400);
    $db = getDB();
    $old = $db->prepare("SELECT name FROM streets WHERE id = ?");
    $old->execute([$id]);
    $oldName = $old->fetchColumn();
    $db->prepare("UPDATE streets SET name=?, description=?, lat=?, lng=? WHERE id=?")
       ->execute([trim($d['name']), trim($d['description'] ?? ''), $d['lat'] ?? null, $d['lng'] ?? null, $id]);
    $desc = ($oldName && $oldName !== trim($d['name']))
        ? "Renamed street \"$oldName\" to \"{$d['name']}\"."
        : "Edited street \"{$d['name']}\".";
    logActivity('street_edit', $desc, 'street', $id);
    jsonResponse(['success' => true]);

// ===================== HOUSES =====================
case 'houses':
    $pid = (int)($_GET['purok_id'] ?? 0);
    $sid = (int)($_GET['street_id'] ?? 0);
    if (!$pid && !$sid) jsonResponse(['error' => 'purok_id or street_id required.'], 400);
    $db = getDB();
    if ($pid) {
        $st = $db->prepare("
            SELECT h.*, COUNT(m.id) member_count,
                SUM(m.gender='male') males, SUM(m.gender='female') females,
                SUM(m.age_group='adult') adults, SUM(m.age_group='child') children, SUM(m.age_group='senior') seniors
            FROM houses h
            LEFT JOIN members m ON m.house_id = h.id
            WHERE h.purok_id = ?
            GROUP BY h.id ORDER BY h.house_number
        ");
        $st->execute([$pid]);
    } else {
        $st = $db->prepare("
            SELECT h.*, COUNT(m.id) member_count,
                SUM(m.gender='male') males, SUM(m.gender='female') females,
                SUM(m.age_group='adult') adults, SUM(m.age_group='child') children, SUM(m.age_group='senior') seniors
            FROM houses h
            JOIN puroks p ON p.id = h.purok_id
            LEFT JOIN members m ON m.house_id = h.id
            WHERE p.street_id = ?
            GROUP BY h.id ORDER BY h.house_number
        ");
        $st->execute([$sid]);
    }
    jsonResponse($st->fetchAll());

case 'house_detail':
    $id = (int)($_GET['id'] ?? 0);
    $db = getDB();
    $st = $db->prepare("
        SELECT h.*, st.id street_id, st.name street_name, p.name purok_name,
            COUNT(m.id) member_count,
            SUM(m.gender='male') males, SUM(m.gender='female') females,
            SUM(m.age_group='adult') adults, SUM(m.age_group='child') children,
            SUM(m.age_group='senior') seniors, SUM(m.is_pwd=1) pwd_count
        FROM houses h
        JOIN puroks p ON p.id = h.purok_id
        JOIN streets st ON st.id = p.street_id
        LEFT JOIN members m ON m.house_id = h.id
        WHERE h.id = ? GROUP BY h.id
    ");
    $st->execute([$id]);
    $h = $st->fetch();
    if (!$h) jsonResponse(['error' => 'House not found.'], 404);
    $st2 = $db->prepare("SELECT * FROM members WHERE house_id = ? ORDER BY is_household_head DESC, is_family_head DESC, last_name, first_name");
    $st2->execute([$id]);
    $h['members'] = $st2->fetchAll();
    jsonResponse($h);

case 'house_add':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    if (empty($d['purok_id'])) jsonResponse(['error' => 'purok_id required.'], 400);
    $db = getDB();
    $houseNum = trim($d['house_number'] ?? '');
    if ($houseNum !== '') {
        // Unique across the whole barangay, not just within a street.
        $dup = $db->prepare("SELECT id FROM houses WHERE house_number = ?");
        $dup->execute([$houseNum]);
        if ($dup->fetch()) jsonResponse(['error' => 'A house with this number already exists.'], 400);
    }
    $db->prepare("INSERT INTO houses (purok_id, house_number, lat, lng) VALUES (?, ?, ?, ?)")
       ->execute([(int)$d['purok_id'], $houseNum, $d['lat'] ?? null, $d['lng'] ?? null]);
    $newId = $db->lastInsertId();
    logActivity('house_add', "Added house #" . $houseNum . ".", 'house', $newId);
    jsonResponse(['success' => true, 'id' => $newId]);

case 'house_edit':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    if (empty($d['purok_id'])) jsonResponse(['error' => 'purok_id required.'], 400);
    $db = getDB();
    $houseNum = trim($d['house_number'] ?? '');
    if ($houseNum !== '') {
        // Exclude this house's own row so keeping its existing number
        // doesn't get flagged as a duplicate of itself.
        $dup = $db->prepare("SELECT id FROM houses WHERE house_number = ? AND id != ?");
        $dup->execute([$houseNum, (int)$d['id']]);
        if ($dup->fetch()) jsonResponse(['error' => 'A house with this number already exists.'], 400);
    }
    $db->prepare("UPDATE houses SET purok_id=?, house_number=?, lat=?, lng=? WHERE id=?")
       ->execute([(int)$d['purok_id'], $houseNum, $d['lat'] ?? null, $d['lng'] ?? null, (int)$d['id']]);
    logActivity('house_edit', "Edited house #" . $houseNum . ".", 'house', (int)$d['id']);
    jsonResponse(['success' => true]);

case 'house_delete':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    $db = getDB();
    $hst = $db->prepare("SELECT house_number FROM houses WHERE id = ?");
    $hst->execute([(int)($d['id'] ?? 0)]);
    $hnum = $hst->fetchColumn();
    $db->prepare("DELETE FROM houses WHERE id = ?")->execute([(int)($d['id'] ?? 0)]);
    logActivity('house_delete', "Deleted house #" . ($hnum ?: $d['id']) . " (and its residents).", 'house', (int)($d['id'] ?? 0));
    jsonResponse(['success' => true]);

// ===================== MEMBERS =====================
case 'member_add':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    foreach (['house_id','first_name','last_name','gender','birth_date'] as $f) {
        if (empty($d[$f])) jsonResponse(['error' => "$f is required."], 400);
    }
    // age_group is derived from birth_date on the server — never trusted
    // from the client — so it can't drift out of sync with the actual
    // date of birth, and the frontend doesn't need to get this right itself.
    $ageGroup = calcAgeGroup($d['birth_date']);
    $isPwd = !empty($d['is_pwd']) ? 1 : 0;
    $isHouseholdHead = !empty($d['is_household_head']) ? 1 : 0;
    $isFamilyHead = !empty($d['is_family_head']) ? 1 : 0;
    $db = getDB();
    // Household head is meant to be unique per house (unlike family head,
    // since one house can hold more than one family) — unset it on any
    // existing member of this house before inserting the new one.
    if ($isHouseholdHead) {
        $db->prepare("UPDATE members SET is_household_head = 0 WHERE house_id = ?")->execute([(int)$d['house_id']]);
    }
    $db->prepare("INSERT INTO members (house_id, first_name, middle_name, last_name, gender, age_group, birth_date, is_pwd, is_household_head, is_family_head) VALUES (?,?,?,?,?,?,?,?,?,?)")
       ->execute([(int)$d['house_id'], trim($d['first_name']), trim($d['middle_name'] ?? ''), trim($d['last_name']), $d['gender'], $ageGroup, $d['birth_date'], $isPwd, $isHouseholdHead, $isFamilyHead]);
    $newId = $db->lastInsertId();
    logActivity('member_add', "Added resident \"" . trim($d['first_name']) . ' ' . trim($d['last_name']) . "\".", 'member', $newId);
    jsonResponse(['success' => true, 'id' => $newId]);

case 'member_edit':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    if (empty($d['birth_date'])) jsonResponse(['error' => 'birth_date is required.'], 400);
    $ageGroup = calcAgeGroup($d['birth_date']);
    $isPwd = !empty($d['is_pwd']) ? 1 : 0;
    $isHouseholdHead = !empty($d['is_household_head']) ? 1 : 0;
    $isFamilyHead = !empty($d['is_family_head']) ? 1 : 0;
    $db = getDB();
    // Same uniqueness rule as member_add — unset household head on every
    // other member of this house first, so setting it here can't result
    // in two household heads for the same house.
    if ($isHouseholdHead && !empty($d['house_id'])) {
        $db->prepare("UPDATE members SET is_household_head = 0 WHERE house_id = ? AND id != ?")->execute([(int)$d['house_id'], (int)$d['id']]);
    }
    $db->prepare("UPDATE members SET first_name=?, middle_name=?, last_name=?, gender=?, age_group=?, birth_date=?, is_pwd=?, is_household_head=?, is_family_head=? WHERE id=?")
       ->execute([trim($d['first_name']), trim($d['middle_name'] ?? ''), trim($d['last_name']), $d['gender'], $ageGroup, $d['birth_date'], $isPwd, $isHouseholdHead, $isFamilyHead, (int)$d['id']]);
    logActivity('member_edit', "Edited resident \"" . trim($d['first_name']) . ' ' . trim($d['last_name']) . "\".", 'member', (int)$d['id']);
    jsonResponse(['success' => true]);

case 'member_delete':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    $db = getDB();
    $mst = $db->prepare("SELECT first_name, last_name FROM members WHERE id = ?");
    $mst->execute([(int)($d['id'] ?? 0)]);
    $mrow = $mst->fetch();
    $mname = $mrow ? $mrow['first_name'].' '.$mrow['last_name'] : '#'.($d['id'] ?? '');
    $db->prepare("DELETE FROM members WHERE id = ?")->execute([(int)($d['id'] ?? 0)]);
    logActivity('member_delete', "Deleted resident \"$mname\".", 'member', (int)($d['id'] ?? 0));
    jsonResponse(['success' => true]);

case 'fh_hh_report':
    // Downloads a Word-compatible document directly (rather than returning
    // JSON for a modal, as this used to). Word opens HTML content saved
    // with a .doc extension and the right Content-Type just fine — this
    // avoids needing PHP's ZipArchive extension or any external library
    // for a true .docx, since InfinityFree's shared hosting doesn't
    // guarantee either is available (see backup.php's own note on why it
    // sticks to plain PDO rather than shelling out).
    if (!isOfficial()) { http_response_code(401); echo 'Unauthorized.'; exit; }
    $db = getDB();
    // FH (family heads) can be more than one per house — a house can hold
    // more than one family. HH (household heads) is meant to be exactly
    // one per house, enforced when it's set (see member_add/member_edit),
    // so this count is effectively "how many houses in this purok".
    $rows = $db->query("
        SELECT p.id purok_id, p.name purok_name, st.name street_name,
            COUNT(DISTINCT CASE WHEN m.is_family_head=1 THEN m.id END) fh,
            COUNT(DISTINCT CASE WHEN m.is_household_head=1 THEN m.id END) hh,
            SUM(m.gender='male') male,
            SUM(m.gender='female') female
        FROM puroks p
        JOIN streets st ON st.id = p.street_id
        LEFT JOIN houses h ON h.purok_id = p.id
        LEFT JOIN members m ON m.house_id = h.id
        GROUP BY p.id ORDER BY st.name, p.name
    ")->fetchAll();
    $totals = ['fh'=>0,'hh'=>0,'male'=>0,'female'=>0];
    foreach ($rows as $r) {
        $totals['fh']    += (int)$r['fh'];
        $totals['hh']    += (int)$r['hh'];
        $totals['male']  += (int)$r['male'];
        $totals['female']+= (int)$r['female'];
    }
    $totalPop = $totals['male'] + $totals['female'];
    $generatedAt = date('F j, Y');

    $tableRows = '';
    foreach ($rows as $r) {
        $tableRows .= '<tr>'
            . '<td>' . htmlspecialchars($r['purok_name']) . '</td>'
            . '<td align="center">' . (int)$r['fh'] . '</td>'
            . '<td align="center">' . (int)$r['hh'] . '</td>'
            . '<td align="center">' . (int)$r['male'] . '</td>'
            . '<td align="center">' . (int)$r['female'] . '</td>'
            . '</tr>';
    }

    $html = '<html><head><meta charset="UTF-8"><title>FH/HH Report</title></head>'
        . '<body style="font-family:Calibri,Arial,sans-serif">'
        . '<div style="text-align:center;margin-bottom:16px">'
        . '<h2 style="margin-bottom:2px">Barangay Cabugao</h2>'
        . '<div style="font-size:14pt">Family &amp; Household Heads Report</div>'
        . '<div style="font-size:10pt;color:#555">As of ' . $generatedAt . '</div>'
        . '</div>'
        . '<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:11pt">'
        . '<tr style="background:#dbeafe"><th>Purok</th><th>FH</th><th>HH</th><th>Male</th><th>Female</th></tr>'
        . $tableRows
        . '<tr style="background:#dbeafe;font-weight:bold">'
        . '<td>Total</td>'
        . '<td align="center">' . $totals['fh'] . '</td>'
        . '<td align="center">' . $totals['hh'] . '</td>'
        . '<td align="center">' . $totals['male'] . '</td>'
        . '<td align="center">' . $totals['female'] . '</td>'
        . '</tr>'
        . '</table>'
        . '<div style="text-align:center;margin-top:16px;font-size:13pt;font-weight:bold">Total Population: ' . number_format($totalPop) . '</div>'
        . '</body></html>';

    header('Content-Type: application/msword; charset=utf-8');
    header('Content-Disposition: attachment; filename="FH_HH_Report_' . date('Y-m-d') . '.doc"');
    echo $html;
    exit;

case 'pwd_report':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $db = getDB();
    // birth_date goes to the frontend as-is — it already has calcAge() for
    // turning that into an exact age (used on the member cards and the
    // add/edit form's age preview), so this reuses that instead of
    // duplicating the same date math in PHP.
    $rows = $db->query("
        SELECT m.first_name, m.middle_name, m.last_name, m.gender, m.birth_date,
            h.house_number, p.name purok_name, st.name street_name
        FROM members m
        JOIN houses h ON h.id = m.house_id
        JOIN puroks p ON p.id = h.purok_id
        JOIN streets st ON st.id = p.street_id
        WHERE m.is_pwd = 1
        ORDER BY st.name, p.name, m.last_name, m.first_name
    ")->fetchAll();
    jsonResponse(['residents' => $rows, 'total' => count($rows), 'generated_at' => date('F j, Y')]);

}
