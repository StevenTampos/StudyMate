<?php
// auth.php - Refactored to OOP
require_once 'classes.php'; // Includes db_connect.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

// Initialize DB
$db = new Database();
$pdo = $db->connect();

// Helper for Token (Procedural helper kept for JWT handling)
function generateToken($id) {
    $payload = ['studentId' => $id, 'exp' => time() + 86400];
    return base64_encode(json_encode($payload));
}

// Get Action
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;
$input = json_decode(file_get_contents('php://input'), true);

// Auth Middleware Logic
$headers = apache_request_headers();
$token = isset($headers['Authorization']) ? $headers['Authorization'] : (isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : null);
$studentId = null;

if ($token && strpos($token, 'Bearer ') === 0) {
    $data = json_decode(base64_decode(substr($token, 7)), true);
    if ($data && isset($data['studentId'])) $studentId = $data['studentId'];
}

// Instantiate Student
$student = new Student($pdo, $studentId);

switch ($action) {
    case 'register':
        if ($method !== 'POST') break;
        $res = $student->register($input['fullName'], $input['username'], $input['email'], $input['password']);
        http_response_code($res['code']);
        echo json_encode($res);
        break;

    case 'login':
        if ($method !== 'POST') break;
        $res = $student->login($input['username'], $input['password']);
        http_response_code($res['code']);
        if ($res['code'] === 200) {
            echo json_encode(["message" => "Login successful", "token" => generateToken($res['student_id'])]);
        } else {
            echo json_encode($res);
        }
        break;

    case 'profile':
        if (!$studentId) { http_response_code(401); echo json_encode(["error"=>"Unauthorized"]); break; }
        
        if ($method === 'GET') {
            echo json_encode($student->getProfile());
        } elseif ($method === 'PUT') {
            if (isset($input['theme_preference'])) {
                $student->setTheme($input['theme_preference']);
                echo json_encode(["message" => "Theme updated"]);
            } else {
                try {
                    $student->updateProfile($input['name'], $input['username'], $input['email'], $input['bio'], $input['picture']);
                    echo json_encode(["message" => "Profile updated"]);
                } catch (Exception $e) {
                    http_response_code(409);
                    echo json_encode(["error" => $e->getMessage()]);
                }
            }
        }
        break;
        
    default:
        http_response_code(400); echo json_encode(["error" => "Invalid action"]);
}
?>