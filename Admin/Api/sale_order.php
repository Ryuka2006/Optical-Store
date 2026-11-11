<?php
declare(strict_types=1);
require_once __DIR__ . '/guard.php';
api_security_headers();
api_require_methods(['GET', 'POST']);
require_login();
require_once __DIR__ . '/database.php';

function sale_order_record(PDO $pdo, int $id): ?array {
    $stmt = $pdo->prepare(
        'SELECT o.*, c.FullName AS CustomerName, e.FullName AS SalesStaffName,
                (SELECT p.Status FROM payment p WHERE p.OrderID = o.OrderID ORDER BY p.PaymentID DESC LIMIT 1) AS PaymentStatus,
                (SELECT p.Method FROM payment p WHERE p.OrderID = o.OrderID ORDER BY p.PaymentID DESC LIMIT 1) AS PaymentMethod
           FROM sale_order o
           LEFT JOIN customer c ON c.CustomerID = o.CustomerID
           LEFT JOIN employee e ON e.EmployeeID = o.SalesStaffID
          WHERE o.OrderID = :id'
    );
    $stmt->execute([':id' => $id]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$order) return null;
    $items = $pdo->prepare('SELECT i.OrderItemID, i.ProductID, p.ProductName, p.SKU, i.Qty, i.UnitPrice, i.Discount FROM sale_order_item i JOIN product p ON p.ProductID = i.ProductID WHERE i.OrderID = :id ORDER BY i.OrderItemID');
    $items->execute([':id' => $id]);
    $order['Items'] = $items->fetchAll(PDO::FETCH_ASSOC);
    return $order;
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        if (isset($_GET['id']) && $_GET['id'] !== '') {
            if (!ctype_digit((string)$_GET['id'])) api_json(['error' => 'Invalid sale ID.'], 422);
            $order = sale_order_record($pdo, (int)$_GET['id']);
            if (!$order) api_json(['error' => 'Sale not found.'], 404);
            api_json($order);
        }
        $stmt = $pdo->query(
            'SELECT o.OrderID, o.OrderDate, o.CustomerID, c.FullName AS CustomerName,
                    o.SalesStaffID, e.FullName AS SalesStaffName, o.Status, o.SubTotal, o.Discount, o.TotalAmount,
                    (SELECT p.Status FROM payment p WHERE p.OrderID = o.OrderID ORDER BY p.PaymentID DESC LIMIT 1) AS PaymentStatus,
                    (SELECT p.Method FROM payment p WHERE p.OrderID = o.OrderID ORDER BY p.PaymentID DESC LIMIT 1) AS PaymentMethod
               FROM sale_order o
               LEFT JOIN customer c ON c.CustomerID = o.CustomerID
               LEFT JOIN employee e ON e.EmployeeID = o.SalesStaffID
              ORDER BY o.OrderDate DESC, o.OrderID DESC'
        );
        api_json($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    $input = api_read_input();
    $customer = $input['CustomerID'] ?? '';
    $staff = $input['SalesStaffID'] ?? '';
    $discount = $input['Discount'] ?? '0';
    $method = trim((string)($input['Method'] ?? ''));
    $items = $input['Items'] ?? null;
    if ($customer !== '' && (!is_scalar($customer) || !ctype_digit((string)$customer))) api_json(['error' => 'Select a valid customer or leave it blank for a walk-in sale.'], 422);
    if ($staff !== '' && (!is_scalar($staff) || !ctype_digit((string)$staff))) api_json(['error' => 'Select a valid sales employee.'], 422);
    if (!is_numeric($discount) || (float)$discount < 0) api_json(['error' => 'Discount must be a non-negative amount.'], 422);
    if (!in_array($method, ['Cash', 'Card', 'Mobile Payment', 'Insurance'], true)) api_json(['error' => 'Choose a valid payment method.'], 422);
    if (!is_array($items) || count($items) < 1 || count($items) > 30) api_json(['error' => 'Add between 1 and 30 sale items.'], 422);
    if ($customer !== '') {
        $check = $pdo->prepare('SELECT 1 FROM customer WHERE CustomerID = :id'); $check->execute([':id' => (int)$customer]);
        if (!$check->fetchColumn()) api_json(['error' => 'The selected customer does not exist.'], 422);
    }
    if ($staff !== '') {
        $check = $pdo->prepare('SELECT 1 FROM employee WHERE EmployeeID = :id'); $check->execute([':id' => (int)$staff]);
        if (!$check->fetchColumn()) api_json(['error' => 'The selected sales employee does not exist.'], 422);
    }

    $pdo->beginTransaction();
    $cart = [];
    $subtotal = 0.0;
    $productQuery = $pdo->prepare('SELECT ProductName, UnitPrice, StockQTy, Status FROM product WHERE ProductID = :id FOR UPDATE');
    foreach ($items as $item) {
        $productId = $item['ProductID'] ?? '';
        $qty = $item['Qty'] ?? '';
        if (!is_scalar($productId) || !ctype_digit((string)$productId) || !is_scalar($qty) || !ctype_digit((string)$qty) || (int)$qty < 1) {
            $pdo->rollBack(); api_json(['error' => 'Each sale item needs a valid product and positive whole-number quantity.'], 422);
        }
        $productQuery->execute([':id' => (int)$productId]);
        $product = $productQuery->fetch(PDO::FETCH_ASSOC);
        if (!$product) { $pdo->rollBack(); api_json(['error' => 'One of the selected products no longer exists.'], 409); }
        if (strtolower((string)$product['Status']) !== 'active') { $pdo->rollBack(); api_json(['error' => $product['ProductName'] . ' is inactive and cannot be sold.'], 422); }
        if ((int)$product['StockQTy'] < (int)$qty) { $pdo->rollBack(); api_json(['error' => 'Not enough stock for ' . $product['ProductName'] . '.'], 422); }
        $unit = (float)$product['UnitPrice'];
        $subtotal += $unit * (int)$qty;
        $cart[] = ['id' => (int)$productId, 'qty' => (int)$qty, 'price' => $unit];
    }
    if ((float)$discount > $subtotal) { $pdo->rollBack(); api_json(['error' => 'Discount cannot exceed the subtotal.'], 422); }
    $total = round($subtotal - (float)$discount, 2);

    $stmt = $pdo->prepare("INSERT INTO sale_order (OrderDate, CustomerID, SalesStaffID, Status, SubTotal, Discount, TotalAmount) VALUES (NOW(), :customer, :staff, 'Completed', :subtotal, :discount, :total)");
    $stmt->execute([':customer' => $customer === '' ? null : (int)$customer, ':staff' => $staff === '' ? null : (int)$staff, ':subtotal' => $subtotal, ':discount' => (float)$discount, ':total' => $total]);
    $orderId = (int)$pdo->lastInsertId();
    $insertItem = $pdo->prepare('INSERT INTO sale_order_item (OrderID, ProductID, Qty, UnitPrice, Discount) VALUES (:order, :product, :qty, :price, 0)');
    $reduceStock = $pdo->prepare('UPDATE product SET StockQTy = StockQTy - :qty WHERE ProductID = :id');
    $movement = $pdo->prepare("INSERT INTO inventory (ProductID, EmployeeID, TransactionType, Qty, TransactionDate) VALUES (:product, :employee, 'Sale', :qty, NOW())");
    foreach ($cart as $item) {
        $insertItem->execute([':order' => $orderId, ':product' => $item['id'], ':qty' => $item['qty'], ':price' => $item['price']]);
        $reduceStock->execute([':qty' => $item['qty'], ':id' => $item['id']]);
        $movement->execute([':product' => $item['id'], ':employee' => $staff === '' ? null : (int)$staff, ':qty' => -$item['qty']]);
    }
    $payment = $pdo->prepare("INSERT INTO payment (OrderID, CashierID, PaymentDate, Method, Status, Amount) VALUES (:order, :cashier, NOW(), :method, 'Completed', :amount)");
    $payment->execute([':order' => $orderId, ':cashier' => $staff === '' ? null : (int)$staff, ':method' => $method, ':amount' => $total]);
    $pdo->commit();
    api_json(sale_order_record($pdo, $orderId) ?? [], 201);
} catch (PDOException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Sales API database error: ' . $error->getMessage());
    api_json(['error' => 'Could not complete the sale. No sale or stock changes were saved.'], 500);
}
