<?php
require_once __DIR__ . '/guard.php';
api_security_headers();
api_require_methods(['GET', 'POST', 'PUT', 'DELETE']);
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/crud.php';

crud_run([
    'table' => 'prescription', 'alias' => 'p', 'pk' => 'PrescriptionID', 'order' => 'p.PrescriptionDate DESC, p.PrescriptionID DESC',
    'select' => 'SELECT p.*, c.FullName AS CustomerName, e.FullName AS OptometristName FROM prescription p LEFT JOIN customer c ON c.CustomerID = p.CustomerID LEFT JOIN employee e ON e.EmployeeID = p.OptometristID',
    'beforeSave' => function (array $input, string $method, PDO $pdo): ?string {
        $examId = filter_var($input['ExaminationID'] ?? null, FILTER_VALIDATE_INT);
        $customerId = filter_var($input['CustomerID'] ?? null, FILTER_VALIDATE_INT);
        $optometristId = filter_var($input['OptometristID'] ?? null, FILTER_VALIDATE_INT);
        if (!$examId || !$customerId || !$optometristId) return 'Choose a valid examination, customer and optometrist.';
        $stmt = $pdo->prepare('SELECT CustomerID, OptometristID FROM eye_examination WHERE ExaminationID = :id');
        $stmt->execute([':id' => $examId]);
        $exam = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$exam) return 'The selected eye examination no longer exists.';
        if ((int)$exam['CustomerID'] !== $customerId || (int)$exam['OptometristID'] !== $optometristId) {
            return 'Customer and optometrist must match the selected eye examination.';
        }
        $expiry = trim((string)($input['ExpiryDate'] ?? ''));
        $date = trim((string)($input['PrescriptionDate'] ?? ''));
        if ($expiry !== '' && $date !== '' && $expiry < $date) return 'Expiry date cannot be before the prescription date.';
        return null;
    },
    'fields' => [
        'ExaminationID' => ['type' => 'int', 'required' => true, 'label' => 'Eye examination'],
        'CustomerID' => ['type' => 'int', 'required' => true, 'label' => 'Customer'],
        'OptometristID' => ['type' => 'int', 'required' => true, 'label' => 'Optometrist'],
        'PrescriptionDate' => ['type' => 'date', 'required' => true, 'label' => 'Prescription date'],
        'ExpiryDate' => ['type' => 'date', 'label' => 'Expiry date'],
    ],
]);
