<?php
                               
require_once 'database.php';
$method = $_SERVER['REQUEST_METHOD'];
$data   = input();

$select = "SELECT c.CustomerID, c.FullName, c.Gender, c.DateOfBirth, c.Phone, c.Email,
                  c.RegisterationDate, c.Address, c.MedicalHistory,
                  TIMESTAMPDIFF(YEAR, c.DateOfBirth, CURDATE()) AS Age,
                  (SELECT MAX(e.ExaminationDate) FROM eye_examination e WHERE e.CustomerID = c.CustomerID) AS LastVisit
           FROM customer c";

$cols = [
    'name' => 'FullName', 'gender' => 'Gender', 'dob' => 'DateOfBirth', 'phone' => 'Phone',
    'email' => 'Email', 'rgdate' => 'RegisterationDate', 'address' => 'Address', 'history' => 'MedicalHistory',
];

function ageToDob(array &$data) {
    if (!pick($data, 'dob') && pick($data, 'age') !== null) {
        $data['dob'] = (date('Y') - (int)$data['age']) . '-01-01';
    }
}

switch ($method) {
    case 'GET':
        if (!empty($_GET['id'])) {
            respondRow(fetchOne($pdo, "$select WHERE c.CustomerID=:i", [':i' => (int)$_GET['id']]));
        }
        if (!empty($_GET['q'])) {
            $q = '%' . $_GET['q'] . '%';
            respond(fetchAllRows($pdo, "$select WHERE c.FullName LIKE :name OR c.Phone LIKE :phone OR c.Email LIKE :email ORDER BY c.FullName", [':name' => $q, ':phone' => $q, ':email' => $q]));
        }
        respond(fetchAllRows($pdo, "$select ORDER BY c.FullName"));

    case 'POST':
        if (!pick($data, 'name')) fail('Name is required');
        ageToDob($data);
        $data['rgdate'] = date('Y-m-d');
        $id = insertRow($pdo, 'customer', $cols, $data);
        respondRow(fetchOne($pdo, "$select WHERE c.CustomerID=:i", [':i' => $id]), 201);

    case 'PUT':
        $id = requireId($data);
        ageToDob($data);
        $map = $cols; unset($map['rgdate']);
        updateFields($pdo, 'customer', 'CustomerID', $id, $map, $data);
        respondRow(fetchOne($pdo, "$select WHERE c.CustomerID=:i", [':i' => $id]));

    case 'DELETE':
        $id = requireId($data);
        $s = $pdo->prepare('DELETE FROM customer WHERE CustomerID=:i');
        $s->execute([':i' => $id]);
        respond(['deleted' => $s->rowCount()]);

    default:
        fail('Method not allowed', 405);
}
