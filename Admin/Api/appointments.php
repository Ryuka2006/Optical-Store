<?php
require_once __DIR__ . '/guard.php'; api_security_headers(); require_login();
api_require_methods(['GET','POST','PUT','DELETE']);










header('Content-Type: application/json; charset=utf-8');



$method = $_SERVER['REQUEST_METHOD'];


if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data);
    exit;
}


function readInput(): array {
    $raw = file_get_contents('php://input');
    $type = $_SERVER['CONTENT_TYPE'] ?? '';

    if (stripos($type, 'application/json') !== false) {
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
    if (!empty($_POST)) {
        return $_POST;
    }
    parse_str($raw, $data);
    return is_array($data) ? $data : [];
}


function validateAppointment(array $in): array {
    $errors = [];

    foreach (['cusid', 'optoid', 'date', 'time', 'status'] as $f) {
        if (!isset($in[$f]) || trim((string)$in[$f]) === '') {
            $errors[] = "Missing field: $f";
        }
    }
    if ($errors) return $errors;

    if (!ctype_digit((string)$in['cusid']))  $errors[] = 'cusid must be a number';
    if (!ctype_digit((string)$in['optoid'])) $errors[] = 'optoid must be a number';

    $d = DateTime::createFromFormat('Y-m-d', $in['date']);
    if (!$d || $d->format('Y-m-d') !== $in['date']) $errors[] = 'date must be YYYY-MM-DD';

    if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $in['time'])) $errors[] = 'time must be HH:MM';

    $allowed = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled'];
    if (!in_array($in['status'], $allowed, true)) $errors[] = 'invalid status';

    return $errors;
}

function normalizeTime(string $t): string {
    return strlen($t) === 5 ? $t . ':00' : $t;
}

function fetchOne(PDO $pdo, $id) {
    $stmt = $pdo->prepare("
        SELECT 
            a.AppointmentID,
            a.CustomerID,
            a.OptometristID,
            c.FullName AS CustomerName,     -- Change 'CustomerName' if your column is named differently (e.g. FullName)
            e.FullName AS OptometristName,   -- Change 'EmployeeName' if your column is named differently
            a.AppointmentDate,
            a.AppointmentTime,
            a.Status
        FROM appointment a
        LEFT JOIN customer c ON a.CustomerID = c.CustomerID
        LEFT JOIN employee e ON a.OptometristID = e.EmployeeID
        WHERE a.AppointmentID = :id
    ");
    $stmt->bindValue(':id', (int)$id, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

try {
    require_once __DIR__ . '/database.php';
    require_once __DIR__ . '/guard.php';
    require_login();

    
    if ($method === 'GET') {
        if (isset($_GET['id']) && $_GET['id'] !== '') {
            $row = fetchOne($pdo, $_GET['id']);
            if (!$row) respond(['error' => 'Appointment not found'], 404);
            respond($row);
        }
        
        $stmt = $pdo->query("
            SELECT 
                a.AppointmentID,
                a.CustomerID,
                a.OptometristID,
                c.FullName AS CustomerName,
                e.FullName AS OptometristName,
                a.AppointmentDate,
                a.AppointmentTime,
                a.Status
            FROM appointment a
            LEFT JOIN customer c ON a.CustomerID = c.CustomerID
            LEFT JOIN employee e ON a.OptometristID = e.EmployeeID
            ORDER BY a.AppointmentDate, a.AppointmentTime
        ");
        respond($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    
    if ($method === 'POST') {
        $in = readInput();
        $errors = validateAppointment($in);
        if ($errors) respond(['error' => implode('; ', $errors)], 422);

        $stmt = $pdo->prepare(
            "INSERT INTO appointment (CustomerID, OptometristID, AppointmentDate, AppointmentTime, Status)
             VALUES (:cus, :opto, :date, :time, :status)"
        );
        $stmt->execute([
            ':cus'    => (int)$in['cusid'],
            ':opto'   => (int)$in['optoid'],
            ':date'   => $in['date'],
            ':time'   => normalizeTime($in['time']),
            ':status' => $in['status'],
        ]);

        respond(fetchOne($pdo, $pdo->lastInsertId()), 201);
    }

    
    if ($method === 'PUT') {
        $in = readInput();
        if (!isset($in['id']) || !ctype_digit((string)$in['id'])) {
            respond(['error' => 'Missing or invalid id'], 422);
        }
        $errors = validateAppointment($in);
        if ($errors) respond(['error' => implode('; ', $errors)], 422);

        if (!fetchOne($pdo, $in['id'])) respond(['error' => 'Appointment not found'], 404);

        $stmt = $pdo->prepare(
            "UPDATE appointment
                SET CustomerID = :cus, OptometristID = :opto, AppointmentDate = :date,
                    AppointmentTime = :time, Status = :status
              WHERE AppointmentID = :id"
        );
        $stmt->execute([
            ':id'     => (int)$in['id'],
            ':cus'    => (int)$in['cusid'],
            ':opto'   => (int)$in['optoid'],
            ':date'   => $in['date'],
            ':time'   => normalizeTime($in['time']),
            ':status' => $in['status'],
        ]);

        respond(fetchOne($pdo, $in['id']));
    }

    
    if ($method === 'DELETE') {
        $in = readInput();
        $id = $in['id'] ?? ($_GET['id'] ?? null);
        if ($id === null || !ctype_digit((string)$id)) {
            respond(['error' => 'Missing or invalid id'], 422);
        }

        $stmt = $pdo->prepare("DELETE FROM appointment WHERE AppointmentID = :id");
        $stmt->bindValue(':id', (int)$id, PDO::PARAM_INT);
        $stmt->execute();

        if ($stmt->rowCount() === 0) respond(['error' => 'Appointment not found'], 404);
        respond(['message' => 'Appointment deleted', 'deleted' => $stmt->rowCount()]);
    }

    respond(['error' => 'Method not allowed'], 405);

} catch (PDOException $e) {
    error_log('Appointments API database error: ' . $e->getMessage());
    respond(['error' => $e->getCode() === '23000' ? 'This appointment conflicts with existing records.' : 'Could not complete the appointment request.'], $e->getCode() === '23000' ? 409 : 500);
}
