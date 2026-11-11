<?php
require_once __DIR__ . '/database.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = input();
$fields = [
    'customerId' => 'CustomerID', 'cusid' => 'CustomerID',
    'salesStaffId' => 'SalesStaffID', 'saleid' => 'SalesStaffID',
    'status' => 'Status', 'subTotal' => 'SubTotal', 'subtotal' => 'SubTotal',
    'discount' => 'Discount', 'totalAmount' => 'TotalAmount', 'totalant' => 'TotalAmount',
    'orderDate' => 'OrderDate', 'odate' => 'OrderDate',
];

if ($method === 'GET') {
    if (!empty($_GET['id'])) {
        $row = fetchOne($pdo, 'SELECT * FROM sale_order WHERE OrderID=:id', [':id' => (int)$_GET['id']]);
        if (!$row) fail('Sales order not found', 404);
        respond($row);
    }
    respond(fetchAllRows($pdo, 'SELECT * FROM sale_order ORDER BY OrderID'));
}

if ($method === 'POST') {
    $customer = (int)($data['customerId'] ?? $data['cusid'] ?? 0);
    if (!$customer) fail('Customer id is required');
    $subtotal = (float)($data['subTotal'] ?? $data['subtotal'] ?? 0);
    $discount = (float)($data['discount'] ?? 0);
    $total = (float)($data['totalAmount'] ?? $data['totalant'] ?? max(0, $subtotal - $discount));
    if ($subtotal < 0 || $discount < 0 || $total < 0) fail('Order totals must not be negative');
    $statement = $pdo->prepare('INSERT INTO sale_order(CustomerID,SalesStaffID,Status,SubTotal,Discount,TotalAmount,OrderDate) VALUES(:customer,:staff,:status,:subtotal,:discount,:total,:date)');
    $statement->execute([
        ':customer' => $customer ?: null,
        ':staff' => ($data['salesStaffId'] ?? $data['saleid'] ?? $_SESSION['employee_id'] ?? null) ?: null,
        ':status' => $data['status'] ?? 'Pending',
        ':subtotal' => $subtotal, ':discount' => $discount, ':total' => $total,
        ':date' => ($data['orderDate'] ?? $data['odate'] ?? null) ?: date('Y-m-d H:i:s'),
    ]);
    $id = (int)$pdo->lastInsertId();
    respond(fetchOne($pdo, 'SELECT * FROM sale_order WHERE OrderID=:id', [':id' => $id]), 201);
}

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Sales order id is required');
    $changes = [];
    $params = [':id' => $id];
    foreach ($fields as $key => $column) {
        if (array_key_exists($key, $data) && !isset($changes[$column])) {
            $changes[$column] = true;
            $params[":$column"] = $data[$key] === '' ? null : $data[$key];
        }
    }
    if (!$changes) fail('No sales order fields supplied');
    foreach (['SubTotal','Discount','TotalAmount'] as $amountColumn) {
        if (isset($params[":$amountColumn"]) && (float)$params[":$amountColumn"] < 0) {
            fail('Order totals must not be negative');
        }
    }
    $sets = array_map(fn($column) => "`$column`=:$column", array_keys($changes));
    $statement = $pdo->prepare('UPDATE sale_order SET ' . implode(',', $sets) . ' WHERE OrderID=:id');
    $statement->execute($params);
    $row = fetchOne($pdo, 'SELECT * FROM sale_order WHERE OrderID=:id', [':id' => $id]);
    if (!$row) fail('Sales order not found', 404);
    respond($row);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Sales order id is required');
    $statement = $pdo->prepare('DELETE FROM sale_order WHERE OrderID=:id');
    $statement->execute([':id' => $id]);
    respond(['deleted' => $statement->rowCount()]);
}

fail('Method not allowed', 405);
