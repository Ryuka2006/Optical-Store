<?php
declare(strict_types=1);
require_once __DIR__ . '/guard.php';
api_security_headers();
api_session();
require_admin();
api_require_methods(['GET', 'POST', 'PUT', 'DELETE']);
require_once __DIR__ . '/database.php';

try {
    
    
    $hasUnifiedUsers = (bool)$pdo->query("SHOW TABLES LIKE 'user'")->fetchColumn();
    $directUsers = !$hasUnifiedUsers && (bool)$pdo->query("SHOW TABLES LIKE 'users'")->fetchColumn();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if ($directUsers) {
        $select = "SELECT UserID, NULL AS EmployeeID, FullName AS EmployeeName, Email AS EmployeeEmail,
                NULL AS RoleID, Role AS RoleName, Username, Status, 'direct' AS AccountMode FROM users";
    } else {
        $select = "SELECT u.UserID, u.EmployeeID, e.FullName AS EmployeeName, e.Email AS EmployeeEmail,
                u.RoleID, r.RoleName, u.Username, u.Status, 'linked' AS AccountMode
            FROM `user` u LEFT JOIN employee e ON e.EmployeeID = u.EmployeeID
            LEFT JOIN role r ON r.RoleID = u.RoleID";
    }
    $fetchUser = static function (int $id) use ($pdo, $select): ?array {
        $stmt = $pdo->prepare($select . ' WHERE UserID = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    };

    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            if (!ctype_digit((string)$_GET['id']) || (int)$_GET['id'] < 1) api_json(['error' => 'Invalid user ID.'], 422);
            $row = $fetchUser((int)$_GET['id']);
            if (!$row) api_json(['error' => 'User not found.'], 404);
            api_json($row);
        }
        $stmt = $pdo->query($select . ' ORDER BY UserID');
        api_json($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    $input = api_read_input();
    $id = filter_var($input['UserID'] ?? $input['id'] ?? null, FILTER_VALIDATE_INT) ?: 0;
    if ($method === 'DELETE') {
        if ($id < 1) api_json(['error' => 'A valid user ID is required.'], 422);
        if ($id === (int)$_SESSION['user_id']) api_json(['error' => 'You cannot delete your own account.'], 409);
        $table = $directUsers ? 'users' : '`user`';
        $stmt = $pdo->prepare("DELETE FROM $table WHERE UserID = :id");
        $stmt->execute([':id' => $id]);
        if (!$stmt->rowCount()) api_json(['error' => 'User not found.'], 404);
        api_json(['success' => true, 'message' => 'User deleted.']);
    }

    $username = trim((string)($input['Username'] ?? ''));
    $password = (string)($input['Password'] ?? '');
    $status = (string)($input['Status'] ?? 'Active');
    if ($username === '' || strlen($username) > 100 || !preg_match('/^[\pL\pN._@-]+$/u', $username)) api_json(['error' => 'Enter a valid username (letters, numbers, dots, underscores, @ or hyphens).'], 422);
    if (!in_array($status, ['Active', 'Inactive'], true)) api_json(['error' => 'Choose a valid account status.'], 422);
    if ($password !== '' && (strlen($password) < 8 || strlen($password) > 1024)) api_json(['error' => 'Password must be at least 8 characters.'], 422);
    if ($method === 'POST' && $password === '') api_json(['error' => 'A password is required for a new account.'], 422);

    if ($directUsers) {
        $name = trim((string)($input['FullName'] ?? ''));
        $email = trim((string)($input['Email'] ?? ''));
        $role = trim((string)($input['Role'] ?? ''));
        if ($name === '' || strlen($name) > 100) api_json(['error' => 'Full name is required and must be 100 characters or fewer.'], 422);
        if ($email !== '' && (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 100)) api_json(['error' => 'Enter a valid email address.'], 422);
        if ($role === '' || strlen($role) > 30) api_json(['error' => 'Choose a valid role.'], 422);
        if ($method === 'POST') {
            $stmt = $pdo->prepare('INSERT INTO users (FullName, Username, Email, PasswordHash, Role, Status) VALUES (:name, :username, :email, :hash, :role, :status)');
            $stmt->execute([':name' => $name, ':username' => $username, ':email' => $email ?: null, ':hash' => password_hash($password, PASSWORD_DEFAULT), ':role' => $role, ':status' => $status]);
            api_json($fetchUser((int)$pdo->lastInsertId()), 201);
        }
        if ($id < 1) api_json(['error' => 'A valid user ID is required.'], 422);
        $existing = $fetchUser($id);
        if (!$existing) api_json(['error' => 'User not found.'], 404);
        if ($id === (int)$_SESSION['user_id'] && ($status !== 'Active' || !in_array(strtolower($role), ['admin', 'administrator'], true))) api_json(['error' => 'You cannot deactivate or remove administrator access from your own account.'], 409);
        if ($password !== '') {
            $stmt = $pdo->prepare('UPDATE users SET FullName=:name, Username=:username, Email=:email, PasswordHash=:hash, Role=:role, Status=:status WHERE UserID=:id');
            $stmt->execute([':name'=>$name, ':username'=>$username, ':email'=>$email ?: null, ':hash'=>password_hash($password, PASSWORD_DEFAULT), ':role'=>$role, ':status'=>$status, ':id'=>$id]);
        } else {
            $stmt = $pdo->prepare('UPDATE users SET FullName=:name, Username=:username, Email=:email, Role=:role, Status=:status WHERE UserID=:id');
            $stmt->execute([':name'=>$name, ':username'=>$username, ':email'=>$email ?: null, ':role'=>$role, ':status'=>$status, ':id'=>$id]);
        }
        if ($id === (int)$_SESSION['user_id']) { $_SESSION['user_name'] = $name; $_SESSION['user_role'] = $role; }
        api_json($fetchUser($id));
    }

    $employeeId = filter_var($input['EmployeeID'] ?? null, FILTER_VALIDATE_INT);
    $roleId = filter_var($input['RoleID'] ?? null, FILTER_VALIDATE_INT);
    if (!$employeeId || $employeeId < 1 || !$roleId || $roleId < 1) api_json(['error' => 'Choose a valid employee and role.'], 422);
    $employeeCheck = $pdo->prepare('SELECT 1 FROM employee WHERE EmployeeID = ?'); $employeeCheck->execute([$employeeId]);
    $roleCheck = $pdo->prepare('SELECT RoleName FROM role WHERE RoleID = ?'); $roleCheck->execute([$roleId]);
    $roleName = $roleCheck->fetchColumn();
    if (!$employeeCheck->fetchColumn() || !$roleName) api_json(['error' => 'The selected employee or role no longer exists.'], 422);
    if ($method === 'POST') {
        $stmt = $pdo->prepare('INSERT INTO `user` (EmployeeID, RoleID, Username, PasswordHash, Status) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$employeeId, $roleId, $username, password_hash($password, PASSWORD_DEFAULT), $status]);
        api_json($fetchUser((int)$pdo->lastInsertId()), 201);
    }
    if ($id < 1) api_json(['error' => 'A valid user ID is required.'], 422);
    $existing = $fetchUser($id);
    if (!$existing) api_json(['error' => 'User not found.'], 404);
    if ($id === (int)$_SESSION['user_id'] && ($status !== 'Active' || !in_array(strtolower((string)$roleName), ['admin', 'administrator'], true))) api_json(['error' => 'You cannot deactivate or remove administrator access from your own account.'], 409);
    if ($password !== '') {
        $stmt = $pdo->prepare('UPDATE `user` SET EmployeeID=?, RoleID=?, Username=?, PasswordHash=?, Status=? WHERE UserID=?');
        $stmt->execute([$employeeId, $roleId, $username, password_hash($password, PASSWORD_DEFAULT), $status, $id]);
    } else {
        $stmt = $pdo->prepare('UPDATE `user` SET EmployeeID=?, RoleID=?, Username=?, Status=? WHERE UserID=?');
        $stmt->execute([$employeeId, $roleId, $username, $status, $id]);
    }
    $updatedUser = $fetchUser($id);
    if ($id === (int)$_SESSION['user_id']) { $_SESSION['user_name'] = $updatedUser['EmployeeName'] ?? $_SESSION['user_name']; $_SESSION['user_role'] = (string)$roleName; }
    api_json($updatedUser);
} catch (PDOException $error) {
    error_log('Users API database error: ' . $error->getMessage());
    if ($error->getCode() === '23000') api_json(['error' => 'That username is already in use, or the user is referenced by another record.'], 409);
    api_json(['error' => 'Could not complete the user request.'], 500);
}
