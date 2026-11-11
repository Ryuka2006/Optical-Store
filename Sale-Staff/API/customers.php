<?php
require_once __DIR__ . '/database.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = input();
$select = "SELECT c.CustomerID,c.FullName,c.Gender,c.DateOfBirth,c.Phone,c.Email,c.RegisterationDate,
                  c.Address,NULL AS MedicalHistory,TIMESTAMPDIFF(YEAR,c.DateOfBirth,CURDATE()) AS Age,
                  (SELECT MAX(e.ExaminationDate) FROM eye_examination e WHERE e.CustomerID=c.CustomerID) AS LastVisit
           FROM customer c";

if ($method === 'GET') {
    if (!empty($_GET['id'])) {
        $row = fetchOne($pdo, "$select WHERE c.CustomerID=:id", [':id' => (int)$_GET['id']]);
        if (!$row) fail('Customer not found', 404);
        respond($row);
    }

    if (isset($_GET['q']) && trim($_GET['q']) !== '') {
        $term = '%' . trim($_GET['q']) . '%';
        respond(fetchAllRows($pdo, "$select WHERE c.FullName LIKE :name OR c.Phone LIKE :phone OR c.Email LIKE :email ORDER BY c.FullName", [
            ':name' => $term, ':phone' => $term, ':email' => $term,
        ]));
    }

    respond(fetchAllRows($pdo, "$select ORDER BY c.FullName"));
}

if ($method === 'POST') {
    $name = trim((string)($data['name'] ?? $data['FullName'] ?? ''));
    if ($name === '') fail('Customer name is required');
    if (array_key_exists('history', $data) && trim((string)$data['history']) !== '') {
        fail('Medical history is not available in the active customer schema', 422);
    }

    $dob = $data['dob'] ?? null;
    if (!$dob && isset($data['age']) && $data['age'] !== '') $dob = (date('Y') - (int)$data['age']) . '-01-01';
    $statement = $pdo->prepare('INSERT INTO customer(FullName,Gender,DateOfBirth,Phone,Email,RegisterationDate,Address) VALUES(:name,:gender,:dob,:phone,:email,CURDATE(),:address)');
    $statement->execute([
        ':name' => $name, ':gender' => $data['gender'] ?? null, ':dob' => $dob,
        ':phone' => $data['phone'] ?? null, ':email' => $data['email'] ?? null,
        ':address' => $data['address'] ?? null,
    ]);
    $id = (int)$pdo->lastInsertId();
    respond(fetchOne($pdo, "$select WHERE c.CustomerID=:id", [':id' => $id]), 201);
}

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Customer id is required');
    if (array_key_exists('history', $data) && trim((string)$data['history']) !== '') {
        fail('Medical history is not available in the active customer schema', 422);
    }
    $map = ['name'=>'FullName','gender'=>'Gender','dob'=>'DateOfBirth','phone'=>'Phone','email'=>'Email','address'=>'Address'];
    if (!array_key_exists('dob', $data) && array_key_exists('age', $data) && $data['age'] !== '') {
        $data['dob'] = (date('Y') - (int)$data['age']) . '-01-01';
    }
    $sets = [];
    $params = [':id' => $id];
    foreach ($map as $key => $column) {
        if (array_key_exists($key, $data)) {
            $sets[] = "`$column`=:$key";
            $params[":$key"] = $data[$key] === '' ? null : $data[$key];
        }
    }
    if (!$sets) fail('No customer fields supplied');
    $statement = $pdo->prepare('UPDATE customer SET ' . implode(',', $sets) . ' WHERE CustomerID=:id');
    $statement->execute($params);
    $row = fetchOne($pdo, "$select WHERE c.CustomerID=:id", [':id' => $id]);
    if (!$row) fail('Customer not found', 404);
    respond($row);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Customer id is required');
    $statement = $pdo->prepare('DELETE FROM customer WHERE CustomerID=:id');
    $statement->execute([':id' => $id]);
    respond(['deleted' => $statement->rowCount()]);
}

fail('Method not allowed', 405);
