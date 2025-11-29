<?php
// budget.php - API for Finance/Expense Management

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Assumes 'db_connect.php' is in the same directory
include 'db_connect.php'; 

// --- AUTHENTICATION LOGIC (Copied from tasks.php/auth.php) ---

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

// FALLBACK/SECURITY CHECK (similar to tasks.php)
if (!$student_id) {
    if ($token) { 
         // Fallback to student ID 1 for testing if a bad token is provided
         $student_id = 1;
    } else {
        http_response_code(401);
        die(json_encode(["error" => "Unauthorized: Please log in."]));
    }
}
// ----------------------------------------------------

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

// Get the expense ID from the URL (for DELETE)
$uri_parts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
$expense_id = end($uri_parts);
if (!is_numeric($expense_id) || $expense_id == 'budget.php') {
    $expense_id = null;
}

// Router
switch ($method) {
    case 'GET':
        // GET /budget.php - Get all expenses and allowance for student
        try {
            // 1. Get Allowance 
            $sql_allowance = "SELECT monthly_allowance FROM students WHERE student_id = ?";
            $stmt_allowance = $pdo->prepare($sql_allowance);
            $stmt_allowance->execute([$student_id]);
            $allowance_result = $stmt_allowance->fetch();
            $monthly_allowance = $allowance_result ? (float)($allowance_result['monthly_allowance'] ?? 0) : 0.00;
            
            // 2. Get Expenses 
            $sql_expenses = "SELECT expense_id as id, amount, category, description, expense_date as date FROM expenses WHERE student_id = ? ORDER BY expense_date DESC, expense_id DESC";
            $stmt_expenses = $pdo->prepare($sql_expenses);
            $stmt_expenses->execute([$student_id]);
            $expenses = $stmt_expenses->fetchAll();

            echo json_encode([
                "allowance" => $monthly_allowance,
                "expenses" => $expenses
            ]);
        } catch (\PDOException $e) {
            http_response_code(500);
            echo json_encode(["error" => "Database error in GET: " . $e->getMessage()]);
        }
        break;

    case 'POST':
        // POST /budget.php - Add a new expense
        $amount = (float)($input['amount'] ?? 0);
        $category = $input['category'] ?? null;
        $description = $input['description'] ?? null;
        $date = $input['date'] ?? null;
        
        if (!$amount || !$category || !$description || !$date) {
            http_response_code(400);
            echo json_encode(["error" => "Missing required fields for new expense"]);
            break;
        }

        try {
            $sql = "INSERT INTO expenses (student_id, amount, category, description, expense_date) VALUES (?, ?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $student_id, 
                $amount,      
                $category,    
                $description,   
                $date    
            ]);
            
            http_response_code(201);
            echo json_encode(["id" => $pdo->lastInsertId(), "message" => "Expense added"]);
        } catch (\PDOException $e) {
            http_response_code(500);
            echo json_encode(["error" => "Database error in POST: " . $e->getMessage()]);
        }
        break;
        
    case 'DELETE':
        // DELETE /budget.php/{id}
        if (!$expense_id) {
             http_response_code(400); echo json_encode(["error" => "Missing expense ID for delete"]); break;
        }

        try {
            $stmt = $pdo->prepare("DELETE FROM expenses WHERE expense_id = ? AND student_id = ?");
            $stmt->execute([$expense_id, $student_id]);
            
            if ($stmt->rowCount() === 0) {
                 http_response_code(404); echo json_encode(["error" => "Expense not found or unauthorized"]); break;
            }
            
            http_response_code(204); // No Content
        } catch (\PDOException $e) {
             http_response_code(500);
             echo json_encode(["error" => "Database error in DELETE: " . $e->getMessage()]);
        }
        break;

    case 'PUT':
        // PUT /budget.php?action=allowance
        $action = $_GET['action'] ?? null;
        if ($action === 'allowance') {
            $new_allowance = (float)($input['allowance'] ?? 0);
            try {
                // Update the monthly_allowance field in the students table
                $sql = "UPDATE students SET monthly_allowance = ? WHERE student_id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$new_allowance, $student_id]);
                
                http_response_code(200);
                echo json_encode(["message" => "Monthly allowance updated successfully.", "allowance" => $new_allowance]);
            } catch (\PDOException $e) {
                http_response_code(500);
                echo json_encode(["error" => "Database error updating allowance: " . $e->getMessage()]);
            }
        } else {
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed or missing action for PUT request."]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["error" => "Method not allowed"]);
        break;
}
?>