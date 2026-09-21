<?php
// api/handlers/incidents.php — the incident reporting/approval lifecycle:
// public submission, staff triage (approve/reject), status updates, the
// monthly report view, and the anonymous-but-traceable status lookup.

switch ($action) {

case 'incidents_monthly':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $db = getDB();
    $where = []; $params = [];
    // Only show approved (verified) incidents — pending and rejected are
    // managed via the Pending Reports tab, not here. Rejected incidents
    // stay in the database permanently but don't appear in this view.
    // This tab is specifically the resolved-incidents archive — the Map
    // tab already covers what's currently active/live, so this is always
    // scoped to completed cases, not user-selectable via a status filter.
    $where[] = "i.approved = 1";
    $where[] = "i.status = 'resolved'";
    if (!empty($_GET['year']))     { $where[] = "YEAR(i.created_at) = ?";  $params[] = (int)$_GET['year']; }
    if (!empty($_GET['month']))    { $where[] = "MONTH(i.created_at) = ?"; $params[] = (int)$_GET['month']; }
    if (!empty($_GET['category'])) { $where[] = "i.category = ?";         $params[] = $_GET['category']; }
    if (!empty($_GET['subtype']))  { $where[] = "i.subtype = ?";          $params[] = $_GET['subtype']; }
    $sql = "SELECT i.*, DATE_FORMAT(i.created_at,'%Y-%m-%d') as date_fmt,
                   MONTHNAME(i.created_at) as month_name, YEAR(i.created_at) as yr,
                   MONTH(i.created_at) as mo,
                   i.approved_at,
                   TIMESTAMPDIFF(MINUTE, i.approved_at, NOW()) as mins_since_approved
            FROM incidents i"
         . " WHERE " . implode(' AND ', $where)
         . " ORDER BY i.created_at DESC";
    $st = $db->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll();
    // Monthly counts for chart
    $monthly = [];
    foreach ($rows as $r) {
        $key = $r['yr'].'-'.str_pad($r['mo'],2,'0',STR_PAD_LEFT);
        if (!isset($monthly[$key])) $monthly[$key] = ['label'=>$r['month_name'].' '.$r['yr'],'count'=>0];
        $monthly[$key]['count']++;
    }
    ksort($monthly);
    jsonResponse(['incidents' => $rows, 'monthly' => array_values($monthly)]);

case 'incidents':
    $db     = getDB();
    $where  = [];
    $params = [];
    if (!empty($_GET['status']))   { $where[] = "i.status = ?";   $params[] = $_GET['status']; }
    if (!empty($_GET['category'])) { $where[] = "i.category = ?"; $params[] = $_GET['category']; }
    // Officials/admins see all; public only sees approved ones
    if (isOfficial()) {
        $sql = "SELECT i.*, u.full_name reporter_fullname FROM incidents i LEFT JOIN users u ON u.id = i.reported_by"
             . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
             . " ORDER BY i.approved ASC, i.created_at DESC";
    } else {
        $where[] = "i.approved = 1";
        $sql = "SELECT i.*, u.full_name reporter_fullname FROM incidents i LEFT JOIN users u ON u.id = i.reported_by"
             . " WHERE " . implode(' AND ', $where)
             . " ORDER BY i.created_at DESC";
    }
    $st = $db->prepare($sql);
    $st->execute($params);
    jsonResponse($st->fetchAll());

case 'incident_report':
    // Only residents (and guests) can submit incident reports
    if (isOfficial()) jsonResponse(['error' => 'Officials cannot submit incident reports. Use the Admin Dashboard to manage incidents.'], 403);
    $d = body();

    // Honeypot check — real users never see or fill this field. If it has a
    // value, silently pretend success so the bot doesn't know it was caught
    // and try harder, but don't actually save anything.
    if (!empty(trim($d['website'] ?? ''))) {
        jsonResponse(['success' => true, 'reference_code' => 'RC0000XXXX']);
    }

    // reCAPTCHA verification — skipped entirely if no secret key is configured
    // (e.g. local testing), enforced once RECAPTCHA_SECRET_KEY is set in config.php.
    if (!empty(RECAPTCHA_SECRET_KEY)) {
        $captchaToken = $d['g_recaptcha_response'] ?? '';
        if (empty($captchaToken)) {
            jsonResponse(['error' => 'Please complete the CAPTCHA check.'], 400);
        }
        $verifyResult = verifyRecaptcha($captchaToken, $_SERVER['REMOTE_ADDR'] ?? '');
        if (!$verifyResult) {
            jsonResponse(['error' => 'CAPTCHA verification failed. Please try again.'], 400);
        }
    }

    if (empty(trim($d['description'] ?? '')) || empty($d['category'])) {
        jsonResponse(['error' => 'Description and category are required.'], 400);
    }
    if (empty($d['lat']) || empty($d['lng'])) {
        jsonResponse(['error' => 'Please pin the incident location on the map.'], 400);
    }
    if (empty($d['photo'])) {
        jsonResponse(['error' => 'Please attach a photo as proof.'], 400);
    }

    // Server-side whitelist mirroring the subtype options offered in the
    // form — 'other' has no subtype list, every other category requires
    // a valid one of its own.
    $subtypesByCategory = [
        'fire'     => ['structural', 'grass_wildland', 'electrical', 'vehicle', 'other_fire'],
        'accident' => ['vehicular', 'pedestrian', 'work_related', 'fall_injury', 'other_accident'],
        'crime'    => ['theft_robbery', 'physical_altercation', 'vandalism', 'suspicious_activity', 'public_disturbance', 'other_crime'],
    ];
    $category = $d['category'];
    $subtype  = trim($d['subtype'] ?? '');
    if (isset($subtypesByCategory[$category])) {
        if (!in_array($subtype, $subtypesByCategory[$category], true)) {
            jsonResponse(['error' => 'Please select a subtype.'], 400);
        }
    } else {
        $subtype = null; // 'other' category — no subtype
    }

    $urgency = in_array($d['urgency'] ?? '', ['normal', 'urgent', 'emergency'], true) ? $d['urgency'] : 'normal';

    $db  = getDB();
    $uid = currentUser()['id'] ?? null;

    // Generate a short, unique, human-friendly reference code (excludes
    // visually-ambiguous characters like 0/O and 1/I/L for easier reading
    // over the phone), retrying on the rare collision.
    $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    do {
        $code = '';
        for ($i = 0; $i < 7; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        $check = $db->prepare("SELECT id FROM incidents WHERE reference_code = ?");
        $check->execute([$code]);
    } while ($check->fetch());

    $db->prepare("INSERT INTO incidents (title, category, subtype, description, lat, lng, address, urgency, reporter_name, reporter_contact, reported_by, photo, reference_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
       ->execute([trim($d['title']), $category, $subtype, trim($d['description']), $d['lat'] ?? null, $d['lng'] ?? null, trim($d['address'] ?? ''), $urgency, trim($d['reporter_name'] ?? ''), trim($d['reporter_contact'] ?? ''), $uid, savePhotoFile($d['photo'] ?? null), $code]);
    $newId = $db->lastInsertId();
    logActivity('incident_report', "Incident reported by \"" . trim($d['reporter_name'] ?? 'Anonymous') . "\" (ref: $code). Contact: " . trim($d['reporter_contact'] ?? '—') . ".", 'incident', $newId);
    jsonResponse(['success' => true, 'id' => $newId, 'reference_code' => $code]);

case 'check_report_status':
    // Public, no login required — lookup by reference code only.
    $code = trim($_GET['code'] ?? '');
    if (empty($code)) jsonResponse(['error' => 'Please enter a reference code.'], 400);
    $db = getDB();
    $st = $db->prepare("SELECT reference_code, category, status, description, created_at, approved, resolution_notes, resolved_at FROM incidents WHERE reference_code = ?");
    $st->execute([strtoupper($code)]);
    $r = $st->fetch();
    if (!$r) jsonResponse(['error' => 'No report found with that reference code. Please check and try again.'], 404);
    jsonResponse(['report' => $r]);

case 'incident_update':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d        = body();
    $db       = getDB();
    $resolved = in_array($d['status'] ?? '', ['resolved','closed']) ? date('Y-m-d H:i:s') : null;
    $investigating = ($d['status'] ?? '') === 'investigating' ? date('Y-m-d H:i:s') : null;
    if (isset($d['urgency']) && in_array($d['urgency'], ['normal', 'urgent', 'emergency'], true)) {
        $db->prepare("UPDATE incidents SET status=?, urgency=?, assigned_to=?, resolution_notes=?, investigating_at=?, resolved_at=? WHERE id=?")
           ->execute([$d['status'], $d['urgency'], $d['assigned_to'] ?? null, trim($d['resolution_notes'] ?? ''), $investigating, $resolved, (int)$d['id']]);
    } else {
        // No urgency provided (the Manage modal doesn't currently offer one to
        // edit) — leave the existing value alone rather than overwriting it.
        $db->prepare("UPDATE incidents SET status=?, assigned_to=?, resolution_notes=?, investigating_at=?, resolved_at=? WHERE id=?")
           ->execute([$d['status'], $d['assigned_to'] ?? null, trim($d['resolution_notes'] ?? ''), $investigating, $resolved, (int)$d['id']]);
    }
    logActivity('incident_update', "Updated incident #{$d['id']} status to \"{$d['status']}\".", 'incident', (int)$d['id']);
    jsonResponse(['success' => true]);

case 'incident_delete':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    $db = getDB();
    $ist = $db->prepare("SELECT title, category, photo FROM incidents WHERE id = ?");
    $ist->execute([(int)($d['id'] ?? 0)]);
    $irow = $ist->fetch();
    if ($irow && !empty($irow['photo'])) deletePhotoFile($irow['photo']);
    $db->prepare("DELETE FROM incidents WHERE id = ?")->execute([(int)($d['id'] ?? 0)]);
    logActivity('incident_delete', "Deleted incident #" . ($d['id'] ?? '?') . ($irow ? " (\"{$irow['title']}\", {$irow['category']})" : "") . ".", 'incident', (int)($d['id'] ?? 0));
    jsonResponse(['success' => true]);

case 'incidents_pending':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $db = getDB();
    $rows = $db->query("
        SELECT i.*, u.full_name reporter_fullname
        FROM incidents i
        LEFT JOIN users u ON u.id = i.reported_by
        WHERE i.approved = 0 AND i.status != 'closed'
        ORDER BY i.created_at DESC
    ")->fetchAll();
    jsonResponse($rows);

case 'incident_approve':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    $db = getDB();
    $uid = currentUser()['id'] ?? null;
    $db->prepare("UPDATE incidents SET approved = 1, approved_by = ?, approved_at = NOW(), status = 'open' WHERE id = ?")
       ->execute([$uid, (int)($d['id'] ?? 0)]);
    logActivity('incident_approve', "Approved incident #" . ($d['id'] ?? '?') . " — now visible on the public map.", 'incident', (int)($d['id'] ?? 0));
    jsonResponse(['success' => true]);

case 'incident_reject':
    if (!isOfficial()) jsonResponse(['error' => 'Unauthorized.'], 401);
    $d = body();
    $db = getDB();
    $db->prepare("UPDATE incidents SET approved = 0, status = 'closed', rejection_reason = ? WHERE id = ?")
       ->execute([trim($d['reason'] ?? ''), (int)($d['id'] ?? 0)]);
    logActivity('incident_reject', "Rejected incident #" . ($d['id'] ?? '?') . ". Reason: " . trim($d['reason'] ?? '—') . ".", 'incident', (int)($d['id'] ?? 0));
    jsonResponse(['success' => true]);

}
