<?php
require_once __DIR__ . '/database.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = input();

if ($method === 'GET') {
    if (!empty($_GET['id'])) {
        $row = fetchOne($pdo, 'SELECT * FROM sale_order_item WHERE OrderItemID=:id', [':id' => (int)$_GET['id']]);
        if (!$row) fail('Order item not found', 404);
        respond($row);
    }

    if (!empty($_GET['orderId'])) {
        respond(fetchAllRows($pdo, 'SELECT * FROM sale_order_item WHERE OrderID=:id ORDER BY OrderItemID', [':id' => (int)$_GET['orderId']]));
    }
    respond(fetchAllRows($pdo, 'SELECT * FROM sale_order_item ORDER BY OrderItemID'));
}

if ($method === 'POST') {
    $order = (int)($data['orderId'] ?? $data['orderid'] ?? 0);
    $product = (int)($data['productId'] ?? $data['proid'] ?? 0);
    $quantity = (int)($data['qty'] ?? 0);
    $price = (float)($data['unitPrice'] ?? $data['uprice'] ?? 0);
    $discount = (float)($data['discount'] ?? 0);
    if (!$order || !$product || $quantity < 1 || $price < 0 || $discount < 0) fail('Order, product, quantity, and valid pricing are required');
    $statement = $pdo->prepare('INSERT INTO sale_order_item(OrderID,ProductID,Qty,UnitPrice,Discount) VALUES(:order,:product,:qty,:price,:discount)');
    $statement->execute([':order' => $order, ':product' => $product, ':qty' => $quantity, ':price' => $price, ':discount' => $discount]);
    $id = (int)$pdo->lastInsertId();
    respond(fetchOne($pdo, 'SELECT * FROM sale_order_item WHERE OrderItemID=:id', [':id' => $id]), 201);
}

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Order item id is required');
    $map = [
        'orderId' => 'OrderID', 'orderid' => 'OrderID',
        'productId' => 'ProductID', 'proid' => 'ProductID',
        'qty' => 'Qty', 'unitPrice' => 'UnitPrice', 'uprice' => 'UnitPrice',
        'discount' => 'Discount',
    ];
    $changes = [];
    $params = [':id' => $id];
    foreach ($map as $key => $column) {
        if (array_key_exists($key, $data) && !isset($changes[$column])) {
            $changes[$column] = true;
            $params[":$column"] = $data[$key];
        }
    }
    if (!$changes) fail('No order item fields supplied');
    if (isset($params[':Qty']) && (int)$params[':Qty'] < 1) fail('Quantity must be at least one');
    if (isset($params[':UnitPrice']) && (float)$params[':UnitPrice'] < 0) fail('Unit price must not be negative');
    if (isset($params[':Discount']) && (float)$params[':Discount'] < 0) fail('Discount must not be negative');
    $sets = array_map(fn($column) => "`$column`=:$column", array_keys($changes));
    $statement = $pdo->prepare('UPDATE sale_order_item SET ' . implode(',', $sets) . ' WHERE OrderItemID=:id');
    $statement->execute($params);
    $row = fetchOne($pdo, 'SELECT * FROM sale_order_item WHERE OrderItemID=:id', [':id' => $id]);
    if (!$row) fail('Order item not found', 404);
    respond($row);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Order item id is required');
    $statement = $pdo->prepare('DELETE FROM sale_order_item WHERE OrderItemID=:id');
    $statement->execute([':id' => $id]);
    respond(['deleted' => $statement->rowCount()]);
}

fail('Method not allowed', 405);
