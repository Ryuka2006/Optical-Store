<?php
require_once __DIR__ . '/database.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = input();
$fields = [
    'productId' => 'ProductID', 'proid' => 'ProductID',
    'employeeId' => 'EmployeeID', 'employeeid' => 'EmployeeID',
    'transactionType' => 'TransactionType', 'trantype' => 'TransactionType',
    'qty' => 'Qty', 'transactionDate' => 'TransactionDate', 'trandate' => 'TransactionDate',
];

if ($method === 'GET') {
    if (!empty($_GET['id'])) {
        $row = fetchOne($pdo, 'SELECT * FROM inventory WHERE InventoryID=:id', [':id' => (int)$_GET['id']]);
        if (!$row) fail('Inventory record not found', 404);
        respond($row);
    }
    respond(fetchAllRows($pdo, 'SELECT * FROM inventory ORDER BY InventoryID'));
}

if ($method === 'POST') {
    $product = (int)($data['productId'] ?? $data['proid'] ?? 0);
    $type = trim((string)($data['transactionType'] ?? $data['trantype'] ?? ''));
    if (!$product || $type === '' || !isset($data['qty'])) fail('Product, transaction type, and quantity are required');
    $statement = $pdo->prepare('INSERT INTO inventory(ProductID,EmployeeID,TransactionType,Qty,TransactionDate) VALUES(:product,:employee,:type,:qty,:date)');
    $statement->execute([
        ':product' => $product,
        ':employee' => ($data['employeeId'] ?? $data['employeeid'] ?? null) ?: null,
        ':type' => $type, ':qty' => (int)$data['qty'],
        ':date' => ($data['transactionDate'] ?? $data['trandate'] ?? null) ?: date('Y-m-d H:i:s'),
    ]);
    $id = (int)$pdo->lastInsertId();
    respond(fetchOne($pdo, 'SELECT * FROM inventory WHERE InventoryID=:id', [':id' => $id]), 201);
}

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Inventory record id is required');
    $changes = [];
    $params = [':id' => $id];
    foreach ($fields as $key => $column) {
        if (array_key_exists($key, $data) && !isset($changes[$column])) {
            $changes[$column] = true;
            $params[":$column"] = $data[$key] === '' ? null : $data[$key];
        }
    }
    if (!$changes) fail('No inventory fields supplied');
    $sets = array_map(fn($column) => "`$column`=:$column", array_keys($changes));
    $statement = $pdo->prepare('UPDATE inventory SET ' . implode(',', $sets) . ' WHERE InventoryID=:id');
    $statement->execute($params);
    $row = fetchOne($pdo, 'SELECT * FROM inventory WHERE InventoryID=:id', [':id' => $id]);
    if (!$row) fail('Inventory record not found', 404);
    respond($row);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Inventory record id is required');
    $statement = $pdo->prepare('DELETE FROM inventory WHERE InventoryID=:id');
    $statement->execute([':id' => $id]);
    respond(['deleted' => $statement->rowCount()]);
}

fail('Method not allowed', 405);
