/* app.js - StudyMate shared logic (localStorage + rendering) */

const STORAGE_KEY = "studymate_tasks_v1";

/* Task model
  {
    id: 'unique',
    title: 'text',
    subject: 'Math',
    due_date: 'YYYY-MM-DD',
    priority: 'low|medium|high',
    completed: false,
    created_at: timestamp
  }
*/

function loadTasks() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
        console.error("Failed to parse tasks", e);
        return [];
    }
}

function saveTasks(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/* Utilities */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}
function formatDate(d) {
    if (!d) return "";
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function isOverdue(d) {
    const today = new Date();
    const due = new Date(d + "T23:59:59");
    return due < today;
}

/* Dashboard: render stats and task list with optional filter */
function renderDashboard(filterSubject = "all") {
    const tasks = loadTasks();
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

    // subject dropdown (unique subjects)
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
              <div style="padding-left:6px">${capitalize(t.priority)} priority</div>
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

/* Deadlines page */
function renderDeadlines() {
    const tasks = loadTasks();
    if (!document.querySelector("#deadlines-list")) return;
    if (tasks.length === 0) {
        document.querySelector("#deadlines-list").innerHTML = `<div class="empty">No tasks yet.</div>`;
        return;
    }

    // sort by due date ascending
    const sorted = [...tasks].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    document.querySelector("#deadlines-list").innerHTML = sorted.map(t => {
        const overdueClass = !t.completed && isOverdue(t.due_date) ? "overdue" : "";
        return `
      <div class="deadline-item ${overdueClass}">
        <div>
          <div style="font-weight:700">${escapeHtml(t.title)}</div>
          <div style="color:var(--muted);font-size:0.9rem">${escapeHtml(t.subject)} • ${formatDate(t.due_date)}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          ${t.completed ? '<div style="color:var(--success);font-weight:700">Completed</div>' : (isOverdue(t.due_date) ? '<div style="color:var(--danger);font-weight:700">Overdue</div>' : `<div style="color:var(--muted)">${daysLeftText(t.due_date)}</div>`)}
          <button class="icon-btn delete-btn" onclick="deleteTask('${t.id}')">🗑</button>
        </div>
      </div>
    `;
    }).join("");
}

/* Subjects page: show list of subjects and progress */
function renderSubjects() {
    const tasks = loadTasks();
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

/* helpers for days left */
function daysLeftText(d) {
    const today = new Date();
    const due = new Date(d + "T23:59:59");
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)} day(s) overdue`;
    if (diff === 0) return `Due today`;
    if (diff === 1) return `1 day left`;
    return `${diff} days left`;
}

/* CRUD actions used across pages */
function addTask({ title, subject, due_date, priority }) {
    const tasks = loadTasks();
    const t = {
        id: uid(),
        title: title.trim(),
        subject: subject.trim(),
        due_date: due_date,
        priority: priority || "medium",
        completed: false,
        created_at: new Date().toISOString()
    };
    tasks.push(t);
    saveTasks(tasks);
    refreshAll();
}

function updateTask(updated) {
    const tasks = loadTasks();
    const idx = tasks.findIndex(t => t.id === updated.id);
    if (idx === -1) return;
    tasks[idx] = updated;
    saveTasks(tasks);
    refreshAll();
}

function deleteTask(id) {
    if (!confirm("Delete this task?")) return;
    const tasks = loadTasks().filter(t => t.id !== id);
    saveTasks(tasks);
    refreshAll();
}

/* toggle complete */
function toggleComplete(id) {
    const tasks = loadTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    tasks[idx].completed = !tasks[idx].completed;
    saveTasks(tasks);
    refreshAll();
}

/* Edit modal support: open with values */
function openEditModal(id) {
    const tasks = loadTasks();
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    // reuse modal show, populate fields
    showModal({ ...t, _edit: true });
}

/* Modal system: used on Dashboard only */
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

    document.getElementById("modal-save").onclick = () => {
        const title = document.getElementById("m-title").value.trim();
        const subject = document.getElementById("m-subject").value.trim();
        const due = document.getElementById("m-due").value;
        const priority = document.getElementById("m-priority").value;

        if (!title || !subject || !due) {
            alert("Please fill title, subject, and due date.");
            return;
        }

        if (data && data._edit) {
            const updated = { ...data, title, subject, due_date: due, priority };
            delete updated._edit;
            updateTask(updated);
        } else {
            addTask({ title, subject, due_date: due, priority });
        }
        closeModal();
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
function refreshAll() {
    // determine page by body id
    const bodyId = document.body.getAttribute("data-page");
    if (bodyId === "dashboard") {
        const filter = document.querySelector("#subject-filter") ? document.querySelector("#subject-filter").value : "all";
        renderDashboard(filter);
    } else if (bodyId === "deadlines") {
        renderDeadlines();
    } else if (bodyId === "subjects") {
        renderSubjects();
    } else {
        // default: update counts if present
        renderDashboard("all");
    }
}

/* when DOM ready, attach any global listeners for dashboard */
document.addEventListener("click", (e) => {
    if (e.target && e.target.matches && e.target.matches(".open-add")) {
        showModal(null);
    }
});
