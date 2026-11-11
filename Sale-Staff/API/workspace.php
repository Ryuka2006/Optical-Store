<?php
require_once __DIR__ . '/database.php';

$method = $_SERVER['REQUEST_METHOD'];
$data = input();

function workspaceData(PDO $pdo): array {
    $hasPrescriptionStatus = hasColumn($pdo, 'prescription', 'Status');
    $hasLensPower = hasColumn($pdo, 'prescription', 'LensPower');
    $hasAppointmentType = hasColumn($pdo, 'appointment', 'AppointmentType');
    $examinationDetails = "CASE WHEN e.ExaminationID IS NULL THEN NULL ELSE CONCAT('OD ',COALESCE(e.RightEyeSPH,'N/A'),' / OS ',COALESCE(e.LeftEyeSPH,'N/A'),IF(e.PD IS NULL,'',CONCAT(', PD ',e.PD,' mm'))) END";
    $prescriptionDetails = $hasLensPower ? "COALESCE(rx.LensPower,$examinationDetails)" : $examinationDetails;
    $pendingReview = $hasPrescriptionStatus ? "WHEN rx.Status='Pending Sign-off' THEN 'Pending Review' " : '';
    $appointmentType = $hasAppointmentType ? 'a.AppointmentType' : "'Appointment'";
    $doctors = fetchAllRows($pdo, "SELECT e.EmployeeID AS id,e.FullName AS name FROM employee e JOIN role r ON r.RoleID=e.RoleID WHERE r.RoleName='Optometrist' ORDER BY e.FullName");
    $customers = fetchAllRows($pdo, "SELECT c.CustomerID AS id,c.FullName AS name,c.Phone AS phone,c.Email AS email,
      CASE WHEN rx.PrescriptionID IS NULL THEN 'None' {$pendingReview} WHEN rx.ExpiryDate IS NOT NULL AND rx.ExpiryDate < CURDATE() THEN 'Expired' ELSE 'Verified' END AS rxStatus,
      {$prescriptionDetails} AS rx
      FROM customer c LEFT JOIN (SELECT p.* FROM prescription p JOIN (SELECT CustomerID,MAX(PrescriptionID) pid FROM prescription GROUP BY CustomerID) x ON x.pid=p.PrescriptionID) rx ON rx.CustomerID=c.CustomerID
      LEFT JOIN eye_examination e ON e.ExaminationID=rx.ExaminationID ORDER BY c.FullName");
    $products = fetchAllRows($pdo, "SELECT p.ProductID AS id,COALESCE(b.BrandName,'United Optic') AS brand,p.ProductName AS name,p.SKU AS sku,p.UnitPrice AS price,p.StockQTy AS stock,p.ProductType AS cat,p.Img AS image,'' AS frame,'' AS lens FROM product p LEFT JOIN brand b ON b.BrandID=p.BrandID WHERE p.Status IS NULL OR p.Status='Active' ORDER BY p.ProductName");
    $appointments = fetchAllRows($pdo, "SELECT a.AppointmentID AS id,a.CustomerID AS cust,COALESCE(e.FullName,'Optometrist') AS doctor,{$appointmentType} AS type,a.AppointmentDate AS date,TIME_FORMAT(a.AppointmentTime,'%H:%i') AS time,a.Status AS status FROM appointment a LEFT JOIN employee e ON e.EmployeeID=a.OptometristID ORDER BY a.AppointmentDate,a.AppointmentTime");
    $orders = fetchAllRows($pdo, "SELECT o.OrderID AS id,o.CustomerID AS cust,DATE_FORMAT(o.OrderDate,'%b %e, %Y') AS date,o.Status AS status,o.TotalAmount AS total FROM sale_order o ORDER BY o.OrderDate DESC");
    foreach ($customers as &$customer) $customer['id']=(string)$customer['id'];
    foreach ($products as &$product) $product['id']=(string)$product['id'];
    foreach ($appointments as &$appointment) { $appointment['id']=(string)$appointment['id']; $appointment['cust']=(string)$appointment['cust']; }
    foreach ($orders as &$order) {
      $order['id']='SO-'.$order['id'];
      $items=fetchAllRows($pdo,'SELECT ProductID AS pid,Qty AS qty,UnitPrice AS price,Discount AS discount FROM sale_order_item WHERE OrderID=:id',[':id'=>(int)substr($order['id'],3)]);
      $order['items']=array_map(function($i){$i['pid']=(string)$i['pid'];$i['qty']=(int)$i['qty'];return $i;},$items);
      $order['cust']=(string)$order['cust'];
    }
    foreach ($doctors as &$doctor) $doctor['id']=(string)$doctor['id'];
    return ['customers'=>$customers,'products'=>$products,'appointments'=>$appointments,'orders'=>$orders,'doctors'=>$doctors,'features'=>['appointmentType'=>$hasAppointmentType]];
}
if ($method === 'GET') respond(workspaceData($pdo));
if ($method !== 'POST') fail('Method not allowed',405);
$action=$data['action']??'';
if ($action==='customer') {
  $id=(int)($data['id']??0); $name=trim($data['name']??''); if($name==='') fail('Customer name is required');
  if($id){$s=$pdo->prepare('UPDATE customer SET FullName=:n,Phone=:p,Email=:e WHERE CustomerID=:i');$s->execute([':n'=>$name,':p'=>$data['phone']??null,':e'=>$data['email']??null,':i'=>$id]);}
  else {$s=$pdo->prepare('INSERT INTO customer (FullName,Phone,Email,RegisterationDate) VALUES (:n,:p,:e,CURDATE())');$s->execute([':n'=>$name,':p'=>$data['phone']??null,':e'=>$data['email']??null]);$id=(int)$pdo->lastInsertId();}
  respond(['ok'=>true,'data'=>workspaceData($pdo)]);
}
if ($action==='order') {
  $customer=(int)($data['customer']??0);$items=$data['items']??[];$status=$data['status']??'Draft';
  $allowed=['Draft','Reserved','Processing','Ready for Payment','Completed','Cancelled']; if(!$customer||!$items||!in_array($status,$allowed,true)) fail('A customer, items, and valid status are required');
  $pdo->beginTransaction();
  try {$subtotal=0;$locked=[];foreach($items as $item){$pid=(int)$item['pid'];$qty=(int)$item['qty'];if($qty<1)throw new RuntimeException('Invalid item quantity');$p=fetchOne($pdo,'SELECT UnitPrice,StockQTy FROM product WHERE ProductID=:id FOR UPDATE',[':id'=>$pid]);if(!$p)throw new RuntimeException('Product not found');if($status!=='Draft' && (int)$p['StockQTy']<$qty)throw new RuntimeException('Insufficient stock');$locked[]=[$pid,$qty];$subtotal+=(float)$p['UnitPrice']*$qty;}
    $s=$pdo->prepare('INSERT INTO sale_order(CustomerID,SalesStaffID,Status,SubTotal,Discount,TotalAmount) VALUES(:c,:staff,:st,:sub,0,:total)');$s->execute([':c'=>$customer,':staff'=>$_SESSION['employee_id']??null,':st'=>$status,':sub'=>$subtotal,':total'=>$subtotal]);$oid=(int)$pdo->lastInsertId();
    foreach($locked as [$pid,$qty]){$p=fetchOne($pdo,'SELECT UnitPrice FROM product WHERE ProductID=:id',[':id'=>$pid]);$pdo->prepare('INSERT INTO sale_order_item(OrderID,ProductID,Qty,UnitPrice,Discount) VALUES(:o,:p,:q,:u,0)')->execute([':o'=>$oid,':p'=>$pid,':q'=>$qty,':u'=>$p['UnitPrice']]);if($status!=='Draft'){$pdo->prepare('UPDATE product SET StockQTy=StockQTy-:q WHERE ProductID=:p')->execute([':q'=>$qty,':p'=>$pid]);$pdo->prepare("INSERT INTO inventory(ProductID,EmployeeID,TransactionType,Qty) VALUES(:p,:employee,'Sale',:q)")->execute([':p'=>$pid,':employee'=>$_SESSION['employee_id']??null,':q'=>-$qty]);}}
    $pdo->commit();
  }catch(Throwable $e){$pdo->rollBack();fail($e->getMessage());}
  respond(['ok'=>true,'data'=>workspaceData($pdo)],201);
}
if ($action==='status') {
  $id=(int)($data['id']??0);$status=$data['status']??'';$allowed=['Draft','Reserved','Processing','Ready for Payment','Cancelled'];if(!$id||!in_array($status,$allowed,true))fail('Invalid order status');
  $pdo->beginTransaction();
  try {
    $o=fetchOne($pdo,'SELECT Status FROM sale_order WHERE OrderID=:i FOR UPDATE',[':i'=>$id]);
    if(!$o) throw new RuntimeException('Order not found');
    $was=$o['Status'];
    if($was==='Completed') throw new RuntimeException('Completed sales are final; use the payment or refund workflow');
    $holdsStock=['Reserved','Processing','Ready for Payment','Completed'];
    $deduct=!in_array($was,$holdsStock,true)&&in_array($status,$holdsStock,true);
    $restore=in_array($was,$holdsStock,true)&&!in_array($status,$holdsStock,true);
    $items=fetchAllRows($pdo,'SELECT ProductID,Qty FROM sale_order_item WHERE OrderID=:i',[':i'=>$id]);
    if($deduct||$restore) foreach($items as $i) {
      if($deduct) {
        $s=$pdo->prepare('UPDATE product SET StockQTy=StockQTy-:qty WHERE ProductID=:p AND StockQTy>=:need');
        $s->execute([':qty'=>$i['Qty'],':need'=>$i['Qty'],':p'=>$i['ProductID']]);
        if(!$s->rowCount()) throw new RuntimeException('Insufficient stock to reserve order');
      } else {
        $pdo->prepare('UPDATE product SET StockQTy=StockQTy+:q WHERE ProductID=:p')->execute([':q'=>$i['Qty'],':p'=>$i['ProductID']]);
      }
      $pdo->prepare('INSERT INTO inventory(ProductID,EmployeeID,TransactionType,Qty) VALUES(:p,:employee,:t,:q)')
        ->execute([':p'=>$i['ProductID'],':employee'=>$_SESSION['employee_id']??null,':t'=>$deduct?'Sale':'Sale cancellation',':q'=>$deduct?-$i['Qty']:$i['Qty']]);
    }
    $pdo->prepare('UPDATE sale_order SET Status=:s WHERE OrderID=:i')->execute([':s'=>$status,':i'=>$id]);
    $pdo->commit();
  } catch(Throwable $e) { $pdo->rollBack(); fail($e->getMessage()); }
  respond(['ok'=>true,'data'=>workspaceData($pdo)]);
}
if ($action==='payment') {
  $id=(int)($data['id']??0);$method=$data['method']??'';
  if(!$id||!in_array($method,['Cash','Card','Mobile payment'],true)) fail('Select a valid payment method');
  $pdo->beginTransaction();
  try {
    $order=fetchOne($pdo,'SELECT Status,TotalAmount FROM sale_order WHERE OrderID=:i FOR UPDATE',[':i'=>$id]);
    if(!$order) throw new RuntimeException('Order not found');
    if($order['Status']!=='Ready for Payment') throw new RuntimeException('This order is not ready for payment');
    $pdo->prepare("INSERT INTO payment(OrderID,Method,Status,Amount) VALUES(:i,:m,'Completed',:a)")
      ->execute([':i'=>$id,':m'=>$method,':a'=>$order['TotalAmount']]);
    $pdo->prepare("UPDATE sale_order SET Status='Completed' WHERE OrderID=:i")->execute([':i'=>$id]);
    $pdo->commit();
  } catch(Throwable $e) { $pdo->rollBack(); fail($e->getMessage()); }
  respond(['ok'=>true,'data'=>workspaceData($pdo)]);
}
if ($action==='appointment') {
 $id=(int)($data['id']??0);$customer=(int)($data['customer']??0);$date=$data['date']??'';$time=$data['time']??'';$type=$data['type']??'Routine Eye Exam';if(!$date||!$time)fail('Date and time are required');
 if($id){$pdo->prepare('UPDATE appointment SET AppointmentDate=:d,AppointmentTime=:t,Status=\'Scheduled\' WHERE AppointmentID=:i')->execute([':d'=>$date,':t'=>$time,':i'=>$id]);}else{if(!$customer)fail('Customer is required');$doctor=isset($data['doctor'])?(int)$data['doctor']:null;if(hasColumn($pdo,'appointment','AppointmentType')){$pdo->prepare('INSERT INTO appointment(CustomerID,OptometristID,AppointmentDate,AppointmentTime,AppointmentType,Status) VALUES(:c,:o,:d,:t,:ty,\'Scheduled\')')->execute([':c'=>$customer,':o'=>$doctor?:null,':d'=>$date,':t'=>$time,':ty'=>$type]);}else{$pdo->prepare('INSERT INTO appointment(CustomerID,OptometristID,AppointmentDate,AppointmentTime,Status) VALUES(:c,:o,:d,:t,\'Scheduled\')')->execute([':c'=>$customer,':o'=>$doctor?:null,':d'=>$date,':t'=>$time]);}}respond(['ok'=>true,'data'=>workspaceData($pdo)]);
}
if ($action==='appointment_status') {$id=(int)($data['id']??0);$status=$data['status']??'';if(!in_array($status,['Scheduled','Confirmed','Completed','Cancelled'],true))fail('Invalid appointment status');$pdo->prepare('UPDATE appointment SET Status=:s WHERE AppointmentID=:i')->execute([':s'=>$status,':i'=>$id]);respond(['ok'=>true,'data'=>workspaceData($pdo)]);}
fail('Unknown action');
