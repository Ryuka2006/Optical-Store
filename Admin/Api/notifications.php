<?php
require_once __DIR__ . '/guard.php';
api_security_headers();
require_once __DIR__ . '/database.php';
require_login();
api_require_methods(['GET', 'PUT']);

try {
    $items = [];
    $today = date('Y-m-d');
    $hasStoredNotifications = (bool)$pdo->query("SHOW TABLES LIKE 'notification'")->fetchColumn();
    if ($hasStoredNotifications) {
        $stored = $pdo->query('SELECT NotificationID, Title, Message, IsRead, CreatedAt FROM notification ORDER BY CreatedAt DESC LIMIT 100');
        foreach ($stored->fetchAll(PDO::FETCH_ASSOC) as $row) $items[] = [
            'id' => 'db-' . $row['NotificationID'], 'type' => 'stored', 'title' => $row['Title'],
            'message' => $row['Message'] ?: '', 'createdAt' => $row['CreatedAt'], 'read' => (bool)$row['IsRead']
        ];
    }
    $stmt = $pdo->prepare("SELECT a.AppointmentID, a.AppointmentDate, a.AppointmentTime, a.Status,
            c.FullName AS CustomerName
        FROM appointment a LEFT JOIN customer c ON c.CustomerID = a.CustomerID
        WHERE a.Status IN ('Scheduled','Confirmed') AND a.AppointmentDate BETWEEN :today AND DATE_ADD(:today2, INTERVAL 7 DAY)
        ORDER BY a.AppointmentDate, a.AppointmentTime LIMIT 30");
    $stmt->execute([':today' => $today, ':today2' => $today]);
    foreach ($stmt->fetchAll() as $row) $items[] = [
        'id' => 'appointment-' . $row['AppointmentID'], 'type' => 'appointment', 'title' => 'Upcoming appointment',
        'message' => ($row['CustomerName'] ?: 'Customer') . ' · ' . $row['AppointmentDate'] . ' ' . substr((string)$row['AppointmentTime'], 0, 5), 'createdAt' => $row['AppointmentDate']
    ];

    $stmt = $pdo->query("SELECT ProductID, ProductName, StockQTy FROM product WHERE StockQTy <= 5 ORDER BY StockQTy, ProductName LIMIT 30");
    foreach ($stmt->fetchAll() as $row) $items[] = [
        'id' => 'stock-' . $row['ProductID'], 'type' => 'stock', 'title' => ((int)$row['StockQTy'] <= 0 ? 'Product out of stock' : 'Low product stock'),
        'message' => $row['ProductName'] . ' · ' . (int)$row['StockQTy'] . ' remaining', 'createdAt' => $today
    ];

    $stmt = $pdo->query("SELECT r.RefundID, r.Amount, r.RefundDate, p.ReferenceNo
        FROM refund r LEFT JOIN payment p ON p.PaymentID = r.PaymentID
        WHERE r.Status = 'Pending' ORDER BY r.RefundDate DESC LIMIT 30");
    foreach ($stmt->fetchAll() as $row) $items[] = [
        'id' => 'refund-' . $row['RefundID'], 'type' => 'refund', 'title' => 'Refund request pending',
        'message' => 'Payment ' . ($row['ReferenceNo'] ?: 'ID ' . $row['RefundID']) . ' · ' . number_format((float)$row['Amount'], 2), 'createdAt' => $row['RefundDate']
    ];

    usort($items, static fn($a, $b) => strcmp((string)$b['createdAt'], (string)$a['createdAt']));
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'PUT') {
        $input = api_read_input();
        $read = $_SESSION['read_notifications'] ?? [];
        if (!empty($input['all'])) {
            $read = array_values(array_unique(array_merge($read, array_column($items, 'id'))));
            if ($hasStoredNotifications) $pdo->exec('UPDATE notification SET IsRead = 1');
        } elseif (!empty($input['id'])) {
            $read[] = (string)$input['id'];
            if ($hasStoredNotifications && preg_match('/^db-(\d+)$/', (string)$input['id'], $match)) {
                $mark = $pdo->prepare('UPDATE notification SET IsRead = 1 WHERE NotificationID = :id');
                $mark->execute([':id' => (int)$match[1]]);
            }
        }
        $_SESSION['read_notifications'] = array_slice(array_values(array_unique($read)), -500);
    }
    $read = array_flip($_SESSION['read_notifications'] ?? []);
    foreach ($items as &$item) $item['read'] = ($item['read'] ?? false) || isset($read[$item['id']]);
    unset($item);
    api_json(['success' => true, 'notifications' => $items]);
} catch (PDOException $e) {
    error_log('Notifications API error: ' . $e->getMessage());
    api_json(['error' => 'Could not load notifications.'], 500);
}
