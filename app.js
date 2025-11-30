/* app.js - StudyMate shared logic (API + rendering) */

// ===========================================
//  1. CONFIGURATION
// ===========================================
// CRITICAL: Ensure this path is correct for your XAMPP setup:// CORRECT (Relative path - works everywhere)
const API_URL = "tasks.php";
const TOKEN_KEY = "studymate_auth_token"; // Key for storing the auth token

// ===========================================
//  2. AUTHENTICATION & API DATA FETCH
// ===========================================

// Global logout function (used if token is invalid)
function logout() {
    localStorage.removeItem(TOKEN_KEY); 
    // CRITICAL: Redirect to the login page
    window.location.href = 'login.html'; 
}

async function fetchTasks() {
    const token = localStorage.getItem(TOKEN_KEY); 
    
    // Safety check: If no token, API calls will fail, force logout
    if (!token) {
        logout(); 
        return []; 
    } 

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                // PHP API must read this header for authentication
                'Authorization': `Bearer ${token}`, 
                'Content-Type': 'application/json'
            }
        });
        
        // Handle 401 response (Unauthorized/Token Expired)
        if (response.status === 401) {
             logout();
             return [];
        }
        if (!response.ok) throw new Error(`API fetch failed with status: ${response.status}`);
        
        // The API returns DB rows. We map them to match the frontend's expected format.
        const tasks = await response.json();
        return tasks.map(t => ({
            ...t,
            id: String(t.id),
            completed: t.status === 'Completed',
            // Backend uses 'description' for subject
            subject: t.description || t.subject || '',
            title: t.title || '',
            due_date: t.due_date || null,
            priority: t.priority || 'medium'
            
        }));

    } catch (e) {
        console.error("Failed to load tasks from API", e);
        // If the error is a SyntaxError (JSON crash), it means PHP outputted HTML error.
        alert("CRITICAL: Failed to connect to API or server error. Check console for PHP error.");
        return [];
    }
}

// ===========================================
//  3. UTILITIES (Modified for robust date handling)
// ===========================================

function getSafeDate(d) {
    if (!d) return null;
    if (d instanceof Date && !isNaN(d.getTime())) return d;
    if (typeof d === 'string') {
        const datePart = d.split('T')[0];
        const date = new Date(datePart + "T00:00:00");
        return isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}
function formatDate(d) {
    const date = getSafeDate(d);
    if (!date) return "Invalid Date";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function isOverdue(d) {
    const due = getSafeDate(d);
    if (!due) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    due.setHours(0, 0, 0, 0); 
    return due < today;
}

function daysLeftText(d) {
    const due = getSafeDate(d);
    if (!due) return "Invalid Date";
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    due.setHours(0, 0, 0, 0); 

    const diffMs = due.getTime() - today.getTime();
    const diff = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return `${Math.abs(diff)} day(s) overdue`;
    if (diff === 0) return `Due today`;
    if (diff === 1) return `1 day left`;
    return `${diff} days left`;
}

// ===========================================
//  4. RENDERING FUNCTIONS (Made ASYNC)
// ===========================================

async function renderDashboard(filterSubject = "all") {
    const tasks = await fetchTasks(); // <<< API CALL
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = tasks.filter(t => !t.completed && isOverdue(t.due_date)).length;

    // stats
    const elTotal = document.querySelector("#total-tasks");
    const elCompleted = document.querySelector("#completed-tasks");
    const elPending = document.querySelector("#pending-tasks");
    const elOverdue = document.querySelector("#overdue-tasks");
    if (elTotal) elTotal.textContent = total;
    if (elCompleted) elCompleted.textContent = completed;
    if (elPending) elPending.textContent = pending;
    if (elOverdue) elOverdue.textContent = overdue;

    // subject dropdown
    const subjectSet = new Set(tasks.map(t => t.subject).filter(s => s && s.trim().length));
    const subjectSelect = document.querySelector("#subject-filter");
    if (subjectSelect) {
        const current = subjectSelect.value || "all";
        subjectSelect.innerHTML = `<option value="all">All Subjects</option>`;
        Array.from(subjectSet).sort().forEach(s => {
            const opt = document.createElement("option");
            opt.value = s;
            opt.textContent = s;
            subjectSelect.appendChild(opt);
        });
        subjectSelect.value = current;
    }

    // task list
    const list = document.querySelector("#task-list");
    if (!list) return;
    const filtered = filterSubject === "all" ? tasks : tasks.filter(t => t.subject === filterSubject);
    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty">No tasks found. Click <strong>Add New Task</strong> to create one.</div>`;
        return;
    }

    // sort: incomplete -> complete, then by due date
    filtered.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.due_date) - new Date(b.due_date);
    });

    list.innerHTML = filtered.map(t => {
        const overdueClass = !t.completed && isOverdue(t.due_date) ? "overdue" : "";
        const completedClass = t.completed ? "completed" : "";
        return `
      <div class="task-item ${completedClass} ${overdueClass}" data-id="${t.id}">
        <div class="task-left">
          <input type="checkbox" ${t.completed ? "checked" : ""} onclick="toggleComplete('${t.id}')">
          <div>
            <div class="task-title">${escapeHtml(t.title)}</div>
            <div class="task-meta">
              <div class="task-subject">${escapeHtml(t.subject)}</div>
              <div>Due: ${formatDate(t.due_date)} ${(!t.completed && isOverdue(t.due_date)) ? '<span style="color:var(--danger);font-weight:700;margin-left:6px">Overdue</span>' : ''}</div>
              <div style="padding-left:6px">${capitalize(t.priority || 'medium')} priority</div>
            </div>
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" title="Edit" onclick="openEditModal('${t.id}')">✎</button>
          <button class="icon-btn delete-btn" title="Delete" onclick="deleteTask('${t.id}')">🗑</button>
        </div>
      </div>
    `;
    }).join("");
}



async function renderSubjects() {
    const tasks = await fetchTasks(); // <<< API CALL
    if (!document.querySelector("#subjects-list")) return;
    const subjects = {};
    tasks.forEach(t => {
        if (!t.subject) return;
        if (!subjects[t.subject]) subjects[t.subject] = { total: 0, done: 0 };
        subjects[t.subject].total++;
        if (t.completed) subjects[t.subject].done++;
    });

    const keys = Object.keys(subjects).sort();
    if (keys.length === 0) {
        document.querySelector("#subjects-list").innerHTML = `<div class="empty">No subjects yet. Add tasks with subjects first.</div>`;
        return;
    }

    document.querySelector("#subjects-list").innerHTML = keys.map(s => {
        const stat = subjects[s];
        const pct = Math.round((stat.done / stat.total) * 100);
        return `
      <div class="card" style="margin-bottom:12px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:700">${escapeHtml(s)}</div>
          <div style="color:var(--muted)">${stat.done}/${stat.total} completed</div>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%;"></div></div>
      </div>
    `;
    }).join("");
}

// ===========================================
//  5. CRUD ACTIONS (API-Driven)
// ===========================================

async function sendApiRequest(url, method, body = null) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    
    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);

    if (response.status === 401) {
        logout();
        throw new Error("Unauthorized");
    }
    if (!response.ok && response.status !== 204) { // 204 is OK for DELETE
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `API Request Failed with status ${response.status}`);
    }
    return response;
}

async function addTask({ title, subject, due_date, priority }) {
    await sendApiRequest(API_URL, 'POST', { title, subject: subject.trim(), due_date, priority });
    await refreshAll();
}

async function updateTask(updated) {
    const { id, ...data } = updated;
    await sendApiRequest(`${API_URL}/${id}`, 'PUT', { ...data, subject: data.subject.trim() });
    await refreshAll();
}

async function deleteTask(id) {
    if (!confirm("Delete this task?")) return;
    await sendApiRequest(`${API_URL}/${id}`, 'DELETE');
    await refreshAll();
}

async function toggleComplete(id) {
    const tasks = await fetchTasks();
    const task = tasks.find(t => t.id == id); 
    if (!task) return;
    await sendApiRequest(`${API_URL}/${id}`, 'PUT', { completed: !task.completed }); 
    await refreshAll();
}

/* Edit modal support: open with values */
async function openEditModal(id) {
    const tasks = await fetchTasks();
    const t = tasks.find(x => x.id == id);
    if (!t) return;
    showModal({ ...t, _edit: true });
}

// ===========================================
//  6. MODAL & REFRESH LOGIC (Made ASYNC)
// ===========================================

function showModal(data = null) {
    // data === null => create new; data._edit === true => edit existing
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:800">${data && data._edit ? "Edit Task" : "Add New Task"}</div>
      <button id="modal-close" class="icon-btn">✕</button>
    </div>
    <div class="form-grid" style="margin-top:12px">
      <div class="form-row">
        <label>Title</label>
        <input class="input" id="m-title" value="${data ? escapeHtml(data.title) : ''}">
      </div>
      <div class="form-row">
        <label>Subject</label>
        <input class="input" id="m-subject" value="${data ? escapeHtml(data.subject) : ''}">
      </div>
      <div class="form-row">
        <label>Due Date</label>
        <input class="input" type="date" id="m-due" value="${data ? data.due_date : ''}">
      </div>
      <div class="form-row">
        <label>Priority</label>
        <select class="input" id="m-priority">
          <option value="low"${data && data.priority === 'low' ? ' selected' : ''}>Low</option>
          <option value="medium"${!data || data.priority === 'medium' ? ' selected' : ''}>Medium</option>
          <option value="high"${data && data.priority === 'high' ? ' selected' : ''}>High</option>
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button id="modal-cancel" class="add-btn" style="background:#e2e8f0;color:#1f2937">Cancel</button>
      <button id="modal-save" class="add-btn">${data && data._edit ? 'Save Changes' : '+ Add Task'}</button>
    </div>
  `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // set minimum date to today
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("m-due").setAttribute("min", today);

    document.getElementById("modal-close").onclick = () => closeModal();
    document.getElementById("modal-cancel").onclick = () => closeModal();

    document.getElementById("modal-save").onclick = async () => {
        const title = document.getElementById("m-title").value.trim();
        const subject = document.getElementById("m-subject").value.trim();
        const due = document.getElementById("m-due").value;
        const priority = document.getElementById("m-priority").value;

        if (!title || !subject || !due) {
            alert("Please fill title, subject, and due date.");
            return;
        }

        try {
            if (data && data._edit) {
                const updated = { ...data, title, subject, due_date: due, priority };
                delete updated._edit;
                await updateTask(updated);
            } else {
                await addTask({ title, subject, due_date: due, priority });
            }
            closeModal();
        } catch (e) {
            alert("Error saving task: " + e.message);
        }
    };
}

function closeModal() {
    const b = document.getElementById("modal-backdrop");
    if (b) b.remove();
}

/* escape helper */
function escapeHtml(txt) {
    if (!txt) return "";
    return String(txt).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function capitalize(s) { if (!s) return ""; return s.charAt(0).toUpperCase() + s.slice(1); }

/* refresh render on all pages */
async function refreshAll() {
    // determine page by body id
    const bodyId = document.body.getAttribute("data-page");
    if (bodyId === "dashboard") {
        const filter = document.querySelector("#subject-filter") ? document.querySelector("#subject-filter").value : "all";
        await renderDashboard(filter);
    } else if (bodyId === "deadlines") {
        await renderDeadlines();
    } else if (bodyId === "subjects") {
        await renderSubjects();
    } else {
        // default: update counts if present
        await renderDashboard("all");
    }
}

/* when DOM ready, attach any global listeners for dashboard */
document.addEventListener("click", (e) => {
    if (e.target && e.target.matches && e.target.matches(".open-add")) {
        showModal(null);
    }
});

// app.js (snippet)
const addBtn = document.querySelector('.open-add');
const modalBackdrop = document.querySelector('.modal-backdrop');

if (addBtn) {
    addBtn.addEventListener('click', () => {
        if (modalBackdrop) {
            modalBackdrop.style.display = 'flex';
            modalBackdrop.classList.add('show');
        }
    });
}

if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            modalBackdrop.classList.remove('show');
            setTimeout(() => (modalBackdrop.style.display = 'none'), 300);
        }
    });
}

window.logout = logout; 

// Run the initial Route Guard check after the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem(TOKEN_KEY); 
    // Check if the current body has a data-page attribute for login or register
    const isAuthPage = document.body.getAttribute('data-page') === 'login' || 
                       document.body.getAttribute('data-page') === 'register';

    // If no token AND not on an authentication page, redirect.
    if (!token && !isAuthPage) {
        // This calls the robust logout() function defined earlier, which handles the redirect.
        logout(); 
    }
});