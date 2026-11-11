<?php
require_once __DIR__ . '/guard.php';
api_security_headers();
require_once __DIR__ . '/database.php';
require_admin();
api_require_methods(['GET']);


$allowed = ['role','employee','user','users','customer','appointment','eye_examination','examination',
    'prescription','brand','supplier','product','inventory','sale_order','sale_order_item','payment','refund',
    'notification','setting','app_setting'];
try {
    $existing = array_flip($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN));
    $data = [];
    foreach ($allowed as $table) {
        if (!isset($existing[$table])) continue;
        $columns = $pdo->query('SHOW COLUMNS FROM `' . str_replace('`', '``', $table) . '`')->fetchAll(PDO::FETCH_COLUMN);
        $columns = array_values(array_filter($columns, static fn($column) => !in_array(strtolower((string)$column), ['passwordhash','password','reset_token'], true)));
        if (!$columns) continue;
        $quoted = implode(', ', array_map(static fn($column) => '`' . str_replace('`', '``', $column) . '`', $columns));
        $data[$table] = $pdo->query('SELECT ' . $quoted . ' FROM `' . str_replace('`', '``', $table) . '`')->fetchAll();
    }
    api_json(['format' => 'practice-database-backup', 'version' => 1, 'createdAt' => gmdate('c'), 'tables' => $data]);
} catch (PDOException $e) {
    error_log('Backup API error: ' . $e->getMessage());
    api_json(['error' => 'Could not create the database backup.'], 500);
}
