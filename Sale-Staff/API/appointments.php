<?php
require_once __DIR__ . '/database.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = input();

if ($method === 'GET') {
    if (!empty($_GET['id'])) {
        $row = fetchOne($pdo, 'SELECT * FROM appointment WHERE AppointmentID=:id', [':id' => (int)$_GET['id']]);
        if (!$row) fail('Appointment not found', 404);
        respond($row);
    }
    respond(fetchAllRows($pdo, 'SELECT * FROM appointment ORDER BY AppointmentDate,AppointmentTime'));
}

if ($method === 'POST') {
    $customer = (int)($data['customer'] ?? $data['cusid'] ?? 0);
    $date = trim((string)($data['date'] ?? ''));
    $time = trim((string)($data['time'] ?? ''));
    if (!$customer || $date === '' || $time === '') fail('Customer, date, and time are required');
    $doctor = (int)($data['doctor'] ?? $data['optoid'] ?? 0);
    $status = trim((string)($data['status'] ?? 'Scheduled')) ?: 'Scheduled';
    $statement = $pdo->prepare('INSERT INTO appointment(CustomerID,OptometristID,AppointmentDate,AppointmentTime,Status) VALUES(:customer,:doctor,:date,:time,:status)');
    $statement->execute([
        ':customer' => $customer, ':doctor' => $doctor ?: null, ':date' => $date,
        ':time' => $time, ':status' => $status,
    ]);
    $id = (int)$pdo->lastInsertId();
    respond(fetchOne($pdo, 'SELECT * FROM appointment WHERE AppointmentID=:id', [':id' => $id]), 201);
}

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Appointment id is required');
    $map = [
        'customer' => 'CustomerID',
        'cusid' => 'CustomerID',
        'doctor' => 'OptometristID',
        'optoid' => 'OptometristID',
        'date' => 'AppointmentDate',
        'time' => 'AppointmentTime',
        'status' => 'Status',
    ];
    $changes = [];
    $params = [':id' => $id];
    foreach ($map as $key => $column) {
        if (array_key_exists($key, $data) && !isset($changes[$column])) {
            $changes[$column] = true;
            $value = $data[$key];
            if ($column === 'OptometristID') $value = $value ? (int)$value : null;
            $params[":$column"] = $value;
        }
    }
    if (!$changes) fail('No appointment fields supplied');
    $sets = array_map(fn($column) => "`$column`=:$column", array_keys($changes));
    $statement = $pdo->prepare('UPDATE appointment SET ' . implode(',', $sets) . ' WHERE AppointmentID=:id');
    $statement->execute($params);
    $row = fetchOne($pdo, 'SELECT * FROM appointment WHERE AppointmentID=:id', [':id' => $id]);
    if (!$row) fail('Appointment not found', 404);
    respond($row);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if (!$id) fail('Appointment id is required');
    $statement = $pdo->prepare('DELETE FROM appointment WHERE AppointmentID=:id');
    $statement->execute([':id' => $id]);
    respond(['deleted' => $statement->rowCount()]);
}

fail('Method not allowed', 405);
