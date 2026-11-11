<?php
try {
                                          
 include_once 'database.php';
                                     
 $method = $_SERVER['REQUEST_METHOD'];
                       
 if($method=='GET'){
 if(isset($_GET['id']) && $_GET['id']!=''){
 $sql = "SELECT * FROM sale_oder_item WHERE OrderItemID=:param1";
 $stmt = $pdo->prepare($sql);
 $stmt->bindParam(":param1", $_GET['id'], PDO::PARAM_INT);
 $stmt->execute();
 $respond = $stmt->fetch(PDO::FETCH_ASSOC);
 echo json_encode($respond);
 }else{
 $sql = "SELECT * FROM sale_oder_item ORDER BY OrderItemID";
 $stmt = $pdo->prepare($sql);
 $stmt->execute();
 $respond = $stmt->fetchAll(PDO::FETCH_ASSOC);
 echo json_encode($respond);
 }
}

 if($method=='POST'){
$sql = "INSERT INTO sale_oder_item (OrderItemID, OrderID, ProductID, Qty, UnitPrice, Discount) VALUES(:param1, :param2, :param3, :param4, :param5, :param6)";
$stmt = $pdo->prepare($sql);
$stmt->bindParam(":param1", $_POST['id'], PDO::PARAM_INT);
$stmt->bindParam(":param2", $_POST['orderid'], PDO::PARAM_INT);
$stmt->bindParam(":param3", $_POST['productid'], PDO::PARAM_INT);
$stmt->bindParam(":param4", $_POST['qty'], PDO::PARAM_INT);
$stmt->bindParam(":param5", $_POST['uprice'], PDO::PARAM_STR);
$stmt->bindParam(":param6", $_POST['discount'], PDO::PARAM_STR);
$stmt->execute();
                                                 
$lastid = $pdo->lastInsertId();
$sql = "SELECT * FROM sale_oder_item WHERE OrderItemID=:param1";
$stmt = $pdo->prepare($sql);
$stmt->bindParam(":param1", $lastid, PDO::PARAM_INT);
$stmt->execute();
$respond = $stmt->fetch(PDO::FETCH_ASSOC);
echo json_encode($respond);
}

 if($method=='PUT'){
                              
 parse_str(file_get_contents('php://input'), $post_input);
 $sql = "UPDATE sale_oder_item SET OrderID=:param2, ProductID=:param3, Qty = :param4, UnitPrice=:param5, Discount=:param6 WHERE OrderItemID=:param1";
 $stmt = $pdo->prepare($sql);
 $stmt->bindParam(":param1", $post_input['id'], PDO::PARAM_INT);
 $stmt->bindParam(":param2", $post_input['orderid'], PDO::PARAM_INT);
 $stmt->bindParam(":param3", $post_input['productid'], PDO::PARAM_INT);
 $stmt->bindParam(":param4", $post_input['qty'], PDO::PARAM_INT);
 $stmt->bindParam(":param5", $post_input['uprice'], PDO::PARAM_STR);
 $stmt->bindParam(":param6", $post_input['discount'], PDO::PARAM_STR);
 $stmt->execute();
                                                
 $sql = "SELECT * FROM sale_oder_item WHERE OrderItemID=:param1";
 $stmt = $pdo->prepare($sql);
 $stmt->bindParam(":param1", $post_input['id'], PDO::PARAM_INT);
 $stmt->execute();
 $respond = $stmt->fetch(PDO::FETCH_ASSOC);
 echo json_encode($respond);
}

 if($method=='DELETE'){
parse_str(file_get_contents('php://input'), $post_input);
$sql = "DELETE FROM sale_oder_item WHERE OrderItemID=:param1";
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