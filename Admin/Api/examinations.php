<?php
declare(strict_types=1);

require_once __DIR__ . '/guard.php';
api_security_headers();
api_require_methods(['GET', 'POST', 'PUT', 'DELETE']);
require_login();

function exam_record(PDO $pdo, int $id): ?array {
    $stmt = $pdo->prepare(
        'SELECT x.ExaminationID AS ExamID, x.CustomerID,
                c.FullName AS CustomerName, x.OptometristID,
                e.FullName AS OptometristName,
                x.ExaminationDate AS ExamDate,
                x.LeftEyeSPH, x.LeftEyeCYL, x.LeftEyeAXIS,
                x.RightEyeSPH, x.RightEyeCYL, x.RightEyeAXIS,
                x.PD, x.EyePressure, x.VisualAcuity,
                x.Notes AS ResultSummary
           FROM eye_examination x
           LEFT JOIN customer c ON c.CustomerID = x.CustomerID
           LEFT JOIN employee e ON e.EmployeeID = x.OptometristID
          WHERE x.ExaminationID = :id'
    );
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function exam_valid_date($value): bool {
    if (!is_string($value)) return false;
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
}

function exam_numeric_value(array $input, string $name, array &$errors, bool $integer = false, ?float $min = null, ?float $max = null): ?string {
    $raw = $input[$name] ?? '';
    if (!is_scalar($raw)) { $errors[] = "$name must be a number."; return null; }
    $value = trim((string)$raw);
    if ($value === '') return null;
    if (!is_numeric($value) || ($integer && (string)(int)$value !== $value)) {
        $errors[] = "$name must be " . ($integer ? 'a whole number.' : 'a valid number.');
        return null;
    }
    $number = (float)$value;
    if (($min !== null && $number < $min) || ($max !== null && $number > $max)) {
        $errors[] = "$name is outside the allowed range.";
        return null;
    }
    return $value;
}

try {
    require_once __DIR__ . '/database.php';
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        if (isset($_GET['id']) && $_GET['id'] !== '') {
            if (!ctype_digit((string)$_GET['id'])) api_json(['error' => 'Invalid examination ID.'], 422);
            $row = exam_record($pdo, (int)$_GET['id']);
            if (!$row) api_json(['error' => 'Examination not found.'], 404);
            api_json($row);
        }
        $stmt = $pdo->query(
            'SELECT x.ExaminationID AS ExamID, x.CustomerID,
                    c.FullName AS CustomerName, x.OptometristID,
                    e.FullName AS OptometristName,
                    x.ExaminationDate AS ExamDate,
                    x.LeftEyeSPH, x.LeftEyeCYL, x.LeftEyeAXIS,
                    x.RightEyeSPH, x.RightEyeCYL, x.RightEyeAXIS,
                    x.PD, x.EyePressure, x.VisualAcuity,
                    x.Notes AS ResultSummary
               FROM eye_examination x
               LEFT JOIN customer c ON c.CustomerID = x.CustomerID
               LEFT JOIN employee e ON e.EmployeeID = x.OptometristID
              ORDER BY x.ExaminationDate DESC, x.ExaminationID DESC'
        );
        api_json($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    $input = api_read_input();
    if ($method === 'DELETE') {
        $id = $input['id'] ?? ($_GET['id'] ?? null);
        if (!is_scalar($id) || !ctype_digit((string)$id)) api_json(['error' => 'A valid examination ID is required.'], 422);
        $stmt = $pdo->prepare('DELETE FROM eye_examination WHERE ExaminationID = :id');
        $stmt->execute([':id' => (int)$id]);
        if ($stmt->rowCount() === 0) api_json(['error' => 'Examination not found.'], 404);
        api_json(['message' => 'Examination deleted.', 'deleted' => 1]);
    }

    $id = $input['ExamID'] ?? null;
    if ($method === 'PUT' && (!is_scalar($id) || !ctype_digit((string)$id))) {
        api_json(['error' => 'A valid examination ID is required.'], 422);
    }
    $customerId = $input['CustomerID'] ?? '';
    $optometristId = $input['OptometristID'] ?? '';
    $examDate = $input['ExamDate'] ?? '';
    $notes = $input['ResultSummary'] ?? '';
    $errors = [];
    if (!is_scalar($customerId) || !ctype_digit((string)$customerId) || (int)$customerId < 1) $errors[] = 'Select a valid customer.';
    if (!is_scalar($optometristId) || !ctype_digit((string)$optometristId) || (int)$optometristId < 1) $errors[] = 'Select a valid optometrist.';
    if (!exam_valid_date($examDate)) $errors[] = 'Enter a valid examination date.';
    if (!is_scalar($notes)) $errors[] = 'Findings must be text.';
    $notes = is_scalar($notes) ? trim((string)$notes) : '';
    if (strlen($notes) > 5000) $errors[] = 'Findings must be 5,000 characters or fewer.';

    $measurementFields = [
        'LeftEyeSPH' => [false, -30, 30], 'LeftEyeCYL' => [false, -20, 20], 'LeftEyeAXIS' => [true, 0, 180],
        'RightEyeSPH' => [false, -30, 30], 'RightEyeCYL' => [false, -20, 20], 'RightEyeAXIS' => [true, 0, 180],
        'PD' => [false, 20, 90], 'EyePressure' => [false, 0, 100],
    ];
    $measurements = [];
    foreach ($measurementFields as $field => [$integer, $min, $max]) {
        $measurements[$field] = exam_numeric_value($input, $field, $errors, $integer, $min, $max);
    }
    $visualAcuity = $input['VisualAcuity'] ?? '';
    if (!is_scalar($visualAcuity)) { $errors[] = 'Visual acuity must be text.'; $visualAcuity = ''; }
    $visualAcuity = trim((string)$visualAcuity);
    if (strlen($visualAcuity) > 50) $errors[] = 'Visual acuity must be 50 characters or fewer.';
    if ($errors) api_json(['error' => implode(' ', $errors)], 422);

    $checkCustomer = $pdo->prepare('SELECT 1 FROM customer WHERE CustomerID = :id');
    $checkCustomer->execute([':id' => (int)$customerId]);
    if (!$checkCustomer->fetchColumn()) api_json(['error' => 'The selected customer does not exist.'], 422);
    $checkEmployee = $pdo->prepare('SELECT 1 FROM employee WHERE EmployeeID = :id');
    $checkEmployee->execute([':id' => (int)$optometristId]);
    if (!$checkEmployee->fetchColumn()) api_json(['error' => 'The selected optometrist does not exist.'], 422);

    $params = [
        ':customer' => (int)$customerId, ':employee' => (int)$optometristId, ':date' => $examDate,
        ':LeftEyeSPH' => $measurements['LeftEyeSPH'], ':LeftEyeCYL' => $measurements['LeftEyeCYL'],
        ':LeftEyeAXIS' => $measurements['LeftEyeAXIS'], ':RightEyeSPH' => $measurements['RightEyeSPH'],
        ':RightEyeCYL' => $measurements['RightEyeCYL'], ':RightEyeAXIS' => $measurements['RightEyeAXIS'],
        ':PD' => $measurements['PD'], ':EyePressure' => $measurements['EyePressure'],
        ':VisualAcuity' => $visualAcuity === '' ? null : $visualAcuity, ':Notes' => $notes === '' ? null : $notes,
    ];

    if ($method === 'POST') {
        $stmt = $pdo->prepare(
            'INSERT INTO eye_examination
                (CustomerID, OptometristID, ExaminationDate, LeftEyeSPH, LeftEyeCYL, LeftEyeAXIS,
                 RightEyeSPH, RightEyeCYL, RightEyeAXIS, PD, EyePressure, VisualAcuity, Notes)
             VALUES (:customer, :employee, :date, :LeftEyeSPH, :LeftEyeCYL, :LeftEyeAXIS,
                     :RightEyeSPH, :RightEyeCYL, :RightEyeAXIS, :PD, :EyePressure, :VisualAcuity, :Notes)'
        );
        $stmt->execute($params);
        api_json(exam_record($pdo, (int)$pdo->lastInsertId()) ?? [], 201);
    }

    if (!exam_record($pdo, (int)$id)) api_json(['error' => 'Examination not found.'], 404);
    $params[':id'] = (int)$id;
    $stmt = $pdo->prepare(
        'UPDATE eye_examination SET CustomerID = :customer, OptometristID = :employee,
                ExaminationDate = :date, LeftEyeSPH = :LeftEyeSPH, LeftEyeCYL = :LeftEyeCYL,
                LeftEyeAXIS = :LeftEyeAXIS, RightEyeSPH = :RightEyeSPH, RightEyeCYL = :RightEyeCYL,
                RightEyeAXIS = :RightEyeAXIS, PD = :PD, EyePressure = :EyePressure,
                VisualAcuity = :VisualAcuity, Notes = :Notes
          WHERE ExaminationID = :id'
    );
    $stmt->execute($params);
    api_json(exam_record($pdo, (int)$id) ?? []);
} catch (PDOException $error) {
    error_log('Examinations API database error: ' . $error->getMessage());
    api_json(['error' => 'Could not complete the examination request. Check the eye_examination, customer and employee tables.'], 500);
}
