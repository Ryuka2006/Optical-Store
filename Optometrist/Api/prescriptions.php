<?php
                                                  
require_once 'database.php';
$method = $_SERVER['REQUEST_METHOD'];
$data   = input();
$today  = date('Y-m-d');

                                                                                      
$select = "SELECT p.PrescriptionID, p.ExaminationID, p.CustomerID, p.OptometristID AS OptomestristID, p.PrescriptionDate,
                  p.ExpiryDate, p.LensType, p.LensPower, p.Remarks, c.FullName,
                  CASE WHEN p.Status = 'Pending Sign-off' THEN 'Pending Sign-off'
                       WHEN p.ExpiryDate < :today THEN 'Expired'
                       ELSE 'Active' END AS Status
           FROM prescription p JOIN customer c ON c.CustomerID = p.CustomerID";

function rxOne(PDO $pdo, string $select, int $id) {
    return fetchOne($pdo, "$select WHERE p.PrescriptionID=:i", [':i' => $id, ':today' => date('Y-m-d')]);
}

function validateExpiry(array $data): void {
    $expiry = pick($data, 'expiry');
    if (!$expiry) fail('Expiry date is required');
    $date = DateTime::createFromFormat('!Y-m-d', (string)$expiry);
    if (!$date || $date->format('Y-m-d') !== $expiry) fail('Expiry date must be a valid date');
}

$cols = [
    'eid' => 'ExaminationID', 'cusid' => 'CustomerID', 'optoid' => 'OptometristID',
    'pdate' => 'PrescriptionDate', 'expiry' => 'ExpiryDate', 'lens_type' => 'LensType',
    'lens_power' => 'LensPower', 'remarks' => 'Remarks', 'status' => 'Status',
];

switch ($method) {
    case 'GET':
        if (!empty($_GET['id'])) respondRow(rxOne($pdo, $select, (int)$_GET['id']));
        $where = ''; $p = [':today' => $today];
        if (!empty($_GET['customer_id'])) { $where = 'WHERE p.CustomerID=:c'; $p[':c'] = (int)$_GET['customer_id']; }
        respond(fetchAllRows($pdo, "$select $where ORDER BY p.PrescriptionID", $p));

    case 'POST':
        $data['cusid']  = findOrCreateCustomer($pdo, $data);
        $data['optoid'] = pick($data, 'optoid', currentEmployeeId($pdo));
        $data['pdate']  = pick($data, 'pdate', $today);
        $data['status'] = pick($data, 'status', 'Active');
        validateExpiry($data);
        $id = insertRow($pdo, 'prescription', $cols, $data);
        respondRow(rxOne($pdo, $select, $id), 201);

    case 'PUT':
        $id = requireId($data);
        if (!empty($data['renew'])) {
            $pdo->prepare("UPDATE prescription SET ExpiryDate=:e, Status='Active' WHERE PrescriptionID=:i")
                ->execute([':e' => date('Y-m-d', strtotime('+1 year')), ':i' => $id]);
        } else {
            if (array_key_exists('expiry', $data)) validateExpiry($data);
            if (!empty($data['patient']) || !empty($data['cusid'])) $data['cusid'] = findOrCreateCustomer($pdo, $data);
            updateFields($pdo, 'prescription', 'PrescriptionID', $id, $cols, $data);
        }
        respondRow(rxOne($pdo, $select, $id));

    case 'DELETE':
        $id = requireId($data);
        $s = $pdo->prepare('DELETE FROM prescription WHERE PrescriptionID=:i');
        $s->execute([':i' => $id]);
        respond(['deleted' => $s->rowCount()]);

    default:
        fail('Method not allowed', 405);
}
