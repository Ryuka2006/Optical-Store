<?php
require_once __DIR__ . '/guard.php';
api_security_headers();
api_require_methods(['GET']);
require_login();
require_once __DIR__ . '/database.php';

try {
    $sql = 'SELECT p.PaymentID, p.OrderID, p.CashierID, p.PaymentDate, p.Method, p.Status,
                   p.ReferenceNo, p.Amount, c.FullName AS CustomerName
              FROM payment p
              LEFT JOIN sale_order o ON o.OrderID = p.OrderID
              LEFT JOIN customer c ON c.CustomerID = o.CustomerID
             ORDER BY p.PaymentDate DESC, p.PaymentID DESC';
    api_json($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC));
} catch (PDOException $error) {
    error_log('Payments API error: ' . $error->getMessage());
    api_json(['error' => 'Could not load payment history.'], 500);
}
