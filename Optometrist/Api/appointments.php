<?php
                                      
require_once 'database.php';
$method = $_SERVER['REQUEST_METHOD'];
$data   = input();
$today  = date('Y-m-d');

const APPT_STATUS = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled'];

$select = "SELECT a.AppointmentID, a.CustomerID, a.OptometristID AS OptomestristID, a.AppointmentDate, a.AppointmentTime,
                  a.AppointmentType, a.Status, c.FullName
           FROM appointment a JOIN customer c ON c.CustomerID = a.CustomerID";

function toTime($t): string {
    $ts = strtotime($t);
    if ($ts === false) fail('Invalid time. Use a format like 03:30 PM');
    return date('H:i:s', $ts);
}

switch ($method) {
    case 'GET':
        if (!empty($_GET['id'])) {
            respondRow(fetchOne($pdo, "$select WHERE a.AppointmentID=:i", [':i' => (int)$_GET['id']]));
        }
        $where = []; $p = [];
        if (!empty($_GET['customer_id'])) { $where[] = 'a.CustomerID=:c'; $p[':c'] = (int)$_GET['customer_id']; }
        $date = $_GET['date'] ?? 'all';
        if ($date !== 'all') { $where[] = 'a.AppointmentDate=:d'; $p[':d'] = $date; }
        $sql = $select . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY a.AppointmentDate, a.AppointmentTime';
        respond(fetchAllRows($pdo, $sql, $p));

    case 'POST':
        $data['cusid']  = findOrCreateCustomer($pdo, $data);
        $data['optoid'] = pick($data, 'optoid', currentEmployeeId($pdo));
        $data['date']   = pick($data, 'date', $today);
        if (!pick($data, 'time')) fail('Time is required');
        $data['time']   = toTime($data['time']);
        $data['type']   = pick($data, 'type', 'Routine Eye Exam');
        $data['status'] = pick($data, 'status', 'Scheduled');
        if (!in_array($data['status'], APPT_STATUS, true)) fail('Invalid status');
        $id = insertRow($pdo, 'appointment', [
            'cusid' => 'CustomerID', 'optoid' => 'OptometristID', 'date' => 'AppointmentDate',
            'time' => 'AppointmentTime', 'type' => 'AppointmentType', 'status' => 'Status',
        ], $data);
        respondRow(fetchOne($pdo, "$select WHERE a.AppointmentID=:i", [':i' => $id]), 201);

    case 'PUT':
        $id = requireId($data);
        if (isset($data['time'])) $data['time'] = toTime($data['time']);
        if (isset($data['status']) && !in_array($data['status'], APPT_STATUS, true)) fail('Invalid status');
        updateFields($pdo, 'appointment', 'AppointmentID', $id, [
            'status' => 'Status', 'date' => 'AppointmentDate', 'time' => 'AppointmentTime', 'type' => 'AppointmentType',
        ], $data);
        respondRow(fetchOne($pdo, "$select WHERE a.AppointmentID=:i", [':i' => $id]));

    case 'DELETE':
        $id = requireId($data);
        $s = $pdo->prepare('DELETE FROM appointment WHERE AppointmentID=:i');
        $s->execute([':i' => $id]);
        respond(['deleted' => $s->rowCount()]);

    default:
        fail('Method not allowed', 405);
}
