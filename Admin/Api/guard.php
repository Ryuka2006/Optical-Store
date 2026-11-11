<?php
declare(strict_types=1);
define('PRACTICE_API_BOOTSTRAPPED', true);

function api_security_headers(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header_remove('X-Powered-By');
    ini_set('display_errors', '0');
}

function api_json(array $data, int $status = 200): void {
    api_security_headers(); http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE); exit;
}

function api_require_methods(array $allowed): void {
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        api_json(['error' => 'Method not allowed.'], 405);
    }
    if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) api_require_same_origin();
}

function api_require_same_origin(): void {
    $source = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($source === '' && !empty($_SERVER['HTTP_REFERER'])) $source = $_SERVER['HTTP_REFERER'];
    $sourceHost = $source !== '' ? parse_url($source, PHP_URL_HOST) : null;
    $sourcePort = $source !== '' ? parse_url($source, PHP_URL_PORT) : null;
    $requestHost = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    if (!$sourceHost || !$requestHost) api_json(['error' => 'Request origin could not be verified.'], 403);
    $expected = strtolower($sourceHost . ($sourcePort ? ':' . $sourcePort : ''));
    if (!hash_equals($requestHost, $expected)) api_json(['error' => 'Cross-origin request denied.'], 403);
}
function api_session(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','path'=>'/']);
        session_start();
    }
}
function api_read_input(): array {
    $raw=file_get_contents('php://input');
    if (stripos($_SERVER['CONTENT_TYPE']??'','application/json')!==false) { $data=json_decode($raw,true); return is_array($data)?$data:[]; }
    if ($_POST) return $_POST; parse_str($raw,$data); return is_array($data)?$data:[];
}
function require_login(): void { api_session(); if(empty($_SESSION['user_id'])) api_json(['error'=>'Please log in to continue.'],401); }

function require_admin(): void {
    require_login();
    if (normalize_role_name((string)($_SESSION['user_role'] ?? '')) !== 'admin') {
        api_json(['error' => 'Administrator access is required.'], 403);
    }
}

function normalize_role_name(string $role): string {
    $role = strtolower(trim($role));
    $role = preg_replace('/[\s_-]+/', ' ', $role) ?? $role;
    if ($role === 'administrator') return 'admin';
    if ($role === 'sale staff') return 'sales staff';
    return $role;
}

function require_role(string $expectedRole): void {
    require_login();
    $actualRole = normalize_role_name((string)($_SESSION['user_role'] ?? ''));
    if ($actualRole !== normalize_role_name($expectedRole)) {
        api_json(['error' => 'This workspace is not available to your account.'], 403);
    }
}
