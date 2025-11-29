<?php
// tasks.php - Finalized PHP Task API

// Set headers BEFORE any output is sent (moved from previous steps)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// === DEBUGGING: ENABLE ALL ERRORS ===
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
// ====================================

// Exit early for preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Function to reliably retrieve the Authorization header (from your upload)
function getAuthorizationHeader(){
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        if (isset($requestHeaders['Authorization'])) {
            return $requestHeaders['Authorization'];
        }
    }
    return null;
}

// Ensure the path is correct based on your setup (../ or ./ or ../../)
include 'db_connect.php'; 

// --- AUTHENTICATION LOGIC ---

// FIX: Use the reliable function instead of the unreliable $_SERVER variable
$token = getAuthorizationHeader(); 
$student_id = null;

if ($token && strpos($token, 'Bearer ') === 0) {
    $token_base64 = substr($token, 7); 
    
    // Safely decode the Base64 token payload
    $token_payload = base64_decode($token_base64); 
    $data = json_decode($token_payload, true);

    // Check if decoding succeeded, studentId exists, and the token is NOT expired
    if ($data && isset($data['studentId']) && is_numeric($data['studentId']) && isset($data['exp']) && $data['exp'] > time()) {
        $student_id = $data['studentId'];
    }
}

// --- SECURITY CHECK (Finalized) ---
if (!$student_id) {
    http_response_code(401);
    die(json_encode(["error" => "Unauthorized: Please log in."]));
}
// -----------------------------

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

// Get the task ID from the URL (for PUT/DELETE)
$uri_parts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
$task_id = end($uri_parts);
if (!is_numeric($task_id)) {
    $task_id = null;
}

switch ($method) {
    case 'GET':
        // GET /tasks.php
        try {
            // Use the now verified $student_id
            $sql = "SELECT task_id as id, title, description, due_date, status, priority FROM tasks WHERE student_id = ? ORDER BY status ASC, due_date ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$student_id]);
            $tasks = $stmt->fetchAll();

            // Map description back to subject for the frontend
            $tasks = array_map(function($t) {
                $t['subject'] = $t['description']; 
                unset($t['description']);
                return $t;
            }, $tasks);
            
            echo json_encode($tasks);
        } catch (\PDOException $e) {
            http_response_code(500);
            echo json_encode(["error" => "Database error in GET: " . $e->getMessage()]);
        }
        break;

    case 'POST':
        // POST /tasks.php (Create a new task)
        $title = $input['title'] ?? null;
        $subject = $input['subject'] ?? null;
        $due_date = $input['due_date'] ?? null;
        $priority = $input['priority'] ?? 'medium';
        
        if (!$title || !$subject || !$due_date) {
            http_response_code(400);
            echo json_encode(["error" => "Missing required fields in POST data"]);
            break;
        }

        try {
            // Use the verified $student_id
            $sql = "INSERT INTO tasks (student_id, title, description, due_date, status, priority) VALUES (?, ?, ?, ?, 'Pending', ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $student_id, 
                $title,      
                $subject,    // Subject is stored in 'description'
                $due_date,   
                $priority    
            ]);
            
            http_response_code(201);
            echo json_encode(["id" => $pdo->lastInsertId(), "message" => "Task created"]);
        } catch (\PDOException $e) {
            http_response_code(500);
            echo json_encode(["error" => "Database error in POST: " . $e->getMessage()]);
        }
        break;
        
    case 'PUT':
        // PUT /tasks.php/{id} (Update a task)
        if (!$task_id) {
             $task_id = $input['id'] ?? null;
             if (!$task_id) {
                http_response_code(400); echo json_encode(["error" => "Missing task ID for update"]); break;
             }
        }
        
        $completed = $input['completed'] ?? null;

        if (isset($completed)) {
            // Case 1: Simple toggle
            $new_status = $completed ? 'Completed' : 'Pending';
            // Use the verified $student_id
            $sql = "UPDATE tasks SET status = ? WHERE task_id = ? AND student_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$new_status, $task_id, $student_id]);
        } else {
             // Case 2: Full edit (requires all fields)
             $title = $input['title'] ?? null;
             $subject = $input['subject'] ?? null;
             $due_date = $input['due_date'] ?? null;
             $priority = $input['priority'] ?? 'medium';
             $new_status = $input['status'] ?? 'Pending'; 

             if (!$title || !$subject || !$due_date) {
                 http_response_code(400);
                 echo json_encode(["error" => "Missing required fields for full update"]);
                 break;
             }

             // Use the verified $student_id
             $sql = "UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ?, priority = ? WHERE task_id = ? AND student_id = ?";
             $stmt = $pdo->prepare($sql);
             $stmt->execute([$title, $subject, $due_date, $new_status, $priority, $task_id, $student_id]);
        }

        http_response_code(200);
        echo json_encode(["message" => "Task updated"]);
        break;
        
    case 'DELETE':
        // DELETE /tasks.php/{id}
        if (!$task_id) {
             http_response_code(400); echo json_encode(["error" => "Missing task ID for delete"]); break;
        }

        // Use the verified $student_id
        $stmt = $pdo->prepare("DELETE FROM tasks WHERE task_id = ? AND student_id = ?");
        $stmt->execute([$task_id, $student_id]);
        
        http_response_code(204); // No Content
        break;

    default:
        http_response_code(405);
        echo json_encode(["error" => "Method not allowed"]);
        break;
}
?>