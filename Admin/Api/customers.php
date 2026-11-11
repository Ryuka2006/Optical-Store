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
    $raw  = file_get_contents('php://input');
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

function validDate($value): bool {
    $d = DateTime::createFromFormat('Y-m-d', (string)$value);
    return $d && $d->format('Y-m-d') === $value;
}


function validateCustomer(array $in): array {
    $errors = [];
    $v = [];

    $v['fname']   = trim((string)($in['fname'] ?? ''));
    $v['gen']     = trim((string)($in['gen'] ?? ''));
    $v['dob']     = trim((string)($in['dob'] ?? ''));
    $v['phone']   = trim((string)($in['phone'] ?? ''));
    $v['email']   = trim((string)($in['email'] ?? ''));
    $v['rgdate']  = trim((string)($in['rgdate'] ?? ''));
    $v['address'] = trim((string)($in['address'] ?? ''));

    if ($v['fname'] === '') $errors[] = 'Full name is required';

    if (!in_array($v['gen'], ['Male', 'Female', 'Other'], true)) {
        $errors[] = 'Gender must be Male, Female or Other';
    }
    if ($v['dob'] !== '' && !validDate($v['dob'])) {
        $errors[] = 'Date of birth must be YYYY-MM-DD';
    }
    if ($v['email'] !== '' && !filter_var($v['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Invalid email address';
    }

    
    if ($v['rgdate'] === '') $v['rgdate'] = date('Y-m-d');
    if (!validDate($v['rgdate'])) $errors[] = 'Registration date must be YYYY-MM-DD';

    
    foreach (['dob', 'phone', 'email', 'address'] as $f) {
        if ($v[$f] === '') $v[$f] = null;
    }

    return [$errors, $v];
}

function fetchOne(PDO $pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM customer WHERE CustomerID = :id");
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
            if (!$row) respond(['error' => 'Customer not found'], 404);
            respond($row);
        }
        $stmt = $pdo->query("SELECT * FROM customer ORDER BY CustomerID");
        respond($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    
    if ($method === 'POST') {
        $in = readInput();
        [$errors, $v] = validateCustomer($in);
        if ($errors) respond(['error' => implode('; ', $errors)], 422);

        
        $hasId = isset($in['id']) && trim((string)$in['id']) !== '';
        if ($hasId && !ctype_digit((string)$in['id'])) {
            respond(['error' => 'id must be a number'], 422);
        }

        $cols = "FullName, Gender, DateOfBirth, Phone, Email, RegisterationDate, Address";
        $vals = ":fname, :gen, :dob, :phone, :email, :rgdate, :address";
        $params = [
            ':fname'   => $v['fname'],
            ':gen'     => $v['gen'],
            ':dob'     => $v['dob'],
            ':phone'   => $v['phone'],
            ':email'   => $v['email'],
            ':rgdate'  => $v['rgdate'],
            ':address' => $v['address'],
        ];
        if ($hasId) {
            $cols = "CustomerID, " . $cols;
            $vals = ":id, " . $vals;
            $params[':id'] = (int)$in['id'];
        }

        $stmt = $pdo->prepare("INSERT INTO customer ($cols) VALUES ($vals)");
        $stmt->execute($params);

        $newId = $hasId ? (int)$in['id'] : $pdo->lastInsertId();
        respond(fetchOne($pdo, $newId), 201);
    }

    
    if ($method === 'PUT') {
        $in = readInput();
        if (!isset($in['id']) || !ctype_digit((string)$in['id'])) {
            respond(['error' => 'Missing or invalid id'], 422);
        }
        [$errors, $v] = validateCustomer($in);
        if ($errors) respond(['error' => implode('; ', $errors)], 422);

        if (!fetchOne($pdo, $in['id'])) respond(['error' => 'Customer not found'], 404);

        $stmt = $pdo->prepare(
            "UPDATE customer
                SET FullName = :fname, Gender = :gen, DateOfBirth = :dob, Phone = :phone,
                    Email = :email, RegisterationDate = :rgdate, Address = :address
              WHERE CustomerID = :id"
        );
        $stmt->execute([
            ':id'      => (int)$in['id'],
            ':fname'   => $v['fname'],
            ':gen'     => $v['gen'],
            ':dob'     => $v['dob'],
            ':phone'   => $v['phone'],
            ':email'   => $v['email'],
            ':rgdate'  => $v['rgdate'],
            ':address' => $v['address'],
        ]);

        respond(fetchOne($pdo, $in['id']));
    }

    
    if ($method === 'DELETE') {
        $in = readInput();
        $id = $in['id'] ?? ($_GET['id'] ?? null);
        if ($id === null || !ctype_digit((string)$id)) {
            respond(['error' => 'Missing or invalid id'], 422);
        }

        $stmt = $pdo->prepare("DELETE FROM customer WHERE CustomerID = :id");
        $stmt->bindValue(':id', (int)$id, PDO::PARAM_INT);
        $stmt->execute();

        if ($stmt->rowCount() === 0) respond(['error' => 'Customer not found'], 404);
        respond(['message' => 'Customer deleted', 'deleted' => $stmt->rowCount()]);
    }

    respond(['error' => 'Method not allowed'], 405);

} catch (PDOException $e) {
    error_log('DB error: ' . $e->getMessage());

    
    if ($e->getCode() === '23000') {
        respond(['error' => 'Duplicate ID, or this customer is still referenced by other records (e.g. appointments).'], 409);
    }
    respond(['error' => 'Database error. Check PHP/database.php settings and that the customer table exists.'], 500);
}
