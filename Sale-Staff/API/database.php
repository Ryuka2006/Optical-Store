<?php
require_once __DIR__ . '/../../Admin/Api/guard.php';
api_security_headers();
require_role('Sales Staff');

                                                                                  
date_default_timezone_set('Asia/Phnom_Penh');
require_once __DIR__ . '/../../Admin/Api/database.php';

function input(): array {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    if (is_array($json)) return $json;
    if (!empty($_POST)) return $_POST;
    parse_str($raw, $out);
    return $out ?: [];
}

function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function fail(string $message, int $code = 400): void {
    respond(['error' => $message], $code);
}

function fetchOne(PDO $pdo, string $sql, array $params = []) {
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->fetch();
}

function fetchAllRows(PDO $pdo, string $sql, array $params = []): array {
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->fetchAll();
}

function hasColumn(PDO $pdo, string $table, string $column): bool {
    $statement = $pdo->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=:table AND COLUMN_NAME=:column LIMIT 1');
    $statement->execute([':table' => $table, ':column' => $column]);
    return (bool)$statement->fetchColumn();
}
