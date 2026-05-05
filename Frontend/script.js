const API = "http://localhost:3000/api";
let dbSchema = {};
let currentTable = null;

// Auth State
let currentUser = null;

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('dbms_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showApp();
    } else {
        showLogin();
    }
    
    document.getElementById("loginForm").addEventListener("submit", handleLogin);
    document.getElementById("dynamicForm").addEventListener("submit", addRecord);
});

function showLogin() {
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('loginContainer').style.display = 'flex';
}

function showApp() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex'; // Ensure flex layout works for Sidebar and Main
    
    if(currentUser) {
       document.getElementById('userAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
       document.getElementById('userAvatar').title = `Logout (${currentUser.username} - ${currentUser.role})`;
    }
    
    fetchSchema();
}

function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    const errorMsg = document.getElementById("loginError");
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    btn.innerHTML = "Signing in...";
    btn.disabled = true;
    errorMsg.style.display = 'none';
    
    fetch(API + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Login failed");
        }
        return res.json();
    })
    .then(user => {
        // Ensure role is normalized for frontend logic
        if(user && user.role) user.role = user.role.toLowerCase();
        currentUser = user;
        localStorage.setItem('dbms_user', JSON.stringify(user));
        document.getElementById("loginForm").reset();
        showApp();
    })
    .catch(err => {
        errorMsg.textContent = err.message;
        errorMsg.style.display = 'block';
    })
    .finally(() => {
        btn.innerHTML = "Sign In";
        btn.disabled = false;
    });
}

function logout() {
    currentUser = null;
    localStorage.removeItem('dbms_user');
    dbSchema = {};
    currentTable = null;
    showLogin();
}

// Fetch full schema from backend
function fetchSchema() {
    fetch(API + "/schema")
    .then(res => res.json())
    .then(schema => {
        dbSchema = schema;
        renderSidebar();
    })
    .catch(err => {
        console.error("Error fetching schema:", err);
        document.getElementById("sidebarMenu").innerHTML = `<li style="color: var(--danger)">Failed to load schema</li>`;
    });
}

function renderSidebar() {
    const menu = document.getElementById("sidebarMenu");
    menu.innerHTML = "";
    
    // Convert schema tables into sidebar items. We skip views if possible, but our backend doesn't filter them yet.
    // For this dashboard, we'll list all entities returned.
    const tables = Object.keys(dbSchema);
    
    if (tables.length === 0) {
        menu.innerHTML = `<li>No tables found</li>`;
        return;
    }

    tables.forEach((table, index) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span style="text-transform: capitalize;">${table.replace(/_/g, ' ')}</span>
        `;
        li.onclick = () => loadTable(table);
        menu.appendChild(li);
    });

    // Default load first table
    loadTable(tables[0]);
}

function loadTable(table) {
    currentTable = table;
    const cols = dbSchema[table];

    // Update active UI state
    document.querySelectorAll('#sidebarMenu li').forEach(li => {
        if(li.textContent.toLowerCase().trim() === table.replace(/_/g, ' ').toLowerCase()) {
            li.classList.add('active');
        } else {
            li.classList.remove('active');
        }
    });

    document.getElementById("pageTitle").textContent = table.replace(/_/g, ' ').toUpperCase();
    
    let role = currentUser ? (currentUser.role || '').toLowerCase() : '';
    let canAdd = role === 'admin' || role === 'editor' || role === 'manager' || role === 'staff';
    
    if (canAdd) {
        document.getElementById("headerNewBtn").style.display = "inline-flex";
        document.getElementById("headerNewBtn").style.visibility = "visible";
    } else {
        document.getElementById("headerNewBtn").style.display = "none";
    }

    document.getElementById("mainDashboard").style.display = "grid";

    buildForm(cols);
    fetchData(table, cols);
}

function buildForm(columns) {
    const formContainer = document.getElementById("formInputs");
    formContainer.innerHTML = "";
    
    let role = currentUser ? (currentUser.role || '').toLowerCase() : '';
    let canAdd = role === 'admin' || role === 'editor' || role === 'manager' || role === 'staff';
    
    if (!canAdd) {
         document.getElementById('dynamicForm').style.display = 'none';
         document.getElementById('formTitle').textContent = `View Only (${currentUser ? currentUser.role : 'viewer'})`;
    } else {
         document.getElementById('dynamicForm').style.display = 'block';
         document.getElementById('formTitle').textContent = `Add New ${currentTable.replace(/_/g, ' ')}`;
    }

    columns.forEach(col => {
        // Map SQL types to HTML input types
        let inputType = "text";
        let stepAttr = "";
        if (col.type.includes("int")) {
            inputType = "number";
        } else if (col.type.includes("decimal") || col.type.includes("float")) {
            inputType = "number";
            stepAttr = 'step="0.01"';
        } else if (col.type.includes("date") || col.type.includes("datetime")) {
            inputType = "date";
        }

        let constraintsHtml = [];
        let htmlValAttrs = [];
        
        if (col.maxLength) {
             constraintsHtml.push(`Max Length: ${col.maxLength}`);
             htmlValAttrs.push(`maxlength="${col.maxLength}"`);
        }
        // Auto increment or primary keys usually shouldn't be user-edited directly if auto, but we make required except ID
        if (!col.isNullable && !col.isPrimaryKey) {
             constraintsHtml.push("Required");
             htmlValAttrs.push("required");
        }
        if (col.columnType) {
             constraintsHtml.push(`Type: ${col.columnType}`);
        }
        
        let helperText = constraintsHtml.length > 0 ? `<span class="constraint-text">${constraintsHtml.join(' | ')}</span>` : '';

        formContainer.innerHTML += `
            <div class="form-group">
                <label for="${col.name}">${col.name.replace(/_/g, ' ').toUpperCase()}</label>
                <input type="${inputType}" ${stepAttr} id="${col.name}" name="${col.name}" class="form-control" placeholder="Enter ${col.name}" ${htmlValAttrs.join(' ')}>
                ${helperText}
            </div>
        `;
    });
}

function fetchData(table, columns) {
    const tbody = document.getElementById("dataTableBody");
    const thead = document.getElementById("tableHeaderRow");
    
    // Set headers
    thead.innerHTML = columns.map(col => `<th>${col.name.replace(/_/g, ' ').toUpperCase()}</th>`).join('');
    
    let role = currentUser ? (currentUser.role || '').toLowerCase() : '';
    let isAdmin = role === 'admin';
    if (isAdmin) {
        thead.innerHTML += `<th>ACTIONS</th>`;
    }

    tbody.innerHTML = `<tr><td colspan="${isAdmin ? columns.length + 1 : columns.length}" class="loading">Loading data...</td></tr>`;

    fetch(`${API}/data/${table}`)
    .then(res => res.json())
    .then(data => {
        tbody.innerHTML = "";
        
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columns.length + 1}" style="text-align: center; color: var(--text-secondary);">No records found.</td></tr>`;
            return;
        }

        data.forEach((row, index) => {
            const delay = index * 0.05;
            let trHtml = `<tr class="animate-fade-in" style="animation-delay: ${delay}s">`;
            
            columns.forEach(col => {
                let cellValue = row[col.name] !== null ? row[col.name] : '-';
                if (col.type.includes('date') && cellValue !== '-') {
                    cellValue = new Date(cellValue).toLocaleDateString();
                }
                trHtml += `<td>${cellValue}</td>`;
            });
            
            // Look for a potential primary key to delete by
            const pkField = columns.find(c => c.isPrimaryKey) || columns[0];
            const pkValue = row[pkField.name];
            
            if (isAdmin) {
                trHtml += `<td>
                    <button onclick="deleteRecord('${table}', '${pkField.name}', '${pkValue}')" class="btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--danger); color: white; width: auto;">Delete</button>
                </td>`;
            }
            trHtml += `</tr>`;
            tbody.innerHTML += trHtml;
        });
    })
    .catch(err => {
        tbody.innerHTML = `<tr><td colspan="${isAdmin ? columns.length + 1 : columns.length}" style="text-align: center; color: var(--danger);">Failed to load data.</td></tr>`;
        console.error("Error fetching data:", err);
    });
}

function addRecord(event) {
    event.preventDefault();

    if (!currentTable) return;

    const btn = document.getElementById("submitBtn");
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin" style="animation: spin 1s linear infinite; margin-right: 8px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Saving...`;
    btn.disabled = true;

    // Gather dynamic payload
    const data = {};
    dbSchema[currentTable].forEach(col => {
        const input = document.getElementById(col.name);
        if(input) {
            data[col.name] = input.value;
        }
    });

    fetch(`${API}/data/${currentTable}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(async response => {
        if (!response.ok) {
            const errText = await response.json();
            throw new Error(errText.error || "Failed to add record");
        }
        document.getElementById("dynamicForm").reset();
        fetchData(currentTable, dbSchema[currentTable]);
    })
    .catch(err => {
        console.error("Error adding record:", err);
        alert(`Failed to add record: \n${err.message}`);
    })
    .finally(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}

function deleteRecord(table, idField, id) {
    if(!confirm("Are you sure you want to delete this record?")) return;
    
    fetch(`${API}/data/${table}/${idField}/${id}`, {
        method: "DELETE"
    })
    .then(async response => {
        if (!response.ok) throw new Error("Failed to delete record");
        fetchData(currentTable, dbSchema[currentTable]);
    })
    .catch(err => {
        console.error("Error deleting:", err);
        alert("Failed to delete record. Ensure it does not violate foreign key constraints.");
    });
}

// Add animation keyframes for loader
if(!document.getElementById('keyframesStyle')) {
    const style = document.createElement('style');
    style.id = 'keyframesStyle';
    style.innerHTML = `
    @keyframes spin {
        100% { transform: rotate(360deg); }
    }
    `;
    document.head.appendChild(style);
}
