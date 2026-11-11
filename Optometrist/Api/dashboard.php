<?php
                                                                
require_once 'database.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed', 405);

$today = date('Y-m-d');
$now   = date('H:i:s');

function scalar(PDO $pdo, string $sql, array $p = []) {
    $s = $pdo->prepare($sql); $s->execute($p); return $s->fetchColumn();
}

                    
$kpi = [
    'appointments' => (int)scalar($pdo, "SELECT COUNT(*) FROM appointment WHERE AppointmentDate=:d AND Status<>'Cancelled'", [':d' => $today]),
    'waiting'      => (int)scalar($pdo, "SELECT COUNT(*) FROM appointment WHERE AppointmentDate=:d AND Status='Confirmed'", [':d' => $today]),
    'completed'    => (int)scalar($pdo, "SELECT COUNT(*) FROM eye_examination WHERE ExaminationDate=:d", [':d' => $today]),
    'pending_rx'   => (int)scalar($pdo, "SELECT COUNT(*) FROM prescription WHERE Status='Pending Sign-off'"),
    'rx_today'     => (int)scalar($pdo, "SELECT COUNT(*) FROM prescription WHERE PrescriptionDate=:d", [':d' => $today]),
    'next_time'    => scalar($pdo, "SELECT MIN(AppointmentTime) FROM appointment WHERE AppointmentDate=:d AND Status IN ('Scheduled','Confirmed') AND AppointmentTime>:t", [':d' => $today, ':t' => $now]) ?: null,
];

                                   
$sixMonthsAgo = date('Y-m-d', strtotime('-6 months'));
$notif = [
    'waiting'   => $kpi['waiting'],
    'upcoming'  => (int)scalar($pdo, "SELECT COUNT(*) FROM appointment WHERE AppointmentDate=:d AND Status='Scheduled' AND AppointmentTime>:t", [':d' => $today, ':t' => $now]),
    'rx_ready'  => $kpi['rx_today'],
    'followups' => (int)scalar($pdo, "SELECT COUNT(*) FROM (SELECT CustomerID, MAX(ExaminationDate) m FROM eye_examination GROUP BY CustomerID) x WHERE m<=:d", [':d' => $sixMonthsAgo]),
];

                                    
$activity = [];
foreach (fetchAllRows($pdo, "SELECT c.FullName, a.AppointmentType FROM appointment a JOIN customer c ON c.CustomerID=a.CustomerID WHERE a.AppointmentDate=:d AND a.Status='Confirmed' LIMIT 2", [':d' => $today]) as $r) {
    $activity[] = ['type' => 'waiting', 'title' => 'Patient waiting', 'sub' => $r['FullName'] . ' · ' . $r['AppointmentType']];
}
$r = fetchOne($pdo, "SELECT c.FullName, a.AppointmentType, a.AppointmentTime FROM appointment a JOIN customer c ON c.CustomerID=a.CustomerID WHERE a.AppointmentDate=:d AND a.Status='Scheduled' AND a.AppointmentTime>:t ORDER BY a.AppointmentTime LIMIT 1", [':d' => $today, ':t' => $now]);
if ($r) $activity[] = ['type' => 'upcoming', 'title' => 'Upcoming appointment', 'sub' => $r['FullName'] . ' · ' . $r['AppointmentType'] . ' · ' . date('h:i A', strtotime($r['AppointmentTime']))];
$r = fetchOne($pdo, "SELECT p.PrescriptionID, c.FullName FROM prescription p JOIN customer c ON c.CustomerID=p.CustomerID WHERE p.PrescriptionDate=:d ORDER BY p.PrescriptionID DESC LIMIT 1", [':d' => $today]);
if ($r) $activity[] = ['type' => 'rx', 'title' => 'Prescription ready for pickup', 'sub' => $r['FullName'] . ' · RX-' . $r['PrescriptionID']];
$r = fetchOne($pdo, "SELECT c.FullName FROM (SELECT CustomerID, MAX(ExaminationDate) m FROM eye_examination GROUP BY CustomerID) x JOIN customer c ON c.CustomerID=x.CustomerID WHERE x.m<=:d ORDER BY x.m LIMIT 1", [':d' => $sixMonthsAgo]);
if ($r) $activity[] = ['type' => 'followup', 'title' => 'Follow-up reminder', 'sub' => $r['FullName'] . ' · 6-month check-up due'];

                                        
$cnt = $pdo->prepare("SELECT COUNT(*) FROM eye_examination WHERE ExaminationDate BETWEEN :a AND :b");
$countRange = function ($a, $b) use ($cnt) { $cnt->execute([':a' => $a, ':b' => $b]); return (int)$cnt->fetchColumn(); };

$daily = ['labels' => [], 'data' => []];
for ($i = 6; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i day"));
    $daily['labels'][] = date('M d', strtotime($d));
    $daily['data'][]   = $countRange($d, $d);
}
$weekly = ['labels' => [], 'data' => []];
for ($w = 3; $w >= 0; $w--) {
    $end = date('Y-m-d', strtotime("-" . ($w * 7) . " day"));
    $start = date('Y-m-d', strtotime("$end -6 day"));
    $weekly['labels'][] = 'Wk ' . (4 - $w);
    $weekly['data'][]   = $countRange($start, $end);
}
$monthly = ['labels' => [], 'data' => []];
for ($m = 5; $m >= 0; $m--) {
    $first = date('Y-m-01', strtotime(date('Y-m-01') . " -$m month"));
    $monthly['labels'][] = date('M', strtotime($first));
    $monthly['data'][]   = $countRange($first, date('Y-m-t', strtotime($first)));
}

                                                                    
$cats = ['Myopia' => 0, 'Astigmatism' => 0, 'Hyperopia' => 0, 'Presbyopia' => 0, 'Other' => 0];
$histories = $pdo->query("SELECT MedicalHistory FROM customer WHERE MedicalHistory IS NOT NULL AND MedicalHistory<>''")->fetchAll(PDO::FETCH_COLUMN);
foreach ($histories as $h) {
    foreach (explode(',', $h) as $t) {
        $t = trim($t);
        if ($t === '') continue;
        $key = 'Other';
        foreach (['Myopia', 'Astigmatism', 'Hyperopia', 'Presbyopia'] as $name) {
            if (stripos($t, $name) !== false) { $key = $name; break; }
        }
        $cats[$key]++;
    }
}
$total = array_sum($cats);
$conditions = [];
foreach ($cats as $label => $n) {
    $conditions[] = ['label' => $label, 'count' => $n, 'pct' => $total ? (int)round($n * 100 / $total) : 0];
}

respond([
    'kpi' => $kpi, 'notif' => $notif, 'activity' => $activity,
    'charts' => ['daily' => $daily, 'weekly' => $weekly, 'monthly' => $monthly],
    'conditions' => $conditions,
]);
