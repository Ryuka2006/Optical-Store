<?php
require_once dirname(__DIR__) . '/guard.php';
api_security_headers();
require_once dirname(__DIR__) . '/database.php';
api_session();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
api_require_methods(['GET', 'POST']);
$findAccountTable = static function () use ($pdo): string {
    if ((bool)$pdo->query("SHOW TABLES LIKE 'user'")->fetchColumn()) return 'user';
    if ((bool)$pdo->query("SHOW TABLES LIKE 'users'")->fetchColumn()) return 'users';
    throw new RuntimeException('No supported user table exists.');
};
if ($method === 'GET') {
    if (empty($_SESSION['user_id'])) {
        $setupRequired = false;
        try {
            $table = $findAccountTable();
            $setupRequired = (int)$pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn() === 0;
        } catch (PDOException | RuntimeException $e) {
            error_log('Authentication setup check failed: ' . $e->getMessage());
            api_json(['error'=>'Authentication service is temporarily unavailable.'],500);
        }
        api_json(['success'=>true,'authenticated'=>false,'setupRequired'=>$setupRequired]);
    }
    api_json(['success'=>true,'authenticated'=>true,'user'=>['id'=>$_SESSION['user_id'],'name'=>$_SESSION['user_name'],'role'=>$_SESSION['user_role']]]);
}
if ($method !== 'POST') api_json(['error'=>'Method not allowed'],405);
$input=api_read_input(); $username=trim((string)($input['username']??'')); $password=(string)($input['password']??'');
if ($username==='' || $password==='') api_json(['error'=>'Username and password are required.'],422);
if (strlen($username) > 100 || strlen($password) > 1024) api_json(['error'=>'Invalid username or password.'],401);
if (($input['action'] ?? '') === 'bootstrap') {
    if (!empty($_SESSION['user_id'])) api_json(['error'=>'An account is already signed in.'],409);
    $name = trim((string)($input['name'] ?? ''));
    if ($name === '' || strlen($name) > 100) api_json(['error'=>'Enter a name of 100 characters or fewer.'],422);
    if (strlen($username) > 50 || preg_match('/^[\pL\pN._@-]+$/u', $username) !== 1) api_json(['error'=>'Enter a valid username (letters, numbers, dots, underscores, @ or hyphens).'],422);
    if (strlen($password) < 8) api_json(['error'=>'Choose a password with at least 8 characters.'],422);

    $bootstrapError = null;
    $userId = 0;
    $roleName = 'Admin';
    $lockAcquired = false;
    try {
        $lockAcquired = (int)$pdo->query("SELECT GET_LOCK('united_optic_admin_bootstrap', 5)")->fetchColumn() === 1;
        if (!$lockAcquired) {
            $bootstrapError = ['status'=>503,'message'=>'Administrator setup is busy. Please try again.'];
        } else {
            $pdo->beginTransaction();
            $table = $findAccountTable();
            if ((int)$pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn() > 0) {
                $pdo->rollBack();
                $bootstrapError = ['status'=>409,'message'=>'An account already exists. Sign in or ask an administrator for access.'];
            } elseif ($table === 'users') {
                $stmt = $pdo->prepare("INSERT INTO users (FullName, Username, PasswordHash, Role, Status) VALUES (:name, :username, :hash, 'Admin', 'Active')");
                $stmt->execute([':name'=>$name, ':username'=>$username, ':hash'=>password_hash($password, PASSWORD_DEFAULT)]);
                $userId = (int)$pdo->lastInsertId();
            } else {
                $roleStmt = $pdo->query("SELECT RoleID, RoleName FROM role WHERE LOWER(RoleName) IN ('admin', 'administrator') ORDER BY RoleID LIMIT 1");
                $role = $roleStmt->fetch(PDO::FETCH_ASSOC);
                if (!$role) {
                    $pdo->exec("INSERT INTO role (RoleName) VALUES ('Administrator')");
                    $role = ['RoleID'=>(int)$pdo->lastInsertId(), 'RoleName'=>'Administrator'];
                }
                foreach (['Cashier', 'Optometrist', 'Sales Staff'] as $requiredRole) {
                    if ($requiredRole === 'Sales Staff') {
                        $roleCheck = $pdo->query("SELECT 1 FROM role WHERE LOWER(RoleName) IN ('sale staff', 'sales staff') LIMIT 1");
                    } else {
                        $roleCheck = $pdo->prepare('SELECT 1 FROM role WHERE LOWER(RoleName) = LOWER(:role) LIMIT 1');
                        $roleCheck->execute([':role'=>$requiredRole]);
                    }
                    if (!$roleCheck->fetchColumn()) {
                        $roleInsert = $pdo->prepare('INSERT INTO role (RoleName) VALUES (:role)');
                        $roleInsert->execute([':role'=>$requiredRole]);
                    }
                }
                $roleName = (string)$role['RoleName'];
                $employeeStmt = $pdo->prepare('INSERT INTO employee (FullName, RoleID, Salary, Email) VALUES (:name, :role, NULL, NULL)');
                $employeeStmt->execute([':name'=>$name, ':role'=>(int)$role['RoleID']]);
                $stmt = $pdo->prepare("INSERT INTO `user` (EmployeeID, RoleID, Username, PasswordHash, Status) VALUES (:employee, :role, :username, :hash, 'Active')");
                $stmt->execute([':employee'=>(int)$pdo->lastInsertId(), ':role'=>(int)$role['RoleID'], ':username'=>$username, ':hash'=>password_hash($password, PASSWORD_DEFAULT)]);
                $userId = (int)$pdo->lastInsertId();
            }
            if ($userId > 0) $pdo->commit();
        }
    } catch (PDOException | RuntimeException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Administrator bootstrap failed: ' . $e->getMessage());
        $bootstrapError = $e instanceof PDOException && $e->getCode() === '23000'
            ? ['status'=>409,'message'=>'That username is already in use.']
            : ['status'=>500,'message'=>'Could not create the administrator account.'];
    } finally {
        if ($lockAcquired) {
            try {
                $pdo->query("SELECT RELEASE_LOCK('united_optic_admin_bootstrap')");
            } catch (PDOException $e) {
                error_log('Could not release administrator bootstrap lock: ' . $e->getMessage());
            }
        }
    }
    if ($bootstrapError !== null) api_json(['error'=>$bootstrapError['message']],$bootstrapError['status']);

    session_regenerate_id(true);
    $_SESSION['user_id']=$userId; $_SESSION['user_name']=$name; $_SESSION['user_role']=$roleName;
    api_json(['success'=>true,'user'=>['id'=>$userId,'name'=>$name,'role'=>$roleName]],201);
}
$now=time();
if (!empty($_SESSION['login_lock_until']) && $_SESSION['login_lock_until'] > $now) api_json(['error'=>'Too many failed attempts. Wait 15 minutes and try again.'],429);
if (!empty($_SESSION['login_attempt_window']) && $now - $_SESSION['login_attempt_window'] > 900) { unset($_SESSION['login_attempt_window'], $_SESSION['login_attempts'], $_SESSION['login_lock_until']); }
if (empty($_SESSION['login_attempt_window'])) { $_SESSION['login_attempt_window']=$now; $_SESSION['login_attempts']=0; }
try {
    $hasUnifiedUsers = (bool)$pdo->query("SHOW TABLES LIKE 'user'")->fetchColumn();
    $hasUsers = !$hasUnifiedUsers && (bool)$pdo->query("SHOW TABLES LIKE 'users'")->fetchColumn();
    if ($hasUsers) {
        $stmt=$pdo->prepare("SELECT UserID,FullName,Username,PasswordHash,Role,Status FROM users WHERE Username=:username LIMIT 1");
    } else {
        
        $stmt=$pdo->prepare("SELECT u.UserID,COALESCE(e.FullName,u.Username) AS FullName,u.Username,u.PasswordHash,r.RoleName AS Role,u.Status FROM `user` u LEFT JOIN employee e ON e.EmployeeID=u.EmployeeID LEFT JOIN role r ON r.RoleID=u.RoleID WHERE u.Username=:username LIMIT 1");
    }
    $stmt->execute([':username'=>$username]); $user=$stmt->fetch();
} catch (PDOException $e) {
    error_log('Authentication database error: ' . $e->getMessage());
    api_json(['error'=>'Authentication service is temporarily unavailable.'],500);
}
if (!$user || strcasecmp((string)$user['Status'],'Active')!==0 || !password_verify($password,(string)$user['PasswordHash'])) {
    $_SESSION['login_attempts'] = (int)($_SESSION['login_attempts'] ?? 0) + 1;
    if ($_SESSION['login_attempts'] >= 5) $_SESSION['login_lock_until']=$now+900;
    api_json(['error'=>'Invalid username or password.'],401);
}
$requestedRole = strtolower(trim((string)($input['requestedRole'] ?? '')));
$authenticatedRole = strtolower(trim((string)$user['Role']));
if ($requestedRole !== '' && normalize_role_name($requestedRole) !== normalize_role_name($authenticatedRole)) api_json(['error'=>'Choose the role assigned to this account.'],403);
unset($_SESSION['login_attempt_window'], $_SESSION['login_attempts'], $_SESSION['login_lock_until']);
session_regenerate_id(true);
$_SESSION['user_id']=(int)$user['UserID']; $_SESSION['user_name']=$user['FullName']; $_SESSION['user_role']=$user['Role'];
api_json(['success'=>true,'user'=>['id'=>(int)$user['UserID'],'name'=>$user['FullName'],'role'=>$user['Role']]]);
