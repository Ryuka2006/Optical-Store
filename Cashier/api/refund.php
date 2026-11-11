<?php
try {

    include_once 'database.php';

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method == 'GET') {
        if (isset($_GET['id']) && $_GET['id'] != '') {
            $sql = "SELECT * FROM refund WHERE RefundID=:param1";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(":param1", $_GET['id'], PDO::PARAM_INT);
            $stmt->execute();
            $respond = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode($respond);
        } else {
            $sql = "SELECT * FROM refund ORDER BY RefundID";
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $respond = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($respond);
        }
    }
    if ($method == 'POST') {
        $sql = "INSERT INTO refund (RefundID, PaymendID, CashierID, RefundDate, Status, Amount) VALUES(:param1, :param2, :param3, :param4, :param5, :param6)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(":param1", $_POST['id'], PDO::PARAM_INT);
        $stmt->bindParam(":param2", $_POST['pid'], PDO::PARAM_INT);
        $stmt->bindParam(":param3", $_POST['cid'], PDO::PARAM_INT);
        $stmt->bindParam(":param4", $_POST['rdate'], PDO::PARAM_STR);
        $stmt->bindParam(":param5", $_POST['status'], PDO::PARAM_STR);
        $stmt->bindParam(":param6", $_POST['amount'], PDO::PARAM_STR);
        $stmt->execute();
        $lastid = $pdo->lastInsertId();
        $sql = "SELECT * FROM refund WHERE RefundID=:param1";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(":param1", $lastid, PDO::PARAM_INT);
        $stmt->execute();
        $respond = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode($respond);
    }
    if ($method == 'PUT') {
        parse_str(file_get_contents('php://input'), $post_input);
        $sql = "UPDATE refund SET PaymendID=:param2, CashierID=:param3, RefundDate = :param4, Status=:param5, Amount=:param6 WHERE RefundID=:param1";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(":param1", $post_input['id'], PDO::PARAM_INT);
        $stmt->bindParam(":param2", $post_input['pid'], PDO::PARAM_INT);
        $stmt->bindParam(":param3", $post_input['cid'], PDO::PARAM_INT);
        $stmt->bindParam(":param4", $post_input['rdate'], PDO::PARAM_STR);
        $stmt->bindParam(":param5", $post_input['status'], PDO::PARAM_STR);
        $stmt->bindParam(":param6", $post_input['amount'], PDO::PARAM_STR);
        $stmt->execute();
        $sql = "SELECT * FROM refund WHERE RefundID=:param1";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(":param1", $post_input['id'], PDO::PARAM_INT);
        $stmt->execute();
        $respond = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode($respond);
    }
    if ($method == 'DELETE') {
        parse_str(file_get_contents('php://input'), $post_input);
        $sql = "DELETE FROM refund WHERE RefundID=:param1";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(":param1", $post_input['id'], PDO::PARAM_INT);
        $stmt->execute();
        $af = $stmt->rowCount();
        echo json_encode($af . " Row(s) deleted!");
    }
} catch (PDOException $e) {
    echo json_encode($e->getMessage());
}
?>