/* app.js - StudyMate shared logic (API + rendering) */

// ===========================================
//  1. CONFIGURATION
// ===========================================
const API_URL = "tasks.php";
const AUTH_URL = "auth.php"; // Needed for theme saving
const TOKEN_KEY = "studymate_auth_token"; 

// ===========================================
//  2. AUTHENTICATION & API DATA FETCH
// ===========================================

function logout() {
    localStorage.removeItem(TOKEN_KEY); 
    window.location.href = 'login.html'; 
}

async function fetchTasks() {
    const token = localStorage.getItem(TOKEN_KEY); 
    if (!token) { logout(); return []; } 

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        
        if (response.status === 401) { logout(); return []; }
        if (!response.ok) throw new Error(`API fetch failed with status: ${response.status}`);
        
        const tasks = await response.json();
        return tasks.map(t => ({
            ...t,
            id: String(t.id),
            completed: t.status === 'Completed',
            subject: t.description || t.subject || '',
            title: t.title || '',
            due_date: t.due_date || null,
            priority: t.priority || 'medium'
        }));

    } catch (e) {
        console.error("Failed to load tasks from API", e);
        return [];
    }
}

// ===========================================
//  3. THEME SYNC LOGIC (NEW)
// ===========================================

// 1. Load theme from DB on page load
async function syncThemeFromApi() {
    const token = localStorage.getItem(TOKEN_KEY);
    // Only sync if logged in and not on login page
    if (!token || document.body.getAttribute('data-page') === 'login') return;

    try {
        const response = await fetch(`${AUTH_URL}?action=profile`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const profile = await response.json();
            if (profile.theme_preference) {
                // applyTheme comes from theme.js
                if (window.applyTheme) {
                    window.applyTheme(profile.theme_preference, true);
                }
            }
        }
    } catch (e) {
        console.warn("Theme sync failed:", e);
    }
}

// 2. Save theme to DB when toggled
async function saveThemeToApi(newTheme) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {
        await fetch(`${AUTH_URL}?action=profile`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme_preference: newTheme })
        });
        console.log("Theme saved to DB:", newTheme);
    } catch (e) {
        console.error("Failed to save theme to DB", e);
    }
}

// ===========================================
//  4. UTILITIES
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

// ===========================================
//  5. RENDERING FUNCTIONS
// ===========================================

async function renderDashboard(filterSubject = "all") {
    const tasks = await fetchTasks();
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = tasks.filter(t => !t.completed && isOverdue(t.due_date)).length;

    const elTotal = document.querySelector("#total-tasks");
    const elCompleted = document.querySelector("#completed-tasks");
    const elPending = document.querySelector("#pending-tasks");
    const elOverdue = document.querySelector("#overdue-tasks");
    if (elTotal) elTotal.textContent = total;
    if (elCompleted) elCompleted.textContent = completed;
    if (elPending) elPending.textContent = pending;
    if (elOverdue) elOverdue.textContent = overdue;

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

    const list = document.querySelector("#task-list");
    if (!list) return;
    const filtered = filterSubject === "all" ? tasks : tasks.filter(t => t.subject === filterSubject);
    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty">No tasks found. Click <strong>Add New Task</strong> to create one.</div>`;
        return;
    }

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
    const tasks = await fetchTasks();
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
//  6. CRUD ACTIONS
// ===========================================

async function sendApiRequest(url, method, body = null) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(url, options);
    if (response.status === 401) { logout(); throw new Error("Unauthorized"); }
    if (!response.ok && response.status !== 204) {
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

async function openEditModal(id) {
    const tasks = await fetchTasks();
    const t = tasks.find(x => x.id == id);
    if (!t) return;
    showModal({ ...t, _edit: true });
}

// ===========================================
//  7. MODAL & REFRESH LOGIC
// ===========================================

function showModal(data = null) {
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

function escapeHtml(txt) {
    if (!txt) return "";
    return String(txt).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function capitalize(s) { if (!s) return ""; return s.charAt(0).toUpperCase() + s.slice(1); }

async function refreshAll() {
    const bodyId = document.body.getAttribute("data-page");
    if (bodyId === "dashboard") {
        const filter = document.querySelector("#subject-filter") ? document.querySelector("#subject-filter").value : "all";
        await renderDashboard(filter);
    } else if (bodyId === "deadlines") {
        await renderDeadlines();
    } else if (bodyId === "subjects") {
        await renderSubjects();
    } else {
        await renderDashboard("all");
    }
}

document.addEventListener("click", (e) => {
    if (e.target && e.target.matches && e.target.matches(".open-add")) {
        showModal(null);
    }
});

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

// INITIALIZE APP
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem(TOKEN_KEY); 
    const isAuthPage = document.body.getAttribute('data-page') === 'login' || 
                       document.body.getAttribute('data-page') === 'register';

    if (!token && !isAuthPage) {
        logout(); 
    } else if (token && !isAuthPage) {
        // 1. Sync Theme on Load
        syncThemeFromApi();

        // 2. Attach GLOBAL Listener for Theme Toggle (fixes issue where toggle didn't save)
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', (e) => {
                const newTheme = e.target.checked ? 'dark' : 'light';
                // theme.js handles the visual change, we handle the database save
                saveThemeToApi(newTheme);
            });
        }
    }
});