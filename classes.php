<?php
// classes.php - Domain Logic based on UML

require_once 'db_connect.php';

// --- STUDENT CLASS ---
class Student {
    private $pdo;
    private $student_id;

    public function __construct($pdo, $student_id = null) {
        $this->pdo = $pdo;
        $this->student_id = $student_id;
    }

    public function register($fullName, $username, $email, $password) {
        // Check if exists
        $stmt = $this->pdo->prepare("SELECT student_id FROM students WHERE username = ? OR email = ?");
        $stmt->execute([$username, $email]);
        if ($stmt->rowCount() > 0) return ["error" => "User already exists", "code" => 409];

        // Create
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $this->pdo->prepare("INSERT INTO students (full_name, username, email, password_hash) VALUES (?, ?, ?, ?)");
        $stmt->execute([$fullName, $username, $email, $hash]);
        return ["message" => "Registration successful", "code" => 201];
    }

    public function login($username, $password) {
        $stmt = $this->pdo->prepare("SELECT student_id, password_hash FROM students WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            return ["student_id" => $user['student_id'], "code" => 200];
        }
        return ["error" => "Invalid credentials", "code" => 401];
    }

    public function getProfile() {
        $stmt = $this->pdo->prepare("SELECT student_id, username, full_name, email, bio, profile_picture, theme_preference FROM students WHERE student_id = ?");
        $stmt->execute([$this->student_id]);
        return $stmt->fetch();
    }

    public function updateProfile($name, $username, $email, $bio, $picture) {
        // Check duplicates excluding self
        $stmt = $this->pdo->prepare("SELECT student_id FROM students WHERE (username = ? OR email = ?) AND student_id != ?");
        $stmt->execute([$username, $email, $this->student_id]);
        if ($stmt->rowCount() > 0) throw new Exception("Username/Email taken");

        $sql = "UPDATE students SET full_name = ?, username = ?, email = ?, bio = ?, profile_picture = ? WHERE student_id = ?";
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute([$name, $username, $email, $bio, $picture, $this->student_id]);
    }
    
    // Per UML: Student manages allowance settings
    public function setAllowance($amount) {
        $stmt = $this->pdo->prepare("UPDATE students SET monthly_allowance = ? WHERE student_id = ?");
        return $stmt->execute([$amount, $this->student_id]);
    }
    
    public function setTheme($theme) {
        $stmt = $this->pdo->prepare("UPDATE students SET theme_preference = ? WHERE student_id = ?");
        return $stmt->execute([$theme, $this->student_id]);
    }
}

// --- TASK CLASS ---
class Task {
    private $pdo;
    private $student_id;

    public function __construct($pdo, $student_id) {
        $this->pdo = $pdo;
        $this->student_id = $student_id;
    }

    public function createTask($title, $subject, $dueDate, $priority) {
        // NOTE: Mapping 'subject' to 'description' column to match your DB schema
        $sql = "INSERT INTO tasks (student_id, title, description, due_date, status, priority) VALUES (?, ?, ?, ?, 'Pending', ?)";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$this->student_id, $title, $subject, $dueDate, $priority]);
        return $this->pdo->lastInsertId();
    }

    // This fulfills the "has" relationship (Student has Tasks)
    public function getAllTasks() {
        $sql = "SELECT task_id as id, title, description as subject, due_date, status, priority FROM tasks WHERE student_id = ? ORDER BY status ASC, due_date ASC";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$this->student_id]);
        return $stmt->fetchAll();
    }

    public function update($taskId, $title, $subject, $dueDate, $status, $priority) {
        $sql = "UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ?, priority = ? WHERE task_id = ? AND student_id = ?";
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute([$title, $subject, $dueDate, $status, $priority, $taskId, $this->student_id]);
    }

    public function toggleStatus($taskId, $completed) {
        $status = $completed ? 'Completed' : 'Pending';
        $stmt = $this->pdo->prepare("UPDATE tasks SET status = ? WHERE task_id = ? AND student_id = ?");
        return $stmt->execute([$status, $taskId, $this->student_id]);
    }

    public function delete($taskId) {
        $stmt = $this->pdo->prepare("DELETE FROM tasks WHERE task_id = ? AND student_id = ?");
        return $stmt->execute([$taskId, $this->student_id]);
    }
}

// --- EXPENSE CLASS ---
class Expense {
    private $pdo;
    private $student_id;

    public function __construct($pdo, $student_id) {
        $this->pdo = $pdo;
        $this->student_id = $student_id;
    }

    public function add($amount, $category, $description, $date) {
        $sql = "INSERT INTO expenses (student_id, amount, category, description, expense_date) VALUES (?, ?, ?, ?, ?)";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$this->student_id, $amount, $category, $description, $date]);
        return $this->pdo->lastInsertId();
    }

    public function delete($expenseId) {
        $stmt = $this->pdo->prepare("DELETE FROM expenses WHERE expense_id = ? AND student_id = ?");
        $stmt->execute([$expenseId, $this->student_id]);
        return $stmt->rowCount() > 0;
    }
}

// --- BUDGET TRACKER CLASS ---
class BudgetTracker {
    private $pdo;
    private $student_id;

    public function __construct($pdo, $student_id) {
        $this->pdo = $pdo;
        $this->student_id = $student_id;
    }

    // Combines Allowance (from Student) and Expenses (Aggregation)
    public function getFinanceSummary() {
        // 1. Get Allowance
        $stmt = $this->pdo->prepare("SELECT monthly_allowance FROM students WHERE student_id = ?");
        $stmt->execute([$this->student_id]);
        $res = $stmt->fetch();
        $allowance = $res ? (float)$res['monthly_allowance'] : 0.00;

        // 2. Get All Expenses (ListExpense in UML)
        $stmt = $this->pdo->prepare("SELECT expense_id as id, amount, category, description, expense_date as date FROM expenses WHERE student_id = ? ORDER BY expense_date DESC");
        $stmt->execute([$this->student_id]);
        $expenses = $stmt->fetchAll();

        return [
            "allowance" => $allowance,
            "expenses" => $expenses
            // Calculation of remaining is done on frontend, or can be added here
        ];
    }
}
?>