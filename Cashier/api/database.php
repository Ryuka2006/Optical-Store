<?php
require_once __DIR__ . '/../../Admin/Api/guard.php';
api_security_headers();
require_role('Cashier');

date_default_timezone_set('Asia/Phnom_Penh');
require_once __DIR__ . '/../../Admin/Api/database.php';

function cashier_input(): array {
    return api_read_input();
}
function cashier_fetch_one(PDO $pdo, string $sql, array $params = []) {
    $stmt = $pdo->prepare($sql); $stmt->execute($params); $row = $stmt->fetch(); return $row ?: null;
}
function cashier_fetch_all(PDO $pdo, string $sql, array $params = []): array {
    $stmt = $pdo->prepare($sql); $stmt->execute($params); return $stmt->fetchAll();
}
