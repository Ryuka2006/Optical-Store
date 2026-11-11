<?php
require_once __DIR__ . '/guard.php';
api_security_headers();
api_require_methods(['GET', 'POST', 'PUT', 'DELETE']);
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/crud.php';

crud_run([
    'table' => 'supplier', 'alias' => 's', 'pk' => 'SupplierID', 'order' => 's.SupplierName',
    'select' => 'SELECT s.* FROM supplier s',
    'beforeDelete' => function (int $id, PDO $pdo): ?string {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM product WHERE SupplierID = :id');
        $stmt->execute([':id' => $id]);
        return (int)$stmt->fetchColumn() > 0 ? 'This supplier is assigned to products. Reassign those products before deleting it.' : null;
    },
    'fields' => [
        'SupplierName' => ['type' => 'string', 'required' => true, 'max' => 150, 'label' => 'Supplier name'],
        'ContactPerson' => ['type' => 'string', 'max' => 150, 'label' => 'Contact person'],
        'Phone' => ['type' => 'string', 'max' => 30],
        'Email' => ['type' => 'email', 'max' => 150],
        'Address' => ['type' => 'string', 'max' => 255],
    ],
]);
