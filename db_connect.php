<?php
// db_connect.php - OOP Database Wrapper

class Database {
    private $host = 'localhost';
    private $db   = 's23103016_studymate';
    private $user = 's23103016_studymate';
    private $pass = 'Admin_123';
    private $charset = 'utf8mb4';
    private $pdo;
    private $error;

    public function connect() {
        $dsn = "mysql:host=$this->host;dbname=$this->db;charset=$this->charset";
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        try {
            $this->pdo = new PDO($dsn, $this->user, $this->pass, $options);
            return $this->pdo;
        } catch (PDOException $e) {
            $this->error = $e->getMessage();
            echo json_encode(["error" => "Connection failed: " . $this->error]);
            exit;
        }
    }
}
?>