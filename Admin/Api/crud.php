<?php














require_once __DIR__ . '/guard.php';

function crud_validate(array $fields, array $in, bool $partial): array {
    $errors = [];
    $vals = [];

    foreach ($fields as $name => $f) {
        $present = array_key_exists($name, $in);
        if ($partial && !$present) continue;

        $raw = $present ? $in[$name] : null;
        $v = is_string($raw) ? trim($raw) : $raw;
        $type = $f['type'] ?? 'string';
        $label = $f['label'] ?? $name;

        if ($v === null || $v === '') {
            if (!empty($f['required']) && !($type === 'password' && $partial)) {
                $errors[] = "$label is required";
                continue;
            }
            if ($type === 'password') continue;          
            $vals[$name] = array_key_exists('default', $f) ? $f['default'] : null;
            continue;
        }

        switch ($type) {
            case 'int':
                if (!preg_match('/^-?\d+$/', (string)$v)) { $errors[] = "$label must be a whole number"; continue 2; }
                $v = (int)$v; break;
            case 'decimal':
                if (!is_numeric($v)) { $errors[] = "$label must be a number"; continue 2; }
                $v = (string)(0 + $v); break;
            case 'date':
                $d = DateTime::createFromFormat('Y-m-d', (string)$v);
                if (!$d || $d->format('Y-m-d') !== $v) { $errors[] = "$label must be YYYY-MM-DD"; continue 2; }
                break;
            case 'datetime':
                $v = str_replace('T', ' ', (string)$v);
                if (!strtotime($v)) { $errors[] = "$label is not a valid date/time"; continue 2; }
                if (strlen($v) === 16) $v .= ':00';
                break;
            case 'time':
                if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', (string)$v)) { $errors[] = "$label must be HH:MM"; continue 2; }
                if (strlen($v) === 5) $v .= ':00';
                break;
            case 'email':
                if (!filter_var($v, FILTER_VALIDATE_EMAIL)) { $errors[] = "$label is not a valid email"; continue 2; }
                break;
            case 'enum':
                if (!in_array($v, $f['enum'], true)) { $errors[] = "$label must be one of: " . implode(', ', $f['enum']); continue 2; }
                break;
            case 'bool':
                $v = filter_var($v, FILTER_VALIDATE_BOOLEAN) ? 1 : 0; break;
            case 'password':
                if (strlen((string)$v) < 6) { $errors[] = "$label must be at least 6 characters"; continue 2; }
                $v = password_hash((string)$v, PASSWORD_DEFAULT); break;
            default:
                if (!empty($f['max']) && mb_strlen((string)$v) > $f['max']) { $errors[] = "$label is too long"; continue 2; }
        }
        $vals[$name] = $v;
    }
    return [$errors, $vals];
}

function crud_run(array $c): void {
    global $pdo;
    require_login();

    $method = $_SERVER['REQUEST_METHOD'];
    $table  = $c['table'];
    $pk     = $c['pk'];
    $alias  = $c['alias'] ?? $table;
    $select = $c['select'] ?? "SELECT * FROM $table";
    $order  = $c['order'] ?? "$alias.$pk";
    $fields = $c['fields'];
    $group  = $c['group'] ?? '';

    $fetchOne = function ($id) use ($pdo, $select, $alias, $pk, $group) {
        $stmt = $pdo->prepare("$select WHERE $alias.$pk = :id $group");
        $stmt->bindValue(':id', (int)$id, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    };

    try {
        if ($method === 'GET') {
            if (isset($_GET['id']) && $_GET['id'] !== '') {
                $row = $fetchOne($_GET['id']);
                if (!$row) api_json(['error' => 'Record not found'], 404);
                api_json($row);
            }
            $stmt = $pdo->query("$select $group ORDER BY $order");
            api_json($stmt->fetchAll(PDO::FETCH_ASSOC));
        }

        if ($method === 'POST') {
            $in = api_read_input();
            if (isset($c['beforeSave'])) {
                $saveError = ($c['beforeSave'])($in, $method, $pdo);
                if (is_string($saveError) && $saveError !== '') api_json(['error' => $saveError], 422);
            }
            [$errors, $vals] = crud_validate($fields, $in, false);
            if ($errors) api_json(['error' => implode('; ', $errors)], 422);

            $cols = []; $ph = []; $params = [];
            foreach ($vals as $name => $v) {
                $col = $fields[$name]['col'] ?? $name;
                $cols[] = $col; $ph[] = ":$name"; $params[":$name"] = $v;
            }
            $hasId = isset($in['id']) && trim((string)$in['id']) !== '';
            if ($hasId) {
                if (!ctype_digit((string)$in['id'])) api_json(['error' => 'id must be a number'], 422);
                array_unshift($cols, $pk); array_unshift($ph, ':__id'); $params[':__id'] = (int)$in['id'];
            }
            $stmt = $pdo->prepare("INSERT INTO $table (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $ph) . ")");
            $stmt->execute($params);
            $newId = $hasId ? (int)$in['id'] : $pdo->lastInsertId();
            api_json($fetchOne($newId), 201);
        }

        if ($method === 'PUT') {
            $in = api_read_input();
            if (!isset($in['id']) || !ctype_digit((string)$in['id'])) api_json(['error' => 'Missing or invalid id'], 422);
            if (!$fetchOne($in['id'])) api_json(['error' => 'Record not found'], 404);
            if (isset($c['beforeSave'])) {
                $saveError = ($c['beforeSave'])($in, $method, $pdo);
                if (is_string($saveError) && $saveError !== '') api_json(['error' => $saveError], 422);
            }

            [$errors, $vals] = crud_validate($fields, $in, true);
            if ($errors) api_json(['error' => implode('; ', $errors)], 422);
            if (!$vals) api_json(['error' => 'Nothing to update'], 422);

            $sets = []; $params = [':__id' => (int)$in['id']];
            foreach ($vals as $name => $v) {
                $col = $fields[$name]['col'] ?? $name;
                $sets[] = "$col = :$name"; $params[":$name"] = $v;
            }
            $stmt = $pdo->prepare("UPDATE $table SET " . implode(', ', $sets) . " WHERE $pk = :__id");
            $stmt->execute($params);
            api_json($fetchOne($in['id']));
        }

        if ($method === 'DELETE') {
            $in = api_read_input();
            $id = $in['id'] ?? ($_GET['id'] ?? null);
            if ($id === null || !ctype_digit((string)$id)) api_json(['error' => 'Missing or invalid id'], 422);
            if (isset($c['beforeDelete'])) {
                $deleteError = ($c['beforeDelete'])((int)$id, $pdo);
                if (is_string($deleteError) && $deleteError !== '') api_json(['error' => $deleteError], 409);
            }
            $stmt = $pdo->prepare("DELETE FROM $table WHERE $pk = :id");
            $stmt->bindValue(':id', (int)$id, PDO::PARAM_INT);
            $stmt->execute();
            if ($stmt->rowCount() === 0) api_json(['error' => 'Record not found'], 404);
            api_json(['message' => 'Deleted', 'deleted' => 1]);
        }

        api_json(['error' => 'Method not allowed'], 405);

    } catch (PDOException $e) {
        error_log('DB error: ' . $e->getMessage());
        if ($e->getCode() === '23000') {
            api_json(['error' => 'Duplicate value, or this record is still used by other records.'], 409);
        }
        api_json(['error' => 'Database error. Check PHP/database.php and that the tables exist (import database.sql).'], 500);
    }
}
