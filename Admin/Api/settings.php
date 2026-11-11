<?php
declare(strict_types=1);
require_once __DIR__ . '/guard.php';
api_security_headers();
require_once __DIR__ . '/database.php';
require_admin();
api_require_methods(['GET', 'PUT']);

$allowed = ['store_name','store_address','support_email','store_phone','vat_rate','tax_inclusive','auto_apply_tax',
    'hours_weekday','hours_saturday','hours_sunday'];
try {
    $hasLegacySettings = (bool)$pdo->query("SHOW TABLES LIKE 'setting'")->fetchColumn();
    $table = $hasLegacySettings ? '`setting`' : '`app_setting`';
    if (!$hasLegacySettings) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS app_setting (
            SettingKey VARCHAR(60) PRIMARY KEY,
            SettingValue TEXT NULL,
            UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        $stmt = $pdo->query("SELECT SettingKey, SettingValue FROM $table");
        $settings = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) $settings[$row['SettingKey']] = $row['SettingValue'];
        api_json(['success' => true, 'settings' => $settings]);
    }
    $input = api_read_input();
    if (!isset($input['settings']) || !is_array($input['settings'])) api_json(['error' => 'Settings payload is invalid.'], 422);
    $values = array_intersect_key($input['settings'], array_flip($allowed));
    if (isset($values['vat_rate']) && (!is_numeric($values['vat_rate']) || (float)$values['vat_rate'] < 0 || (float)$values['vat_rate'] > 100)) {
        api_json(['error' => 'VAT rate must be between 0 and 100.'], 422);
    }
    if (isset($values['support_email']) && $values['support_email'] !== '' && !filter_var($values['support_email'], FILTER_VALIDATE_EMAIL)) {
        api_json(['error' => 'Enter a valid support email address.'], 422);
    }
    foreach ($values as $key => $value) {
        if (!is_scalar($value) || strlen((string)$value) > 255) api_json(['error' => 'A setting is invalid or too long.'], 422);
        $upsert = $pdo->prepare("INSERT INTO $table (SettingKey, SettingValue) VALUES (:key, :value)
            ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue)");
        $upsert->execute([':key' => $key, ':value' => (string)$value]);
    }
    api_json(['success' => true, 'message' => 'Settings saved.']);
} catch (PDOException $error) {
    error_log('Settings API error: ' . $error->getMessage());
    api_json(['error' => 'Could not load or save settings.'], 500);
}
