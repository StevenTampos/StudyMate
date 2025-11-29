<?php
// db_connect.php (Equivalent of db.js)

// --- Database Credentials (Update with your .env values) ---
$host = 'localhost';
$db   = 'studymate';
$user = 'root';
$pass = ''; // Your actual DB_PASS
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    // Throw exceptions on error
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    // Fetch results as associative arrays (like JSON objects)
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    // Disable emulated prepared statements
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
     // Die with a 500 error if connection fails
     http_response_code(500);
     die(json_encode(["error" => "Database connection failed: " . $e->getMessage()]));
}
?>