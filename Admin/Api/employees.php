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


function validateEmployee(array $in): array {
    $errors = [];
    $v = [];

    $v['fname']  = trim((string)($in['fname'] ?? ''));
    $v['rid']    = trim((string)($in['rid'] ?? ''));
    $v['salary'] = trim((string)($in['salary'] ?? ''));
    $v['phone']  = trim((string)($in['phone'] ?? ''));
    $v['email']  = trim((string)($in['email'] ?? ''));

    if ($v['fname'] === '') $errors[] = 'Full name is required';
    if (mb_strlen($v['fname']) > 150) $errors[] = 'Full name must be 150 characters or fewer';
    if ($v['rid'] === '' || !ctype_digit($v['rid'])) {
        $errors[] = 'Role ID is required and must be a number';
    }
    if ($v['salary'] !== '' && (!is_numeric($v['salary']) || (float)$v['salary'] < 0 || (float)$v['salary'] > 9999999999.99)) {
        $errors[] = 'Salary must be a non-negative valid amount';
    }
    if (strlen($v['phone']) > 30) $errors[] = 'Phone must be 30 characters or fewer';
    if (strlen($v['email']) > 150) $errors[] = 'Email must be 150 characters or fewer';
    if ($v['email'] !== '' && !filter_var($v['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Invalid email address';
    }

    
    foreach (['phone', 'email', 'salary'] as $f) {
        if ($v[$f] === '') $v[$f] = null;
    }

    return [$errors, $v];
}

function fetchOne(PDO $pdo, $id) {
    $stmt = $pdo->prepare("
        SELECT e.*, r.RoleName 
        FROM employee e 
        LEFT JOIN role r ON e.RoleID = r.RoleID 
        WHERE e.EmployeeID = :id
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
            if (!$row) respond(['error' => 'Employee not found'], 404);
            respond($row);
        }
        $stmt = $pdo->query("
            SELECT e.*, r.RoleName 
            FROM employee e 
            LEFT JOIN role r ON e.RoleID = r.RoleID 
            ORDER BY e.EmployeeID
        ");
        respond($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    

    
    if ($method === 'POST') {
        $in = readInput();
        [$errors, $v] = validateEmployee($in);
        if ($errors) respond(['error' => implode('; ', $errors)], 422);

        $roleCheck = $pdo->prepare('SELECT 1 FROM role WHERE RoleID = :id');
        $roleCheck->execute([':id' => (int)$v['rid']]);
        if (!$roleCheck->fetchColumn()) respond(['error' => 'Select a valid employee role.'], 422);

        
        $hasId = isset($in['id']) && trim((string)$in['id']) !== '';
        if ($hasId && (!ctype_digit((string)$in['id']) || (int)$in['id'] < 1)) {
            respond(['error' => 'id must be a number'], 422);
        }

        $cols = "FullName, RoleID, Salary, Phone, Email";
        $vals = ":fname, :rid, :salary, :phone, :email";
        $params = [
            ':fname'  => $v['fname'],
            ':rid'    => (int)$v['rid'],
            ':salary' => $v['salary'],
            ':phone'  => $v['phone'],
            ':email'  => $v['email'],
        ];
        if ($hasId) {
            $cols = "EmployeeID, " . $cols;
            $vals = ":id, " . $vals;
            $params[':id'] = (int)$in['id'];
        }

        $stmt = $pdo->prepare("INSERT INTO employee ($cols) VALUES ($vals)");
        $stmt->execute($params);

        $newId = $hasId ? (int)$in['id'] : $pdo->lastInsertId();
        respond(fetchOne($pdo, $newId), 201);
    }

    
    if ($method === 'PUT') {
        $in = readInput();
        if (!isset($in['id']) || !ctype_digit((string)$in['id'])) {
            respond(['error' => 'Missing or invalid id'], 422);
        }
        [$errors, $v] = validateEmployee($in);
        if ($errors) respond(['error' => implode('; ', $errors)], 422);

        $roleCheck = $pdo->prepare('SELECT 1 FROM role WHERE RoleID = :id');
        $roleCheck->execute([':id' => (int)$v['rid']]);
        if (!$roleCheck->fetchColumn()) respond(['error' => 'Select a valid employee role.'], 422);

        if (!fetchOne($pdo, $in['id'])) respond(['error' => 'Employee not found'], 404);

        $stmt = $pdo->prepare(
            "UPDATE employee
                SET FullName = :fname, RoleID = :rid, Salary = :salary, Phone = :phone, Email = :email
              WHERE EmployeeID = :id"
        );
        $stmt->execute([
            ':id'     => (int)$in['id'],
            ':fname'  => $v['fname'],
            ':rid'    => (int)$v['rid'],
            ':salary' => $v['salary'],
            ':phone'  => $v['phone'],
            ':email'  => $v['email'],
        ]);

        respond(fetchOne($pdo, $in['id']));
    }

    
    if ($method === 'DELETE') {
        $in = readInput();
        $id = $in['id'] ?? ($_GET['id'] ?? null);
        if ($id === null || !ctype_digit((string)$id)) {
            respond(['error' => 'Missing or invalid id'], 422);
        }

        $stmt = $pdo->prepare("DELETE FROM employee WHERE EmployeeID = :id");
        $stmt->bindValue(':id', (int)$id, PDO::PARAM_INT);
        $stmt->execute();

        if ($stmt->rowCount() === 0) respond(['error' => 'Employee not found'], 404);
        respond(['message' => 'Employee deleted', 'deleted' => $stmt->rowCount()]);
    }

    respond(['error' => 'Method not allowed'], 405);

} catch (PDOException $e) {
    error_log('DB error: ' . $e->getMessage());

    
    if ($e->getCode() === '23000') {
        respond(['error' => 'Duplicate ID, or this employee is still referenced by other records.'], 409);
    }
    respond(['error' => 'Database error. Check database settings and ensure the employee table exists.'], 500);
}
?>
