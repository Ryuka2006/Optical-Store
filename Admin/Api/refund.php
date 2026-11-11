<?php
declare(strict_types=1);
require_once __DIR__ . '/guard.php';
api_security_headers();
api_require_methods(['GET', 'POST', 'PUT']);
require_login();
require_once __DIR__ . '/database.php';

function refund_list(PDO $pdo): array {
    $stmt = $pdo->query('SELECT r.RefundID, r.PaymentID, r.CashierID, r.RefundDate, r.Status, r.Amount,
                                p.OrderID, p.Method, p.Amount AS PaymentAmount,
                                c.FullName AS CustomerName, e.FullName AS CashierName
                           FROM refund r JOIN payment p ON p.PaymentID = r.PaymentID
                           LEFT JOIN sale_order o ON o.OrderID = p.OrderID
                           LEFT JOIN customer c ON c.CustomerID = o.CustomerID
                           LEFT JOIN employee e ON e.EmployeeID = r.CashierID
                          ORDER BY r.RefundDate DESC, r.RefundID DESC');
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') api_json(refund_list($pdo));
    $input = api_read_input();

    if ($method === 'POST') {
        $paymentId = $input['PaymentID'] ?? '';
        $amount = $input['Amount'] ?? '';
        if (!is_scalar($paymentId) || !ctype_digit((string)$paymentId) || (int)$paymentId < 1) api_json(['error' => 'Select a valid payment.'], 422);
        if (!is_numeric($amount) || (float)$amount <= 0) api_json(['error' => 'Refund amount must be greater than zero.'], 422);
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT Amount, Status FROM payment WHERE PaymentID = :id FOR UPDATE');
        $stmt->execute([':id' => (int)$paymentId]);
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$payment || !in_array((string)$payment['Status'], ['Completed', 'Paid', 'Partial Refund'], true)) {
            $pdo->rollBack(); api_json(['error' => 'This payment is not eligible for a refund.'], 409);
        }
        $sum = $pdo->prepare("SELECT COALESCE(SUM(Amount), 0) FROM refund WHERE PaymentID = :id AND Status IN ('Approved','Completed')");
        $sum->execute([':id' => (int)$paymentId]);
        $remaining = (float)$payment['Amount'] - (float)$sum->fetchColumn();
        if ((float)$amount > $remaining) { $pdo->rollBack(); api_json(['error' => 'Refund amount exceeds the remaining refundable balance.'], 422); }
        $staffQuery = $pdo->prepare('SELECT EmployeeID FROM `user` WHERE UserID = :id');
        $staffQuery->execute([':id' => (int)$_SESSION['user_id']]);
        $staffId = $staffQuery->fetchColumn();
        $stmt = $pdo->prepare("INSERT INTO refund (PaymentID, CashierID, RefundDate, Status, Amount) VALUES (:payment, :cashier, NOW(), 'Pending', :amount)");
        $stmt->execute([':payment' => (int)$paymentId, ':cashier' => $staffId ?: null, ':amount' => (float)$amount]);
        $id = (int)$pdo->lastInsertId();
        $pdo->commit();
        api_json(['message' => 'Refund request submitted.', 'RefundID' => $id], 201);
    }

    require_admin();
    $refundId = $input['RefundID'] ?? '';
    $status = $input['Status'] ?? '';
    if (!is_scalar($refundId) || !ctype_digit((string)$refundId) || !in_array($status, ['Approved', 'Rejected'], true)) {
        api_json(['error' => 'A valid refund and decision are required.'], 422);
    }
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT PaymentID, Amount, Status FROM refund WHERE RefundID = :id FOR UPDATE');
    $stmt->execute([':id' => (int)$refundId]);
    $refund = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$refund) { $pdo->rollBack(); api_json(['error' => 'Refund request not found.'], 404); }
    if ($refund['Status'] !== 'Pending') { $pdo->rollBack(); api_json(['error' => 'Only pending refund requests can be reviewed.'], 409); }
    $staffQuery = $pdo->prepare('SELECT EmployeeID FROM `user` WHERE UserID = :id');
    $staffQuery->execute([':id' => (int)$_SESSION['user_id']]);
    $staffId = $staffQuery->fetchColumn();
    $stmt = $pdo->prepare('UPDATE refund SET Status = :status, CashierID = :cashier WHERE RefundID = :id');
    $stmt->execute([':status' => $status, ':cashier' => $staffId ?: null, ':id' => (int)$refundId]);
    if ($status === 'Approved') {
        $sum = $pdo->prepare("SELECT COALESCE(SUM(Amount), 0) FROM refund WHERE PaymentID = :id AND Status IN ('Approved','Completed')");
        $sum->execute([':id' => (int)$refund['PaymentID']]);
        $paid = $pdo->prepare('SELECT Amount FROM payment WHERE PaymentID = :id');
        $paid->execute([':id' => (int)$refund['PaymentID']]);
        $paymentStatus = (float)$sum->fetchColumn() >= (float)$paid->fetchColumn() ? 'Refunded' : 'Partial Refund';
        $update = $pdo->prepare('UPDATE payment SET Status = :status WHERE PaymentID = :id');
        $update->execute([':status' => $paymentStatus, ':id' => (int)$refund['PaymentID']]);
    }
    $pdo->commit();
    api_json(['message' => 'Refund ' . strtolower($status) . '.']);
} catch (PDOException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Refund API database error: ' . $error->getMessage());
    api_json(['error' => 'Could not complete the refund request.'], 500);
}
