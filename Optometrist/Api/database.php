<?php
require_once __DIR__ . '/../../Admin/Api/guard.php';
api_security_headers();
require_role('Optometrist');

                                                                              
date_default_timezone_set('Asia/Phnom_Penh');
require_once __DIR__ . '/../../Admin/Api/database.php';

                                   

                                                                        
function input(): array {
    $raw  = file_get_contents('php://input');
    $json = json_decode($raw, true);
    if (is_array($json)) return $json;
    if (!empty($_POST)) return $_POST;
    parse_str($raw, $out);
    return $out ?: [];
}

                                                        
function pick(array $data, string $key, $default = null) {
    if (!isset($data[$key])) return $default;
    $v = $data[$key];
    if (is_string($v)) $v = trim($v);
    return $v === '' ? $default : $v;
}

function respond($data, int $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function fail(string $msg, int $code = 400) { respond(['error' => $msg], $code); }

function respondRow($row, int $code = 200) {
    if (!$row) fail('Record not found', 404);
    respond($row, $code);
}

function requireId(array $data): int {
    $id = $_GET['id'] ?? $data['id'] ?? null;
    if (!$id) fail('Missing id');
    return (int)$id;
}

function fetchOne(PDO $pdo, string $sql, array $p = []) {
    $s = $pdo->prepare($sql); $s->execute($p); return $s->fetch();
}

function fetchAllRows(PDO $pdo, string $sql, array $p = []): array {
    $s = $pdo->prepare($sql); $s->execute($p); return $s->fetchAll();
}

                                         
function insertRow(PDO $pdo, string $table, array $cols, array $data): int {
    $f = []; $ph = []; $p = [];
    foreach ($cols as $k => $col) {
        $f[] = "`$col`"; $ph[] = ":$k"; $p[":$k"] = pick($data, $k);
    }
    $pdo->prepare("INSERT INTO `$table` (" . implode(',', $f) . ") VALUES (" . implode(',', $ph) . ")")->execute($p);
    return (int)$pdo->lastInsertId();
}

                                                  
function updateFields(PDO $pdo, string $table, string $pk, int $id, array $map, array $data): void {
    $sets = []; $p = [':__id' => $id];
    foreach ($map as $k => $col) {
        if (array_key_exists($k, $data)) {
            $sets[] = "`$col`=:$k";
            $v = $data[$k];
            $p[":$k"] = (is_string($v) && trim($v) === '') ? null : $v;
        }
    }
    if (!$sets) return;
    $pdo->prepare("UPDATE `$table` SET " . implode(', ', $sets) . " WHERE `$pk`=:__id")->execute($p);
}

                                                                           
function findOrCreateCustomer(PDO $pdo, array $d): int {
    if (!empty($d['cusid'])) return (int)$d['cusid'];
    $name = trim($d['patient'] ?? '');
    if ($name === '') fail('Patient is required');
    $id = fetchOne($pdo, 'SELECT CustomerID FROM customer WHERE FullName=:n LIMIT 1', [':n' => $name]);
    if ($id) return (int)$id['CustomerID'];
    $pdo->prepare('INSERT INTO customer (FullName, RegisterationDate) VALUES (:n, :d)')
        ->execute([':n' => $name, ':d' => date('Y-m-d')]);
    return (int)$pdo->lastInsertId();
}

function currentEmployeeId(PDO $pdo): ?int {
    $userId = (int)($_SESSION['user_id'] ?? 0);
    if (!$userId) return null;
    $row = fetchOne($pdo, "SELECT u.EmployeeID FROM `user` u JOIN role r ON r.RoleID=u.RoleID WHERE u.UserID=:id AND LOWER(r.RoleName)='optometrist'", [':id' => $userId]);
    return $row && $row['EmployeeID'] !== null ? (int)$row['EmployeeID'] : null;
}
