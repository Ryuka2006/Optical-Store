<?php
require_once __DIR__ . '/guard.php'; api_security_headers(); require_login(); require_once __DIR__ . '/database.php';
api_require_methods(['GET']);
try {
    $out=[];
    foreach (['customer'=>'totalCustomers','employee'=>'totalEmployees','product'=>'totalProducts','supplier'=>'totalSuppliers'] as $table=>$key) {
        $out[$key]=(int)$pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
    }
    $months = [];
    $currentMonth = new DateTimeImmutable('first day of this month');
    for ($offset = 11; $offset >= 0; $offset--) {
        $date = $currentMonth->modify("-$offset months");
        $months[$date->format('Y-m')] = ['label' => $date->format('M Y'), 'revenue' => 0, 'units' => 0];
    }
    $stmt = $pdo->query("SELECT r.period, r.revenue, COALESCE(u.units,0) AS units FROM
        (SELECT DATE_FORMAT(OrderDate, '%Y-%m') AS period, SUM(TotalAmount) AS revenue FROM sale_order
         WHERE OrderDate >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m-01') GROUP BY DATE_FORMAT(OrderDate, '%Y-%m')) r
        LEFT JOIN (SELECT DATE_FORMAT(o.OrderDate, '%Y-%m') AS period, SUM(i.Qty) AS units FROM sale_order o
         JOIN sale_order_item i ON i.OrderID = o.OrderID WHERE o.OrderDate >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m-01')
         GROUP BY DATE_FORMAT(o.OrderDate, '%Y-%m')) u ON u.period = r.period");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) if (isset($months[$row['period']])) {
        $months[$row['period']]['revenue'] = (float)$row['revenue'];
        $months[$row['period']]['units'] = (int)$row['units'];
    }
    $days = [];
    for ($offset = 29; $offset >= 0; $offset--) {
        $date = new DateTimeImmutable("-$offset days");
        $days[$date->format('Y-m-d')] = ['label' => $date->format('M j'), 'revenue' => 0, 'units' => 0];
    }
    $stmt = $pdo->query("SELECT r.period, r.revenue, COALESCE(u.units,0) AS units FROM
        (SELECT DATE(OrderDate) AS period, SUM(TotalAmount) AS revenue FROM sale_order
         WHERE OrderDate >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) GROUP BY DATE(OrderDate)) r
        LEFT JOIN (SELECT DATE(o.OrderDate) AS period, SUM(i.Qty) AS units FROM sale_order o
         JOIN sale_order_item i ON i.OrderID = o.OrderID WHERE o.OrderDate >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
         GROUP BY DATE(o.OrderDate)) u ON u.period = r.period");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) if (isset($days[$row['period']])) {
        $days[$row['period']]['revenue'] = (float)$row['revenue'];
        $days[$row['period']]['units'] = (int)$row['units'];
    }
    foreach (['monthly' => $months, 'daily' => $days] as $key => $series) {
        $out['salesSeries'][$key] = [
            'labels' => array_column(array_values($series), 'label'),
            'revenue' => array_column(array_values($series), 'revenue'),
            'units' => array_column(array_values($series), 'units'),
        ];
    }
    api_json($out);
} catch (PDOException $e) { error_log('Dashboard query failed: '.$e->getMessage()); api_json(['error'=>'Could not load dashboard data.'],500); }
