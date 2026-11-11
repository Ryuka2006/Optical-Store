<?php
require_once __DIR__ . '/guard.php'; api_security_headers(); require_login();
api_require_methods(['GET','POST','PUT','DELETE']);
try {
	include_once 'database.php';

	$method = $_SERVER['REQUEST_METHOD'];

    if($method=='GET'){
  if(isset($_GET['id']) && $_GET['id']!=''){
     $sql = "SELECT * FROM role WHERE RoleID=:param1";
     $stmt = $pdo->prepare($sql);
     $stmt->bindParam(":param1", $_GET['id'], PDO::PARAM_INT);
     $stmt->execute();
     $respond = $stmt->fetch(PDO::FETCH_ASSOC);
     echo json_encode($respond);
  }else{
     $sql = "SELECT * FROM role ORDER BY RoleName";
     $stmt = $pdo->prepare($sql);
     $stmt->execute();
     $respond = $stmt->fetchAll(PDO::FETCH_ASSOC);
     echo json_encode($respond);
  }
}

    if($method=='POST'){
   $sql = "INSERT INTO role (RoleID, RoleName) VALUES(:param1, :param2)";
   $stmt = $pdo->prepare($sql);
   $stmt->bindParam(":param1", $_POST['id'], PDO::PARAM_INT);
   $stmt->bindParam(":param2", $_POST['rname'], PDO::PARAM_STR);
   $stmt->execute();

   $lastid = $pdo->lastInsertId();
   $sql = "SELECT * FROM role WHERE RoleID=:param1";
   $stmt = $pdo->prepare($sql);
   $stmt->bindParam(":param1", $lastid, PDO::PARAM_INT);
   $stmt->execute();
   $respond = $stmt->fetch(PDO::FETCH_ASSOC);
   echo json_encode($respond);
}

    if($method=='PUT'){

    parse_str(file_get_contents('php://input'), $post_input);
    $sql = "UPDATE role SET RoleName=:param2 WHERE RoleID=:param1";
    $stmt = $pdo->prepare($sql);
   $stmt->bindParam(":param1", $post_input['id'], PDO::PARAM_INT);
   $stmt->bindParam(":param2", $post_input['rname'], PDO::PARAM_STR);
    $stmt->execute();

    $sql = "SELECT * FROM role WHERE RoleID=:param1";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(":param1", $post_input['id'], PDO::PARAM_INT);
    $stmt->execute();
    $respond = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode($respond);
}

    if($method=='DELETE'){
   parse_str(file_get_contents('php://input'), $post_input);
   $sql = "DELETE FROM role WHERE RoleID=:param1";
   $stmt = $pdo->prepare($sql);
   $stmt->bindParam(":param1", $post_input['id'], PDO::PARAM_INT);
   $stmt->execute();
   $af = $stmt->rowCount();
   echo json_encode($af." Row(s) deleted!");
}


} catch (PDOException $e) {
    error_log('Roles API database error: ' . $e->getMessage());
    http_response_code($e->getCode() === '23000' ? 409 : 500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $e->getCode() === '23000' ? 'The role conflicts with existing records.' : 'Could not complete the role request.']);
}

?>
