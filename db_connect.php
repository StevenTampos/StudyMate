<?php
// db_connect.php - SERVER VERSION

// 1. CHANGE THIS LINE: Use 'localhost' instead of the long URL
$host = 'localhost'; 

// 2. Keep your other credentials the same
$db   = 's23103016_studymate';
$user = 's23103016_studymate';
$pass = 'Admin_123';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    http_response_code(500);
    // This will print the JSON error if it fails again
    die(json_encode([
        "error" => "Database connection failed: " . $e->getMessage()
    ]));
}
?>