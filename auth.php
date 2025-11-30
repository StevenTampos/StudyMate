<?php
// auth.php - Authentication and User Profile API

// Debugging (Disable in production)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

include 'db_connect.php'; 

// Helper: Get Authorization Header
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

// Helper: Generate Token
function generateToken($studentId) {
    $expiration_time = time() + (24 * 3600); // 24 hours
    $payload = [
        'studentId' => $studentId,
        'exp' => $expiration_time
    ];
    return base64_encode(json_encode($payload));
}

// Helper: Validate Token
function validateTokenAndGetStudentId($pdo) {
    $token = getAuthorizationHeader();
    if (!$token || strpos($token, 'Bearer ') !== 0) {
        return null;
    }

    $token_base64 = substr($token, 7); 
    $token_payload = base64_decode($token_base64); 
    $data = json_decode($token_payload, true);

    if ($data && isset($data['studentId']) && is_numeric($data['studentId']) && isset($data['exp']) && $data['exp'] > time()) {
        return $data['studentId'];
    }
    return null;
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? null;

$student_id = validateTokenAndGetStudentId($pdo);

switch ($action) {
    case 'register':
        if ($method === 'POST') {
            $fullName = $input['fullName'] ?? null;
            $username = $input['username'] ?? null;
            $email = $input['email'] ?? null;
            $password = $input['password'] ?? null;

            if (!$fullName || !$username || !$email || !$password) {
                http_response_code(400);
                die(json_encode(["error" => "Missing required fields."]));
            }

            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

            try {
                $sql_check = 'SELECT student_id FROM students WHERE username = ? OR email = ?';
                $stmt_check = $pdo->prepare($sql_check);
                $stmt_check->execute([$username, $email]);
                
                if ($stmt_check->rowCount() > 0) {
                    http_response_code(409);
                    die(json_encode(["error" => "Username or email already in use."]));
                }
                
                $sql = 'INSERT INTO students (full_name, username, email, password_hash) VALUES (?, ?, ?, ?)';
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$fullName, $username, $email, $hashedPassword]);

                http_response_code(201);
                echo json_encode(["message" => "Registration successful. Redirecting to login."]);
            } catch (\PDOException $e) {
                http_response_code(500);
                die(json_encode(["error" => "Database error: " . $e->getMessage()]));
            }
        } else {
            http_response_code(405);
            die(json_encode(["error" => "Method not allowed for register action."]));
        }
        break;

    case 'login':
        if ($method === 'POST') {
            $username = $input['username'] ?? null;
            $password = $input['password'] ?? null;

            if (!$username || !$password) {
                http_response_code(400);
                die(json_encode(["error" => "Missing username or password."]));
            }

            try {
                $sql = 'SELECT student_id, password_hash FROM students WHERE username = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$username]);
                $user = $stmt->fetch();

                if ($user && password_verify($password, $user['password_hash'])) {
                    $token = generateToken($user['student_id']);
                    http_response_code(200);
                    echo json_encode(["message" => "Login successful", "token" => $token]);
                } else {
                    http_response_code(401);
                    echo json_encode(["error" => "Invalid username or password."]);
                }
            } catch (\PDOException $e) {
                http_response_code(500);
                die(json_encode(["error" => "Database error: " . $e->getMessage()]));
            }
        } else {
            http_response_code(405);
            die(json_encode(["error" => "Method not allowed for login action."]));
        }
        break;

    case 'profile':
        if ($method === 'GET') {
            if (!$student_id) {
                http_response_code(401);
                die(json_encode(["error" => "Unauthorized."]));
            }
            try {
                // Fetch profile fields + theme_preference
                $sql = 'SELECT student_id, username, full_name, email, bio, profile_picture, theme_preference FROM students WHERE student_id = ?'; 
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$student_id]);
                $profile = $stmt->fetch();

                if (!$profile) {
                    http_response_code(404);
                    die(json_encode(["error" => "Profile not found."]));
                }
                echo json_encode($profile);
            } catch (\PDOException $e) {
                http_response_code(500);
                die(json_encode(["error" => "Database error: " . $e->getMessage()]));
            }
        } 
        elseif ($method === 'PUT') {
            if (!$student_id) {
                http_response_code(401);
                die(json_encode(["error" => "Unauthorized."]));
            }

            // HANDLE THEME UPDATE
            if (isset($input['theme_preference'])) {
                try {
                    $sql = 'UPDATE students SET theme_preference = ? WHERE student_id = ?';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([$input['theme_preference'], $student_id]);
                    echo json_encode(["message" => "Theme updated."]);
                } catch (\PDOException $e) {
                     http_response_code(500);
                     die(json_encode(["error" => "Database error: " . $e->getMessage()]));
                }
                break; // Stop here, don't update other profile fields
            }

            // HANDLE FULL PROFILE UPDATE
            $name = $input['name'] ?? null;
            $username = $input['username'] ?? null;
            $email = $input['email'] ?? null;
            $bio = $input['bio'] ?? '';
            $picture = $input['picture'] ?? null;
            
            if (!$name || !$username || !$email) {
                 http_response_code(400);
                 die(json_encode(["error" => "Missing required fields for update."]));
            }

            try {
                $sql_check = 'SELECT student_id FROM students WHERE (username = ? OR email = ?) AND student_id != ?';
                $stmt_check = $pdo->prepare($sql_check);
                $stmt_check->execute([$username, $email, $student_id]);
                
                if ($stmt_check->rowCount() > 0) {
                    http_response_code(409);
                    die(json_encode(["error" => "Username or email already exists."]));
                }
                
                $sql = 'UPDATE students SET full_name = ?, username = ?, email = ?, bio = ?, profile_picture = ? WHERE student_id = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$name, $username, $email, $bio, $picture, $student_id]);
                
                echo json_encode(["message" => "Profile updated successfully."]);
            } catch (\PDOException $e) {
                http_response_code(500);
                die(json_encode(["error" => "Database error: " . $e->getMessage()]));
            }
        } else {
             http_response_code(405);
             die(json_encode(["error" => "Method not allowed for profile action."]));
        }
        break;

    default:
        http_response_code(400);
        die(json_encode(["error" => "Unknown action."]));
        break;
}
?>