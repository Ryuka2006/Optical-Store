<?php
                                              
                                                                          
require_once 'database.php';
$method = $_SERVER['REQUEST_METHOD'];
$data   = input();

$cols = [
    'cusid' => 'CustomerID', 'optoid' => 'OptometristID', 'edate' => 'ExaminationDate',
    'lsph' => 'LeftEyeSPH', 'lcyl' => 'LeftEyeCYL', 'laxis' => 'LeftEyeAXIS',
    'rsph' => 'RightEyeSPH', 'rcyl' => 'RightEyeCYL', 'raxis' => 'RightEyeAXIS',
    'pd' => 'PD', 'ep' => 'EyePressure', 'va' => 'VisualAcuity', 'note' => 'Notes',
];

switch ($method) {
    case 'GET':
        if (!empty($_GET['id'])) {
            respondRow(fetchOne($pdo, 'SELECT * FROM eye_examination WHERE ExaminationID=:i', [':i' => (int)$_GET['id']]));
        }
        if (!empty($_GET['customer_id'])) {
            respond(fetchAllRows($pdo,
                'SELECT * FROM eye_examination WHERE CustomerID=:c ORDER BY ExaminationDate DESC, ExaminationID DESC',
                [':c' => (int)$_GET['customer_id']]));
        }
        respond(fetchAllRows($pdo, 'SELECT * FROM eye_examination ORDER BY ExaminationDate DESC, ExaminationID DESC'));

    case 'POST':
        if (!pick($data, 'cusid')) fail('cusid (patient) is required');
        $data['optoid'] = pick($data, 'optoid', currentEmployeeId($pdo));
        $data['edate']  = pick($data, 'edate', date('Y-m-d'));
        $id = insertRow($pdo, 'eye_examination', $cols, $data);
        respondRow(fetchOne($pdo, 'SELECT * FROM eye_examination WHERE ExaminationID=:i', [':i' => $id]), 201);

    case 'PUT':
        $id = requireId($data);
        updateFields($pdo, 'eye_examination', 'ExaminationID', $id, $cols, $data);
        respondRow(fetchOne($pdo, 'SELECT * FROM eye_examination WHERE ExaminationID=:i', [':i' => $id]));

    case 'DELETE':
        $id = requireId($data);
        $s = $pdo->prepare('DELETE FROM eye_examination WHERE ExaminationID=:i');
        $s->execute([':i' => $id]);
        respond(['deleted' => $s->rowCount()]);

    default:
        fail('Method not allowed', 405);
}
