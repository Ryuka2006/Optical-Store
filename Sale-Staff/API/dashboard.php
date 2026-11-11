<?php
require_once __DIR__ . '/database.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') fail('Method not allowed', 405);

$summary = fetchOne($pdo, "SELECT
    (SELECT COUNT(*) FROM customer) AS customers,
    (SELECT COUNT(*) FROM product WHERE Status IS NULL OR Status='Active') AS products,
    (SELECT COUNT(*) FROM sale_order WHERE COALESCE(Status,'') NOT IN ('Completed','Cancelled')) AS activeOrders,
    (SELECT COUNT(*) FROM appointment WHERE Status IN ('Scheduled','Confirmed') AND TIMESTAMP(AppointmentDate,AppointmentTime)>=NOW()) AS pendingAppointments");
$recentOrders = fetchAllRows($pdo, 'SELECT o.OrderID AS id,o.OrderDate AS date,o.Status AS status,c.FullName AS customer FROM sale_order o LEFT JOIN customer c ON c.CustomerID=o.CustomerID ORDER BY o.OrderDate DESC,o.OrderID DESC LIMIT 5');

respond(['summary' => $summary, 'recentOrders' => $recentOrders]);
