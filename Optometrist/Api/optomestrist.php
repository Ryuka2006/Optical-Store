<?php
                                                     
                                             
                                                    
                                                                
require_once 'database.php';
$method = $_SERVER['REQUEST_METHOD'];
$data   = input();
$userId = (int)($_SESSION['user_id'] ?? 0);
if (!$userId) fail('Please log in to continue.', 401);
$profile = fetchOne($pdo, 'SELECT e.EmployeeID AS OptomestristID,e.FullName,r.RoleName AS Role,NULL AS Room FROM `user` u JOIN employee e ON e.EmployeeID=u.EmployeeID LEFT JOIN role r ON r.RoleID=u.RoleID WHERE u.UserID=:id', [':id' => $userId]);
if (!$profile) fail('Optometrist employee profile not found.', 404);

switch ($method) {
    case 'GET':
        respond($profile);

    case 'PUT':
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') fail('Name is required.');
        $pdo->prepare('UPDATE employee SET FullName=:name WHERE EmployeeID=:id')->execute([':name' => $name, ':id' => $profile['OptomestristID']]);
        $profile['FullName'] = $name;
        respond($profile);

    default:
        fail('Method not allowed', 405);
}