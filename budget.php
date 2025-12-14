<?php
// budget.php - Refactored to OOP
require_once 'classes.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

$db = new Database();
$pdo = $db->connect();

// Middleware
$headers = apache_request_headers();
$token = isset($headers['Authorization']) ? $headers['Authorization'] : (isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : null);
$studentId = null;
if ($token) {
    $data = json_decode(base64_decode(substr($token, 7)), true);
    if ($data) $studentId = $data['studentId'];
}

if (!$studentId) {
    http_response_code(401);
    die(json_encode(["error" => "Unauthorized"]));
}

// Instantiate classes
$tracker = new BudgetTracker($pdo, $studentId);
$expenseObj = new Expense($pdo, $studentId);
$studentObj = new Student($pdo, $studentId); // For setting allowance

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$uri_parts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
$param = end($uri_parts);
$id = is_numeric($param) ? $param : null;

try {
    switch ($method) {
        case 'GET':
            // Use BudgetTracker to get summary
            echo json_encode($tracker->getFinanceSummary());
            break;

        case 'POST':
            // Use Expense to add
            $newId = $expenseObj->add($input['amount'], $input['category'], $input['description'], $input['date']);
            http_response_code(201);
            echo json_encode(["id" => $newId, "message" => "Expense added"]);
            break;

        case 'PUT':
            // Use Student to set allowance (as per UML: Student -> setAllowance)
            if (isset($_GET['action']) && $_GET['action'] === 'allowance') {
                $studentObj->setAllowance($input['allowance']);
                echo json_encode(["message" => "Allowance updated"]);
            }
            break;

        case 'DELETE':
            // Use Expense to delete
            if ($id) {
                $expenseObj->delete($id);
                http_response_code(204);
            }
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>