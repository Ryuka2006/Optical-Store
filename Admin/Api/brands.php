<?php
require_once __DIR__ . '/guard.php';
api_security_headers();
api_require_methods(['GET', 'POST', 'PUT', 'DELETE']);
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/crud.php';

crud_run([
    'table' => 'brand', 'alias' => 'b', 'pk' => 'BrandID', 'order' => 'b.BrandName',
    'select' => 'SELECT b.*, (SELECT COUNT(*) FROM product p WHERE p.BrandID = b.BrandID) AS ProductCount FROM brand b',
    'beforeDelete' => function (int $id, PDO $pdo): ?string {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM product WHERE BrandID = :id');
        $stmt->execute([':id' => $id]);
        return (int)$stmt->fetchColumn() > 0 ? 'This brand is assigned to products. Reassign those products before deleting it.' : null;
    },
    'fields' => [
        'BrandName' => ['type' => 'string', 'required' => true, 'max' => 100, 'label' => 'Brand name'],
        'Description' => ['type' => 'string', 'max' => 500, 'label' => 'Description'],
    ],
]);
