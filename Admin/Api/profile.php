<?php
declare(strict_types=1);
require_once __DIR__ . '/guard.php';
api_security_headers();
api_session();
require_login();
api_require_methods(['GET', 'PUT', 'POST']);
require_once __DIR__ . '/database.php';

$userId = (int)$_SESSION['user_id'];
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$hasUnifiedUsers = (bool)$pdo->query("SHOW TABLES LIKE 'user'")->fetchColumn();
$hasUsers = !$hasUnifiedUsers && (bool)$pdo->query("SHOW TABLES LIKE 'users'")->fetchColumn();
$pdo->exec("CREATE TABLE IF NOT EXISTS user_profile (UserID INT NOT NULL PRIMARY KEY, FullName VARCHAR(150) NULL, Email VARCHAR(150) NULL, Phone VARCHAR(30) NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$load = static function () use ($pdo, $userId, $hasUsers): array {
    if ($hasUsers) {
        $sql = "SELECT u.UserID,u.Username,COALESCE(NULLIF(p.FullName,''),u.FullName,u.Username) AS FullName,COALESCE(NULLIF(p.Email,''),u.Email) AS Email,p.Phone,NULL AS EmployeeID,u.Role AS RoleName,u.PasswordHash FROM users u LEFT JOIN user_profile p ON p.UserID=u.UserID WHERE u.UserID=:id LIMIT 1";
    } else {
        $sql = "SELECT u.UserID,u.Username,COALESCE(NULLIF(p.FullName,''),e.FullName,u.Username) AS FullName,COALESCE(NULLIF(p.Email,''),e.Email) AS Email,COALESCE(NULLIF(p.Phone,''),e.Phone) AS Phone,u.EmployeeID,r.RoleName,u.PasswordHash FROM `user` u LEFT JOIN employee e ON e.EmployeeID=u.EmployeeID LEFT JOIN role r ON r.RoleID=u.RoleID LEFT JOIN user_profile p ON p.UserID=u.UserID WHERE u.UserID=:id LIMIT 1";
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id'=>$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) api_json(['error'=>'Profile not found.'],404);
    return $row;
};

$user = $load();
if ($method === 'GET') {
    api_json(['success'=>true,'profile'=>[
        'UserID'=>(int)$user['UserID'],'Username'=>$user['Username'],'FullName'=>$user['FullName'],
        'Email'=>$user['Email'],'Phone'=>$user['Phone'],'Role'=>$user['RoleName'] ?: ($_SESSION['user_role'] ?? ''),
        'CanEditName'=>true,'CanEditPhone'=>true
    ]]);
}

$input = api_read_input();
$action = (string)($input['action'] ?? 'profile');
if ($method === 'POST' && $action !== 'password') api_json(['error'=>'POST is only supported for password changes.'],405);
if ($action === 'password') {
    $current = (string)($input['currentPassword'] ?? $input['current'] ?? '');
    $new = (string)($input['newPassword'] ?? $input['new'] ?? '');
    if (!password_verify($current,(string)$user['PasswordHash'])) api_json(['error'=>'Current password is incorrect.'],422);
    if (strlen($new)<8 || strlen($new)>1024) api_json(['error'=>'New password must contain at least 8 characters.'],422);
    $table = $hasUsers ? 'users' : '`user`';
    $stmt = $pdo->prepare("UPDATE $table SET PasswordHash=:hash WHERE UserID=:id");
    $stmt->execute([':hash'=>password_hash($new,PASSWORD_DEFAULT),':id'=>$userId]);
    api_json(['success'=>true,'message'=>'Password updated.']);
}

$name = trim((string)($input['fullName'] ?? $input['name'] ?? $user['FullName']));
$email = trim((string)($input['email'] ?? $user['Email'] ?? ''));
$phone = trim((string)($input['phone'] ?? $user['Phone'] ?? ''));
if ($name==='' || strlen($name)>($hasUsers?100:150)) api_json(['error'=>'Full name is required and exceeds the account schema limit.'],422);
if ($email!=='' && (!filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($email)>($hasUsers?100:150))) api_json(['error'=>'Enter a valid email address.'],422);
if (strlen($phone)>30) api_json(['error'=>'Phone number must be 30 characters or fewer.'],422);

$pdo->beginTransaction();
try {
    $stmt=$pdo->prepare('INSERT INTO user_profile(UserID,FullName,Email,Phone) VALUES(:id,:name,:email,:phone) ON DUPLICATE KEY UPDATE FullName=VALUES(FullName),Email=VALUES(Email),Phone=VALUES(Phone)');
    $stmt->execute([':id'=>$userId,':name'=>$name,':email'=>$email?:null,':phone'=>$phone?:null]);
    if ($hasUsers) {
        $stmt=$pdo->prepare('UPDATE users SET FullName=:name,Email=:email WHERE UserID=:id');
        $stmt->execute([':name'=>$name,':email'=>$email?:null,':id'=>$userId]);
    } elseif (!empty($user['EmployeeID'])) {
        $stmt=$pdo->prepare('UPDATE employee SET FullName=:name,Email=:email,Phone=:phone WHERE EmployeeID=:id');
        $stmt->execute([':name'=>$name,':email'=>$email?:null,':phone'=>$phone?:null,':id'=>(int)$user['EmployeeID']]);
    }
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Profile update failed: '.$error->getMessage());
    api_json(['error'=>'Could not save the profile.'],500);
}

$_SESSION['user_name']=$name;
$saved=$load();
api_json(['success'=>true,'profile'=>[
    'UserID'=>(int)$saved['UserID'],'Username'=>$saved['Username'],'FullName'=>$saved['FullName'],
    'Email'=>$saved['Email'],'Phone'=>$saved['Phone'],'Role'=>$saved['RoleName'] ?: ($_SESSION['user_role'] ?? ''),
    'CanEditName'=>true,'CanEditPhone'=>true
]]);
