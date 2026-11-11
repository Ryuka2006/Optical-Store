<?php
declare(strict_types=1);
require_once __DIR__ . '/guard.php';
api_security_headers();
api_require_methods(['GET', 'POST']);
require_login();
require_once __DIR__ . '/database.php';

function inventory_rows(PDO $pdo): array {
    $stmt = $pdo->query('SELECT i.InventoryID, i.ProductID, p.ProductName, p.SKU, p.StockQTy AS CurrentStock,
                                i.EmployeeID, e.FullName AS EmployeeName, i.TransactionType, i.Qty, i.TransactionDate
                           FROM inventory i
                           JOIN product p ON p.ProductID = i.ProductID
                           LEFT JOIN employee e ON e.EmployeeID = i.EmployeeID
                          ORDER BY i.TransactionDate DESC, i.InventoryID DESC');
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') api_json(inventory_rows($pdo));

    $input = api_read_input();
    $productId = $input['ProductID'] ?? '';
    $employeeId = $input['EmployeeID'] ?? '';
    $type = trim((string)($input['TransactionType'] ?? ''));
    $rawQty = $input['Qty'] ?? '';
    if (!is_scalar($productId) || !ctype_digit((string)$productId) || (int)$productId < 1) api_json(['error' => 'Select a valid product.'], 422);
    if ($employeeId !== '' && (!is_scalar($employeeId) || !ctype_digit((string)$employeeId))) api_json(['error' => 'Select a valid employee.'], 422);
    if (!in_array($type, ['Stock In', 'Stock Out', 'Adjustment'], true)) api_json(['error' => 'Choose Stock In, Stock Out or Adjustment.'], 422);
    if (!is_scalar($rawQty) || !ctype_digit((string)$rawQty)) api_json(['error' => 'Quantity must be a whole number.'], 422);
    $qty = (int)$rawQty;
    if ($qty < 1) api_json(['error' => 'Quantity must be greater than zero.'], 422);
    if ($type === 'Adjustment' && $qty > 2147483647) api_json(['error' => 'Stock quantity is too large.'], 422);

    $pdo->beginTransaction();
    $lock = $pdo->prepare('SELECT StockQTy FROM product WHERE ProductID = :id FOR UPDATE');
    $lock->execute([':id' => (int)$productId]);
    $current = $lock->fetchColumn();
    if ($current === false) { $pdo->rollBack(); api_json(['error' => 'Product not found.'], 404); }
    $current = (int)$current;
    $delta = $type === 'Stock In' ? $qty : ($type === 'Stock Out' ? -$qty : $qty - $current);
    if ($type === 'Stock Out' && $qty > $current) { $pdo->rollBack(); api_json(['error' => 'Stock out quantity exceeds current stock.'], 422); }
    if ($type === 'Adjustment' && $delta === 0) { $pdo->rollBack(); api_json(['error' => 'The product is already at that stock level.'], 422); }
    $newStock = $current + $delta;
    if ($newStock < 0) { $pdo->rollBack(); api_json(['error' => 'Stock cannot become negative.'], 422); }

    $update = $pdo->prepare('UPDATE product SET StockQTy = :stock WHERE ProductID = :id');
    $update->execute([':stock' => $newStock, ':id' => (int)$productId]);
    $insert = $pdo->prepare('INSERT INTO inventory (ProductID, EmployeeID, TransactionType, Qty, TransactionDate)
                             VALUES (:product, :employee, :type, :qty, NOW())');
    $insert->execute([
        ':product' => (int)$productId,
        ':employee' => $employeeId === '' ? null : (int)$employeeId,
        ':type' => $type,
        ':qty' => $delta,
    ]);
    $newId = (int)$pdo->lastInsertId();
    $pdo->commit();
    $stmt = $pdo->prepare('SELECT i.InventoryID, i.ProductID, p.ProductName, p.SKU, p.StockQTy AS CurrentStock,
                                  i.EmployeeID, e.FullName AS EmployeeName, i.TransactionType, i.Qty, i.TransactionDate
                             FROM inventory i JOIN product p ON p.ProductID = i.ProductID
                             LEFT JOIN employee e ON e.EmployeeID = i.EmployeeID WHERE i.InventoryID = :id');
    $stmt->execute([':id' => $newId]);
    api_json($stmt->fetch(PDO::FETCH_ASSOC) ?: [], 201);
} catch (PDOException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Inventory API error: ' . $error->getMessage());
    api_json(['error' => 'Could not save the inventory movement. Check the product and inventory tables.'], 500);
}
