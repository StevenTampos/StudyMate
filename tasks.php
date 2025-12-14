<?php
// tasks.php - Refactored to OOP
require_once 'classes.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

$db = new Database();
$pdo = $db->connect();

// Middleware (Simplified)
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

// Instantiate Task
$taskObj = new Task($pdo, $studentId);

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$uri_parts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
$taskId = end($uri_parts);
$taskId = is_numeric($taskId) ? $taskId : null;

try {
    switch ($method) {
        case 'GET':
            echo json_encode($taskObj->getAllTasks());
            break;

        case 'POST':
            $newId = $taskObj->createTask($input['title'], $input['subject'], $input['due_date'], $input['priority'] ?? 'medium');
            http_response_code(201);
            echo json_encode(["id" => $newId, "message" => "Task created"]);
            break;

        case 'PUT':
            if (!$taskId) throw new Exception("Missing Task ID");
            
            if (isset($input['completed'])) {
                // Toggle Status
                $taskObj->toggleStatus($taskId, $input['completed']);
                echo json_encode(["message" => "Status updated"]);
            } else {
                // Full Update
                $status = isset($input['status']) ? $input['status'] : 'Pending';
                $taskObj->update($taskId, $input['title'], $input['subject'], $input['due_date'], $status, $input['priority']);
                echo json_encode(["message" => "Task fully updated"]);
            }
            break;

        case 'DELETE':
            if (!$taskId) throw new Exception("Missing Task ID");
            $taskObj->delete($taskId);
            http_response_code(204);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>