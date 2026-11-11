<?php
require_once __DIR__ . '/guard.php';
api_security_headers();
api_require_methods(['GET']);
require_login();
require_once __DIR__ . '/database.php';

try {
    $report = (string)($_GET['id'] ?? '');
    if ($report === 'best-sellers') {
        $stmt = $pdo->query('SELECT p.ProductID, p.ProductName, p.SKU, SUM(i.Qty) AS UnitsSold,
                                    SUM(i.Qty * i.UnitPrice) AS Revenue
                               FROM sale_order_item i JOIN product p ON p.ProductID = i.ProductID
                              GROUP BY p.ProductID, p.ProductName, p.SKU
                              ORDER BY UnitsSold DESC, p.ProductName LIMIT 100');
        api_json($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    api_json(['error' => 'Unknown report.'], 404);
} catch (PDOException $error) {
    error_log('Reports API database error: ' . $error->getMessage());
    api_json(['error' => 'Could not load report data.'], 500);
}
