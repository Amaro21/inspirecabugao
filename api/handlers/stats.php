<?php
// api/handlers/stats.php — dashboard counters, the live map's combined
// data feed, and the global search bar.

switch ($action) {

case 'stats':
    $db = getDB();
    jsonResponse([
        'population' => (int)$db->query("SELECT COUNT(*) FROM members")->fetchColumn(),
        'houses'     => (int)$db->query("SELECT COUNT(*) FROM houses")->fetchColumn(),
        'streets'    => (int)$db->query("SELECT COUNT(*) FROM streets")->fetchColumn(),
        'puroks'     => (int)$db->query("SELECT COUNT(*) FROM puroks")->fetchColumn(),
        'facilities' => (int)$db->query("SELECT COUNT(*) FROM facilities")->fetchColumn(),
        'incidents'  => (int)$db->query("SELECT COUNT(*) FROM incidents WHERE approved=1 AND status NOT IN ('closed','resolved')")->fetchColumn(),
        'adults'     => (int)$db->query("SELECT COUNT(*) FROM members WHERE age_group='adult'")->fetchColumn(),
        'children'   => (int)$db->query("SELECT COUNT(*) FROM members WHERE age_group='child'")->fetchColumn(),
        'seniors'    => (int)$db->query("SELECT COUNT(*) FROM members WHERE age_group='senior'")->fetchColumn(),
        'pwd'        => (int)$db->query("SELECT COUNT(*) FROM members WHERE is_pwd=1")->fetchColumn(),
        'males'      => (int)$db->query("SELECT COUNT(*) FROM members WHERE gender='male'")->fetchColumn(),
        'females'    => (int)$db->query("SELECT COUNT(*) FROM members WHERE gender='female'")->fetchColumn(),
    ]);

case 'map_data':
    $db = getDB();
    $streets = $db->query("
        SELECT s.*, COUNT(DISTINCT h.id) house_count, COUNT(m.id) population,
               SUM(m.gender='male') males, SUM(m.gender='female') females,
               SUM(m.age_group='child') children, SUM(m.age_group='senior') seniors,
               SUM(m.is_pwd=1) pwd_count
        FROM streets s
        LEFT JOIN puroks p ON p.street_id = s.id
        LEFT JOIN houses h ON h.purok_id = p.id
        LEFT JOIN members m ON m.house_id=h.id
        GROUP BY s.id
    ")->fetchAll();
    $houses = $db->query("
        SELECT h.*, st.name street_name, p.name purok_name, COUNT(m.id) member_count
        FROM houses h
        JOIN puroks p ON p.id = h.purok_id
        JOIN streets st ON st.id = p.street_id
        LEFT JOIN members m ON m.house_id=h.id
        WHERE h.lat IS NOT NULL GROUP BY h.id
    ")->fetchAll();
    $facilities = $db->query("SELECT * FROM facilities WHERE lat IS NOT NULL ORDER BY category")->fetchAll();
    // Staff see pending (unapproved) reports PLUS everything else that
    // isn't past its removal window. An incident's removal window only
    // starts once it's actually resolved/closed (resolved_at), never
    // based on how long ago it was approved — open/investigating
    // incidents stay visible indefinitely, matching incVisibilityInfo()
    // on the frontend. Admin can still see everything regardless of age
    // via "View All on Map" on the Incidents page.
    if (isOfficial()) {
        $incidents = $db->query("
            SELECT * FROM incidents
            WHERE lat IS NOT NULL
            AND (
                status NOT IN ('resolved','closed')
                OR resolved_at >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
            )
            ORDER BY approved ASC, created_at DESC
        ")->fetchAll();
    } else {
        $incidents = $db->query("
            SELECT * FROM incidents
            WHERE lat IS NOT NULL AND approved = 1
            AND (
                status NOT IN ('resolved','closed')
                OR resolved_at >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
            )
            ORDER BY created_at DESC
        ")->fetchAll();
    }
    $puroks = $db->query("
        SELECT p.*,
               COUNT(DISTINCT h.id) house_count,
               COUNT(m.id) population,
               SUM(m.gender='male') males,
               SUM(m.gender='female') females,
               SUM(m.age_group='child') children,
               SUM(m.age_group='senior') seniors,
               SUM(m.is_pwd=1) pwd_count
        FROM puroks p
        LEFT JOIN houses h ON h.purok_id = p.id
        LEFT JOIN members m ON m.house_id = h.id
        WHERE p.lat IS NOT NULL
        GROUP BY p.id
    ")->fetchAll();
    jsonResponse(compact('streets','houses','facilities','incidents','puroks'));

case 'search':
    $q = trim($_GET['q'] ?? '');
    if (strlen($q) < 2) jsonResponse(['results' => []]);
    $db   = getDB();
    $like = '%' . $q . '%';

    $results = [];

    // House number and resident name search reveal exactly where a specific
    // house or person is — staff only. Public search stays limited to
    // streets, puroks, and facilities.
    if (isOfficial()) {
        $h = $db->prepare("SELECT h.id, 'house' type, IFNULL(h.house_number,'') label, st.name sublabel, h.lat, h.lng FROM houses h JOIN puroks p ON p.id=h.purok_id JOIN streets st ON st.id=p.street_id WHERE h.house_number LIKE ? LIMIT 8");
        $h->execute([$like]);
        $results = array_merge($results, $h->fetchAll());

        $m = $db->prepare("SELECT m.id, 'member' type, CONCAT(m.last_name,', ',m.first_name,' ',IFNULL(m.middle_name,'')) label, CONCAT(IFNULL(h.house_number,''),', ',st.name) sublabel, h.lat, h.lng, m.house_id FROM members m JOIN houses h ON h.id=m.house_id JOIN puroks p ON p.id=h.purok_id JOIN streets st ON st.id=p.street_id WHERE m.first_name LIKE ? OR m.last_name LIKE ? OR m.middle_name LIKE ? LIMIT 8");
        $m->execute([$like,$like,$like]);
        $results = array_merge($results, $m->fetchAll());
    }

    $f = $db->prepare("SELECT id, 'facility' type, name label, category sublabel, lat, lng FROM facilities WHERE name LIKE ? OR description LIKE ? LIMIT 5");
    $f->execute([$like,$like]);

    $s = $db->prepare("SELECT id, 'street' type, name label, '' sublabel, lat, lng FROM streets WHERE name LIKE ? LIMIT 4");
    $s->execute([$like]);

    $p = $db->prepare("SELECT id, 'purok' type, name label, 'Purok' sublabel, lat, lng FROM puroks WHERE name LIKE ? LIMIT 5");
    $p->execute([$like]);

    jsonResponse(['results' => array_merge($results, $f->fetchAll(), $s->fetchAll(), $p->fetchAll())]);

}
