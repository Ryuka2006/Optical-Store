<?php
require_once __DIR__ . '/database.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = input();
$fields = [
    'name' => 'ProductName', 'proname' => 'ProductName',
    'unitPrice' => 'UnitPrice', 'uprice' => 'UnitPrice',
    'costPrice' => 'CostPrice', 'cprice' => 'CostPrice',
    'productType' => 'ProductType', 'protype' => 'ProductType',
    'status' => 'Status', 'brandId' => 'BrandID', 'bid' => 'BrandID',
    'supplierId' => 'SupplierID', 'supid' => 'SupplierID',
    'sku' => 'SKU', 'stockQty' => 'StockQTy', 'sqty' => 'StockQTy',
    'expiryDate' => 'ExpiryDate', 'exdate' => 'ExpiryDate', 'image' => 'Img', 'img' => 'Img',
];

if ($method === 'GET') {
    if (!empty($_GET['id'])) {
        $row = fetchOne($pdo, 'SELECT * FROM product WHERE ProductID=:id', [':id' => (int)$_GET['id']]);
        if (!$row) fail('Product not found', 404);
        respond($row);
    }
    respond(fetchAllRows($pdo, 'SELECT * FROM product ORDER BY ProductID'));
}

if ($method === 'POST') {
    $name = trim((string)($data['name'] ?? $data['proname'] ?? $data['ProductName'] ?? ''));
    if ($name === '') fail('Product name is required');
    $price = (float)($data['unitPrice'] ?? $data['uprice'] ?? 0);
    $cost = (float)($data['costPrice'] ?? $data['cprice'] ?? 0);
    $stock = (int)($data['stockQty'] ?? $data['sqty'] ?? 0);
    if ($price < 0 || $cost < 0 || $stock < 0) fail('Price, cost, and stock must not be negative');
    $statement = $pdo->prepare('INSERT INTO product(ProductName,UnitPrice,CostPrice,ProductType,Status,BrandID,SupplierID,SKU,StockQTy,ExpiryDate,Img) VALUES(:name,:price,:cost,:type,:status,:brand,:supplier,:sku,:stock,:expiry,:image)');
    $statement->execute([
        ':name' => $name, ':price' => $price, ':cost' => $cost,
        ':type' => $data['productType'] ?? $data['protype'] ?? null,
        ':status' => $data['status'] ?? 'Active',
        ':brand' => ($data['brandId'] ?? $data['bid'] ?? null) ?: null,
        ':supplier' => ($data['supplierId'] ?? $data['supid'] ?? null) ?: null,
        ':sku' => $data['sku'] ?? null, ':stock' => $stock,
        ':expiry' => ($data['expiryDate'] ?? $data['exdate'] ?? null) ?: null,
        ':image' => $data['image'] ?? $data['img'] ?? null,
    ]);
    $id = (int)$pdo->lastInsertId();
    respond(fetchOne($pdo, 'SELECT * FROM product WHERE ProductID=:id', [':id' => $id]), 201);
}

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Product id is required');
    $changes = [];
    $params = [':id' => $id];
    foreach ($fields as $key => $column) {
        if (array_key_exists($key, $data) && !isset($changes[$column])) {
            $changes[$column] = true;
            $params[":$column"] = $data[$key] === '' ? null : $data[$key];
        }
    }
    if (!$changes) fail('No product fields supplied');
    if (isset($params[':UnitPrice']) && (float)$params[':UnitPrice'] < 0) fail('Price must not be negative');
    if (isset($params[':CostPrice']) && (float)$params[':CostPrice'] < 0) fail('Cost must not be negative');
    if (isset($params[':StockQTy']) && (int)$params[':StockQTy'] < 0) fail('Stock must not be negative');
    $sets = array_map(fn($column) => "`$column`=:$column", array_keys($changes));
    $statement = $pdo->prepare('UPDATE product SET ' . implode(',', $sets) . ' WHERE ProductID=:id');
    $statement->execute($params);
    $row = fetchOne($pdo, 'SELECT * FROM product WHERE ProductID=:id', [':id' => $id]);
    if (!$row) fail('Product not found', 404);
    respond($row);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Product id is required');
    $statement = $pdo->prepare('DELETE FROM product WHERE ProductID=:id');
    $statement->execute([':id' => $id]);
    respond(['deleted' => $statement->rowCount()]);
}

fail('Method not allowed', 405);
