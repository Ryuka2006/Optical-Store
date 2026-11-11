<?php
require_once __DIR__ . '/database.php';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = cashier_input();

function cashier_workspace(PDO $pdo): array {
    $customers = cashier_fetch_all($pdo, "SELECT c.CustomerID,c.FullName,c.Phone,c.Email,
      CASE WHEN p.PrescriptionID IS NULL THEN 'None' WHEN p.ExpiryDate<CURDATE() THEN 'Expired' ELSE 'Verified' END AS PrescriptionStatus,
      CASE WHEN e.ExaminationID IS NULL THEN NULL ELSE CONCAT(
        'OD ',COALESCE(e.RightEyeSPH,'—'),' / OS ',COALESCE(e.LeftEyeSPH,'—'),
        IF(e.PD IS NULL,'',CONCAT(', PD ',e.PD,' mm'))
      ) END AS LensPower
      FROM customer c
      LEFT JOIN (SELECT x.* FROM prescription x JOIN (SELECT CustomerID,MAX(PrescriptionID) id FROM prescription GROUP BY CustomerID) l ON l.id=x.PrescriptionID) p ON p.CustomerID=c.CustomerID
      LEFT JOIN eye_examination e ON e.ExaminationID=p.ExaminationID
      ORDER BY c.FullName");
    $products = cashier_fetch_all($pdo, "SELECT p.ProductID,p.ProductName,p.SKU,p.UnitPrice,p.StockQTy,p.ProductType,COALESCE(b.BrandName,'') AS Brand FROM product p LEFT JOIN brand b ON b.BrandID=p.BrandID WHERE p.Status IS NULL OR p.Status='Active' ORDER BY p.ProductName");
    $payments = cashier_fetch_all($pdo, "SELECT p.PaymentID,p.OrderID,p.PaymentDate,p.Method,p.Status,p.Amount,o.CustomerID,c.FullName FROM payment p LEFT JOIN sale_order o ON o.OrderID=p.OrderID LEFT JOIN customer c ON c.CustomerID=o.CustomerID ORDER BY p.PaymentDate DESC,p.PaymentID DESC LIMIT 200");
    $orders = cashier_fetch_all($pdo, "SELECT o.OrderID,o.OrderDate,o.CustomerID,o.Status,o.SubTotal,o.Discount,o.TotalAmount,c.FullName FROM sale_order o LEFT JOIN customer c ON c.CustomerID=o.CustomerID ORDER BY o.OrderDate DESC,o.OrderID DESC LIMIT 200");
    foreach ($orders as &$order) $order['Items']=cashier_fetch_all($pdo,'SELECT i.ProductID,i.Qty,i.UnitPrice,i.Discount,p.ProductName,p.SKU FROM sale_order_item i JOIN product p ON p.ProductID=i.ProductID WHERE i.OrderID=:id',[':id'=>$order['OrderID']]);
    $refunds = cashier_fetch_all($pdo, "SELECT r.RefundID,r.PaymentID,r.RefundDate,r.Status,r.Amount,p.OrderID,p.Method,o.CustomerID,c.FullName FROM refund r JOIN payment p ON p.PaymentID=r.PaymentID LEFT JOIN sale_order o ON o.OrderID=p.OrderID LEFT JOIN customer c ON c.CustomerID=o.CustomerID ORDER BY r.RefundDate DESC,r.RefundID DESC LIMIT 200");
    $summary = cashier_fetch_one($pdo, "SELECT COUNT(*) AS PaymentCount,COALESCE(SUM(CASE WHEN DATE(PaymentDate)=CURDATE() AND Status IN ('Completed','Partially Refunded') THEN Amount ELSE 0 END),0) AS CollectedToday,COALESCE(SUM(CASE WHEN DATE(PaymentDate)=CURDATE() THEN 1 ELSE 0 END),0) AS TransactionsToday FROM payment");
    return ['customers'=>$customers,'products'=>$products,'payments'=>$payments,'orders'=>$orders,'refunds'=>$refunds,'summary'=>$summary];
}

if ($method === 'GET') api_json(cashier_workspace($pdo));
if ($method !== 'POST') api_json(['error'=>'Method not allowed.'],405);
$action=$data['action']??'';

if ($action==='customer') {
    $name=trim((string)($data['name']??''));
    if($name==='')api_json(['error'=>'Customer name is required.'],422);
    $stmt=$pdo->prepare('INSERT INTO customer(FullName,Phone,Email,RegisterationDate) VALUES(:name,:phone,:email,CURDATE())');
    $stmt->execute([':name'=>$name,':phone'=>trim((string)($data['phone']??''))?:null,':email'=>trim((string)($data['email']??''))?:null]);
    api_json(['data'=>cashier_workspace($pdo)],201);
}

if ($action==='checkout') {
    $customerId=(int)($data['customerId']??0);$items=$data['items']??[];$methodName=trim((string)($data['method']??''));
    $methods=['Cash','Credit Card','Debit Card','Bank Transfer','QR Payment'];
    if(!$customerId||!is_array($items)||!count($items)||!in_array($methodName,$methods,true))api_json(['error'=>'Choose a customer, add products, and choose a payment method.'],422);
    if(empty($_SESSION['employee_id']))api_json(['error'=>'Your cashier account must be linked to an employee before processing sales. Ask an administrator to update your account.'],422);
    $pdo->beginTransaction();
    try {
        if(!cashier_fetch_one($pdo,'SELECT CustomerID FROM customer WHERE CustomerID=:id',[':id'=>$customerId]))throw new RuntimeException('Customer not found.');
        $cart=[];$subtotal=0;$discountTotal=0;
        foreach($items as $item){$productId=(int)($item['productId']??0);$qty=(int)($item['qty']??0);$discount=max(0,(float)($item['discount']??0));if(!$productId||$qty<1)throw new RuntimeException('Invalid cart item.');$product=cashier_fetch_one($pdo,'SELECT ProductID,ProductName,UnitPrice,StockQTy FROM product WHERE ProductID=:id FOR UPDATE',[':id'=>$productId]);if(!$product)throw new RuntimeException('A cart product no longer exists.');if((int)$product['StockQTy']<$qty)throw new RuntimeException($product['ProductName'].' does not have enough stock.');$discount=min($discount,(float)$product['UnitPrice']);$cart[]=[$product,$qty,$discount];$subtotal+=(float)$product['UnitPrice']*$qty;$discountTotal+=$discount*$qty;}
        $tax=round(max(0,$subtotal-$discountTotal)*0.10,2);$total=round($subtotal-$discountTotal+$tax,2);
        $stmt=$pdo->prepare("INSERT INTO sale_order(CustomerID,SalesStaffID,Status,SubTotal,Discount,TotalAmount) VALUES(:customer,:staff,'Completed',:subtotal,:discount,:total)");
        $stmt->execute([':customer'=>$customerId,':staff'=>(int)$_SESSION['employee_id'],':subtotal'=>$subtotal,':discount'=>$discountTotal,':total'=>$total]);$orderId=(int)$pdo->lastInsertId();
        foreach($cart as [$product,$qty,$discount]){$pdo->prepare('INSERT INTO sale_order_item(OrderID,ProductID,Qty,UnitPrice,Discount) VALUES(:order,:product,:qty,:price,:discount)')->execute([':order'=>$orderId,':product'=>$product['ProductID'],':qty'=>$qty,':price'=>$product['UnitPrice'],':discount'=>$discount]);$pdo->prepare('UPDATE product SET StockQTy=StockQTy-:qty WHERE ProductID=:id')->execute([':qty'=>$qty,':id'=>$product['ProductID']]);$pdo->prepare("INSERT INTO inventory(ProductID,EmployeeID,TransactionType,Qty) VALUES(:product,:employee,'Sale',:qty)")->execute([':product'=>$product['ProductID'],':employee'=>(int)$_SESSION['employee_id'],':qty'=>-$qty]);}
        $pdo->prepare("INSERT INTO payment(OrderID,CashierID,Method,Status,Amount) VALUES(:order,:cashier,:method,'Completed',:amount)")->execute([':order'=>$orderId,':cashier'=>(int)$_SESSION['employee_id'],':method'=>$methodName,':amount'=>$total]);
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();api_json(['error'=>$e->getMessage()],422);}
    api_json(['success'=>true,'orderId'=>$orderId,'data'=>cashier_workspace($pdo)],201);
}

if ($action==='refund') {
    $paymentId=(int)($data['paymentId']??0);$amount=round((float)($data['amount']??0),2);
    if(!$paymentId||$amount<=0)api_json(['error'=>'Choose a payment and enter a refund amount greater than zero.'],422);
    if(empty($_SESSION['employee_id']))api_json(['error'=>'Your cashier account must be linked to an employee before processing refunds.'],422);
    $pdo->beginTransaction();
    try {
        $payment=cashier_fetch_one($pdo,'SELECT PaymentID,OrderID,Status,Amount FROM payment WHERE PaymentID=:id FOR UPDATE',[':id'=>$paymentId]);
        if(!$payment||$payment['Status']==='Refunded')throw new RuntimeException('Payment not found or already fully refunded.');
        $stmt=$pdo->prepare('SELECT COALESCE(SUM(Amount),0) FROM refund WHERE PaymentID=:id');$stmt->execute([':id'=>$paymentId]);$prior=(float)$stmt->fetchColumn();
        $remaining=round((float)$payment['Amount']-$prior,2);if($amount>$remaining)throw new RuntimeException('Refund amount exceeds the remaining paid balance of $'.number_format($remaining,2).'.');
        $full=abs(($prior+$amount)-(float)$payment['Amount'])<0.005;
        $pdo->prepare("INSERT INTO refund(PaymentID,CashierID,Status,Amount) VALUES(:payment,:cashier,'Completed',:amount)")->execute([':payment'=>$paymentId,':cashier'=>(int)$_SESSION['employee_id'],':amount'=>$amount]);
        if($full){$pdo->prepare("UPDATE payment SET Status='Refunded' WHERE PaymentID=:id")->execute([':id'=>$paymentId]);$pdo->prepare("UPDATE sale_order SET Status='Refunded' WHERE OrderID=:id")->execute([':id'=>$payment['OrderID']]);$items=cashier_fetch_all($pdo,'SELECT ProductID,Qty FROM sale_order_item WHERE OrderID=:id',[':id'=>$payment['OrderID']]);foreach($items as $item){$pdo->prepare('UPDATE product SET StockQTy=StockQTy+:qty WHERE ProductID=:id')->execute([':qty'=>$item['Qty'],':id'=>$item['ProductID']]);$pdo->prepare("INSERT INTO inventory(ProductID,EmployeeID,TransactionType,Qty) VALUES(:product,:employee,'Refund',:qty)")->execute([':product'=>$item['ProductID'],':employee'=>(int)$_SESSION['employee_id'],':qty'=>$item['Qty']]);}}
        else $pdo->prepare("UPDATE payment SET Status='Partially Refunded' WHERE PaymentID=:id")->execute([':id'=>$paymentId]);
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();api_json(['error'=>$e->getMessage()],422);}
    api_json(['success'=>true,'data'=>cashier_workspace($pdo)],201);
}

api_json(['error'=>'Unknown cashier action.'],400);
