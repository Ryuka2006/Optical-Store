<?php 
try {
  include_once 'database.php';

  $method = $_SERVER['REQUEST_METHOD'];

    if($method=='GET'){
  if(isset($_GET['id']) && $_GET['id']!=''){
     $sql = "SELECT * FROM customer WHERE CustomerID=:param1";
     $stmt = $pdo->prepare($sql);
     $stmt->bindParam(":param1", $_GET['id'], PDO::PARAM_INT);
     $stmt->execute();
     $respond = $stmt->fetch(PDO::FETCH_ASSOC);
     echo json_encode($respond);
  }else{
     $sql = "SELECT * FROM customer ORDER BY CustomerID";
     $stmt = $pdo->prepare($sql);
     $stmt->execute();
     $respond = $stmt->fetchAll(PDO::FETCH_ASSOC);
     echo json_encode($respond);
  }
}

    if($method=='POST'){
   $sql = "INSERT INTO customer (CustomerID, FullName, Gender, DateOfBirth, Phone, Email, RegisterationDate, Address) VALUES(:param1, :param2, :param3, :param4, :param5, :param6, :param7, :param8 )";
   $stmt = $pdo->prepare($sql);
   $stmt->bindParam(":param1", $_POST['id'], PDO::PARAM_INT);
   $stmt->bindParam(":param2", $_POST['fname'], PDO::PARAM_STR);
   $stmt->bindParam(":param3", $_POST['gen'], PDO::PARAM_STR);
   $stmt->bindParam(":param4", $_POST['dob'], PDO::PARAM_STR);
   $stmt->bindParam(":param5", $_POST['phone'], PDO::PARAM_STR);
   $stmt->bindParam(":param6", $_POST['email'], PDO::PARAM_STR);
   $stmt->bindParam(":param7", $_POST['rgdate'], PDO::PARAM_STR);
   $stmt->bindParam(":param8", $_POST['address'], PDO::PARAM_STR);
   $stmt->execute();

   $lastid = $pdo->lastInsertId();
   $sql = "SELECT * FROM customer WHERE CustomerID=:param1";
   $stmt = $pdo->prepare($sql);
   $stmt->bindParam(":param1", $lastid, PDO::PARAM_INT);
   $stmt->execute();
   $respond = $stmt->fetch(PDO::FETCH_ASSOC);
   echo json_encode($respond);
}

    if($method=='PUT'){

    parse_str(file_get_contents('php://input'), $post_input);
    $sql = "UPDATE customer SET FullName=:param2, Gender=:param3, DateOfBirth=:param4, Phone=:param5, Email=:param6, RegisterationDate=:param7, Address=:param8 WHERE CustomerID=:param1";
    $stmt = $pdo->prepare($sql);
   $stmt->bindParam(":param1", $post_input['id'], PDO::PARAM_INT);
   $stmt->bindParam(":param2", $post_input['fname'], PDO::PARAM_STR);
   $stmt->bindParam(":param3", $post_input['gen'], PDO::PARAM_STR);
   $stmt->bindParam(":param4", $post_input['dob'], PDO::PARAM_STR);
   $stmt->bindParam(":param5", $post_input['phone'], PDO::PARAM_STR);
   $stmt->bindParam(":param6", $post_input['email'], PDO::PARAM_STR);
   $stmt->bindParam(":param7", $post_input['rgdate'], PDO::PARAM_STR);
   $stmt->bindParam(":param8", $post_input['address'], PDO::PARAM_STR);
    $stmt->execute();

    $sql = "SELECT * FROM customer WHERE CustomerID=:param1";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(":param1", $post_input['id'], PDO::PARAM_INT);
    $stmt->execute();
    $respond = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode($respond);
}

    if($method=='DELETE'){
   parse_str(file_get_contents('php://input'), $post_input);
   $sql = "DELETE FROM customer WHERE CustomerID=:param1";
   $stmt = $pdo->prepare($sql);
   $stmt->bindParam(":param1", $post_input['id'], PDO::PARAM_INT);
   $stmt->execute();
   $af = $stmt->rowCount();
   echo json_encode($af." Row(s) deleted!");
}


} catch (PDOException $e) {
    echo json_encode( $e->getMessage() );
}

?>