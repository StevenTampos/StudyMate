<?php
// tasks.php - Finalized PHP Task API

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

include 'db_connect.php'; 

// --- AUTHENTICATION LOGIC ---
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

$token = getAuthorizationHeader(); 
$student_id = null;

if ($token && strpos($token, 'Bearer ') === 0) {
    $token_base64 = substr($token, 7); 
    $token_payload = base64_decode($token_base64); 
    $data = json_decode($token_payload, true);

    if ($data && isset($data['studentId']) && is_numeric($data['studentId']) && isset($data['exp']) && $data['exp'] > time()) {
        $student_id = $data['studentId'];
    }
}

// --- SECURITY CHECK ---
if (!$student_id) {
    http_response_code(401);
    die(json_encode(["error" => "Unauthorized: Please log in."]));
}
// -----------------------

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

$uri_parts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
$task_id = end($uri_parts);
if (!is_numeric($task_id)) {
    $task_id = null;
}

switch ($method) {
    case 'GET':
        try {
            $sql = "SELECT task_id as id, title, description, due_date, status, priority FROM tasks WHERE student_id = ? ORDER BY status ASC, due_date ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$student_id]);
            $tasks = $stmt->fetchAll();

            // Map 'description' back to 'subject' for frontend compatibility
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
            // Note: 'subject' is saved into the 'description' column
            $sql = "INSERT INTO tasks (student_id, title, description, due_date, status, priority) VALUES (?, ?, ?, ?, 'Pending', ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $student_id, 
                $title,      
                $subject, 
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
        if (!$task_id) {
             $task_id = $input['id'] ?? null;
             if (!$task_id) {
                http_response_code(400); echo json_encode(["error" => "Missing task ID for update"]); break;
             }
        }
        
        // FIX: Check for "Full Edit" fields FIRST. 
        // If title is present, we assume it's a full update (even if 'completed' is also sent).
        if (isset($input['title']) || isset($input['subject'])) {
             // --- Full Edit Logic ---
             $title = $input['title'] ?? null;
             $subject = $input['subject'] ?? null;
             $due_date = $input['due_date'] ?? null;
             $priority = $input['priority'] ?? 'medium';
             
             // Smart Status Handling:
             // 1. Prefer 'status' string if sent
             // 2. Else check 'completed' boolean
             // 3. Default to 'Pending' only if neither exists
             if (isset($input['status'])) {
                 $new_status = $input['status'];
             } elseif (isset($input['completed'])) {
                 $new_status = $input['completed'] ? 'Completed' : 'Pending';
             } else {
                 $new_status = 'Pending';
             }

             if (!$title || !$subject || !$due_date) {
                 http_response_code(400);
                 echo json_encode(["error" => "Missing required fields for full update"]);
                 break;
             }

             try {
                 $sql = "UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ?, priority = ? WHERE task_id = ? AND student_id = ?";
                 $stmt = $pdo->prepare($sql);
                 $stmt->execute([$title, $subject, $due_date, $new_status, $priority, $task_id, $student_id]);
                 
                 http_response_code(200);
                 echo json_encode(["message" => "Task updated fully"]);
             } catch (\PDOException $e) {
                 http_response_code(500);
                 echo json_encode(["error" => "Database error in PUT (Full): " . $e->getMessage()]);
             }

        } elseif (isset($input['completed'])) {
            // --- Toggle Status Logic (Partial Update) ---
            // Only runs if 'title' was NOT provided
            $new_status = $input['completed'] ? 'Completed' : 'Pending';
            
            try {
                $sql = "UPDATE tasks SET status = ? WHERE task_id = ? AND student_id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$new_status, $task_id, $student_id]);
                
                http_response_code(200);
                echo json_encode(["message" => "Task status toggled"]);
            } catch (\PDOException $e) {
                 http_response_code(500);
                 echo json_encode(["error" => "Database error in PUT (Toggle): " . $e->getMessage()]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["error" => "No valid fields provided for update"]);
        }
        break;
        
    case 'DELETE':
        if (!$task_id) {
             http_response_code(400); echo json_encode(["error" => "Missing task ID for delete"]); break;
        }

        try {
            $stmt = $pdo->prepare("DELETE FROM tasks WHERE task_id = ? AND student_id = ?");
            $stmt->execute([$task_id, $student_id]);
            
            http_response_code(204); 
        } catch (\PDOException $e) {
            http_response_code(500);
            echo json_encode(["error" => "Database error in DELETE: " . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["error" => "Method not allowed"]);
        break;
}
?>