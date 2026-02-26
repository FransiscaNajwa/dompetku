<?php
// =============================================
// config.php — Konfigurasi Database
// GANTI nilai di bawah sesuai akun InfinityFree
// =============================================

define('DB_HOST', 'sql301.infinityfree.com'); // cek di panel InfinityFree
define('DB_USER', 'username_db_anda');         // MySQL username dari InfinityFree
define('DB_PASS', 'password_db_anda');         // MySQL password dari InfinityFree
define('DB_NAME', 'dompetku_db');              // nama database yang sudah dibuat

// JWT Secret — ganti dengan string acak panjang
define('JWT_SECRET', 'ganti_dengan_string_rahasia_panjang_acak_123!@#');

// Allowed origin — ganti dengan domain InfinityFree Anda
define('ALLOWED_ORIGIN', '*'); // ganti ke 'https://username.infinityfreeapp.com' setelah deploy

// =============================================
// Koneksi database (jangan diubah)
// =============================================
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['success' => false, 'message' => 'Koneksi database gagal.']));
        }
    }
    return $pdo;
}

// =============================================
// Helper functions
// =============================================

// Set CORS headers
function setCORS() {
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Content-Type: application/json; charset=utf-8');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }
}

// Send JSON response
function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

// Send error response
function respondError($message, $code = 400) {
    respond(['success' => false, 'message' => $message], $code);
}

// Get JSON request body
function getBody() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

// =============================================
// Simple JWT (tanpa library)
// =============================================
function createToken($userId, $username) {
    $header  = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64_encode(json_encode([
        'user_id'  => $userId,
        'username' => $username,
        'exp'      => time() + (60 * 60 * 24 * 30), // 30 hari
    ]));
    $sig = base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function verifyToken($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expectedSig = base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expectedSig, $sig)) return null;
    $data = json_decode(base64_decode($payload), true);
    if (!$data || $data['exp'] < time()) return null;
    return $data;
}

// Get authenticated user from Authorization header
function requireAuth() {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $token = str_replace('Bearer ', '', $authHeader);
    $data  = verifyToken($token);
    if (!$data) respondError('Token tidak valid atau sudah kadaluarsa. Silakan login ulang.', 401);
    return $data;
}