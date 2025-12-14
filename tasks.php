<?php
// tasks.php - Refactored to OOP with Edit Fix
require_once 'classes.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
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

$taskObj = new Task($pdo, $studentId);
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

// Robust ID Extraction (Supports ?id=1 OR /tasks.php/1)
$taskId = $_GET['id'] ?? null;
if (!$taskId) {
    $uri_parts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $lastPart = end($uri_parts);
    if (is_numeric($lastPart)) {
        $taskId = $lastPart;
    }
}

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
            
            // FIX: Check for 'title' implies a FULL UPDATE (Edit Modal)
            if (isset($input['title']) || isset($input['subject'])) {
                $status = isset($input['status']) ? $input['status'] : 'Pending';
                // If the frontend sends 'completed' boolean instead of 'status' string during edit
                if (isset($input['completed']) && !isset($input['status'])) {
                    $status = $input['completed'] ? 'Completed' : 'Pending';
                }
                
                $taskObj->update($taskId, $input['title'], $input['subject'], $input['due_date'], $status, $input['priority']);
                echo json_encode(["message" => "Task fully updated"]);
            } 
            // Check for 'completed' implies a STATUS TOGGLE (Checkbox)
            elseif (isset($input['completed'])) {
                $taskObj->toggleStatus($taskId, $input['completed']);
                echo json_encode(["message" => "Status updated"]);
            } else {
                throw new Exception("No valid fields to update");
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