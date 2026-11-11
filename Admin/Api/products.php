<?php
require_once __DIR__ . '/guard.php';
api_security_headers();
api_require_methods(['GET', 'POST', 'PUT', 'DELETE']);
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/crud.php';

crud_run([
    'table' => 'product', 'alias' => 'p', 'pk' => 'ProductID', 'order' => 'p.ProductName',
    'select' => 'SELECT p.*, b.BrandName, s.SupplierName FROM product p LEFT JOIN brand b ON b.BrandID = p.BrandID LEFT JOIN supplier s ON s.SupplierID = p.SupplierID',
    'beforeDelete' => function (int $id, PDO $pdo): ?string {
        $stmt = $pdo->prepare('SELECT (SELECT COUNT(*) FROM sale_order_item WHERE ProductID = :saleId) + (SELECT COUNT(*) FROM inventory WHERE ProductID = :inventoryId)');
        $stmt->execute([':saleId' => $id, ':inventoryId' => $id]);
        return (int)$stmt->fetchColumn() > 0 ? 'This product has sales or inventory history. Mark it inactive instead of deleting it.' : null;
    },
    'fields' => [
        'ProductName' => ['type' => 'string', 'required' => true, 'max' => 150, 'label' => 'Product name'],
        'UnitPrice' => ['type' => 'decimal', 'required' => true, 'label' => 'Selling price'],
        'CostPrice' => ['type' => 'decimal', 'required' => true, 'label' => 'Cost price'],
        'ProductType' => ['type' => 'string', 'max' => 80],
        'Status' => ['type' => 'string', 'default' => 'Active', 'max' => 30],
        'BrandID' => ['type' => 'int'],
        'SupplierID' => ['type' => 'int'],
        'SKU' => ['type' => 'string', 'max' => 100],
        'StockQTy' => ['type' => 'int', 'default' => 0, 'label' => 'Opening stock'],
        'ExpiryDate' => ['type' => 'date'],
        'Img' => ['type' => 'string', 'max' => 500, 'label' => 'Image URL'],
    ],
]);
