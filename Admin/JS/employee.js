
const EMPLOYEE_FIELD_IDS = ["eplID", "eplFullName", "roleID", "eplSalary", "eplPhone", "eplEmail"];
let employeeRows = [];
let employeeEditId = null;
let employeePage = 1;
let employeeRoleFilter = "";
const EMPLOYEE_PAGE_SIZE = 5;

function employeeForm() {
    const form = document.getElementById("employeeForm");
    if (!form) return null;
    return Object.fromEntries(EMPLOYEE_FIELD_IDS.map(id => [id, form.querySelector(`#${id}`)]));
}

function employeeMessage(message, type = "ok") {
    if (typeof toast === "function") toast(message, type);
    else window.alert(message);
}

function employeeInitials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2)
        .map(part => part.charAt(0).toUpperCase()).join("");
}

async function loadEmployeeRoles(selectedId = "") {
    const select = document.getElementById("roleID");
    if (!select) return;
    try {
        const roles = await apiGet("role");
        select.innerHTML = '<option value="">Select role...</option>' +
            (Array.isArray(roles) ? roles : []).map(role =>
                `<option value="${escapeHtml(role.RoleID)}">${escapeHtml(role.RoleName)}</option>`
            ).join("");
        select.value = String(selectedId || "");
    } catch (error) {
        select.innerHTML = '<option value="">Roles unavailable</option>';
        console.error("Failed to load employee roles:", error);
    }
}

async function loadEmployees() {
    const body = document.getElementById("employeeTableBody");
    if (!body) return;
    body.innerHTML = '<tr><td colspan="7" class="empty-message">Loading employees...</td></tr>';
    try {
        const response = await apiGet("employees");
        employeeRows = Array.isArray(response) ? response : [];
        filterEmployees();
    } catch (error) {
        console.error("Failed to load employees:", error);
        body.innerHTML = `<tr><td colspan="7" class="empty-message">Could not load employees: ${escapeHtml(error.message)}</td></tr>`;
    }
}

function filterEmployees(resetPage = true) {
    if (resetPage) employeePage = 1;
    const query = (document.getElementById("employeeSearch")?.value || "").trim().toLowerCase();
    const rows = employeeRows.filter(employee => {
        if (employeeRoleFilter && String(employee.RoleName || "") !== employeeRoleFilter) return false;
        return !query || [
        employee.EmployeeID, employee.FullName, employee.RoleName, employee.Salary, employee.Phone, employee.Email
        ].some(value => String(value ?? "").toLowerCase().includes(query));
    });
    renderEmployees(rows);
}

function renderEmployees(rows) {
    const body = document.getElementById("employeeTableBody");
    if (!body) return;
    const pages = Math.max(1, Math.ceil(rows.length / EMPLOYEE_PAGE_SIZE));
    employeePage = Math.min(employeePage, pages);
    const start = (employeePage - 1) * EMPLOYEE_PAGE_SIZE;
    const visibleRows = rows.slice(start, start + EMPLOYEE_PAGE_SIZE);
    if (!visibleRows.length) {
        body.innerHTML = '<tr><td colspan="7" class="empty-message">No employees found.</td></tr>';
    } else {
        body.innerHTML = visibleRows.map(employee => {
            const id = escapeHtml(employee.EmployeeID);
            const name = escapeHtml(employee.FullName || "");
            const salary = employee.Salary === null || employee.Salary === "" ? "—" : escapeHtml(employee.Salary);
            return `<tr>
                <td class="cell-primary">EMP-${id}</td>
                <td><div class="row-avatar"><span class="mini-avatar">${escapeHtml(employeeInitials(employee.FullName))}</span>${name}</div></td>
                <td>${escapeHtml(employee.RoleName || "Unassigned")}</td>
                <td>${salary}</td>
                <td>${escapeHtml(employee.Phone || "—")}</td>
                <td>${escapeHtml(employee.Email || "—")}</td>
                <td class="row-actions">
                    <button type="button" class="ricon" title="Edit employee" aria-label="Edit ${name}" data-action="edit" data-id="${id}">✎</button>
                    <button type="button" class="ricon" title="Delete employee" aria-label="Delete ${name}" data-action="delete" data-id="${id}">⌫</button>
                </td>
            </tr>`;
        }).join("");
    }
    renderEmployeePagination(rows.length, pages);
}

function renderEmployeePagination(total, pages) {
    const pagination = document.querySelector("#sec-employees .pagination");
    const summary = pagination?.querySelector("span");
    const controls = pagination?.querySelector(".page-btns");
    if (!summary || !controls) return;
    const from = total ? (employeePage - 1) * EMPLOYEE_PAGE_SIZE + 1 : 0;
    const to = Math.min(total, employeePage * EMPLOYEE_PAGE_SIZE);
    summary.textContent = `Showing ${from}–${to} of ${total} employees`;
    controls.innerHTML = pages <= 1 ? "" :
        `<button type="button" class="page-btn" data-page="${employeePage - 1}" aria-label="Previous page">‹</button>` +
        Array.from({ length: pages }, (_, index) => index + 1).map(page =>
            `<button type="button" class="page-btn ${page === employeePage ? "active" : ""}" data-page="${page}" aria-current="${page === employeePage ? "page" : "false"}">${page}</button>`
        ).join("") +
        `<button type="button" class="page-btn" data-page="${employeePage + 1}" aria-label="Next page">›</button>`;
    controls.onclick = event => {
        const button = event.target.closest("[data-page]");
        if (!button) return;
        const page = Number(button.dataset.page);
        if (page >= 1 && page <= pages) { employeePage = page; filterEmployees(false); }
    };
}

function clearEmployeeForm() {
    const form = document.getElementById("employeeForm");
    if (!form) return;
    form.reset();
    employeeEditId = null;
    const idField = document.getElementById("eplID");
    idField.readOnly = false;
    const submit = document.getElementById("employeeSubmitBtn");
    if (submit) submit.textContent = "Add Employee";
    loadEmployeeRoles();
}

async function editEmployee(id) {
    try {
        const employee = await apiGet("employees", id);
        const fields = employeeForm();
        if (!fields) return;
        employeeEditId = String(employee.EmployeeID);
        fields.eplID.value = employee.EmployeeID ?? "";
        fields.eplID.readOnly = true;
        fields.eplFullName.value = employee.FullName ?? "";
        fields.eplSalary.value = employee.Salary ?? "";
        fields.eplPhone.value = employee.Phone ?? "";
        fields.eplEmail.value = employee.Email ?? "";
        await loadEmployeeRoles(employee.RoleID);
        document.getElementById("employeeSubmitBtn").textContent = "Save Changes";
        openEmbeddedForm("employeeForm", "Edit Employee");
        fields.eplFullName.focus();
    } catch (error) {
        employeeMessage(`Could not load employee: ${error.message}`, "error");
    }
}

async function saveEmployee(event) {
    event?.preventDefault();
    const form = document.getElementById("employeeForm");
    const fields = employeeForm();
    if (!form || !fields || !form.reportValidity()) return;
    const data = {
        fname: fields.eplFullName.value.trim(),
        rid: fields.roleID.value,
        salary: fields.eplSalary.value,
        phone: fields.eplPhone.value.trim(),
        email: fields.eplEmail.value.trim()
    };
    if (employeeEditId) data.id = employeeEditId;
    else if (fields.eplID.value.trim()) data.id = fields.eplID.value.trim();

    const button = document.getElementById("employeeSubmitBtn");
    button.disabled = true;
    try {
        if (employeeEditId) await apiPut("employees", data);
        else await apiPost("employees", data);
        employeeMessage(employeeEditId ? "Employee updated." : "Employee added.");
        clearEmployeeForm();
        closeModal();
        await loadEmployees();
    } catch (error) {
        employeeMessage(`Could not save employee: ${error.message}`, "error");
    } finally {
        button.disabled = false;
    }
}

async function deleteEmployee(id) {
    const employee = employeeRows.find(row => String(row.EmployeeID) === String(id));
    if (!employee || !window.confirm(`Delete ${employee.FullName}? This cannot be undone.`)) return;
    try {
        await apiDelete("employees", id);
        if (employeeEditId === String(id)) clearEmployeeForm();
        employeeMessage("Employee deleted.");
        await loadEmployees();
    } catch (error) {
        employeeMessage(`Could not delete employee: ${error.message}`, "error");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadEmployeeRoles();
    loadEmployees();
    document.getElementById("employeeForm")?.addEventListener("submit", saveEmployee);
    document.getElementById("employeeSubmitBtn")?.addEventListener("click", saveEmployee);
    document.getElementById("employeeClearBtn")?.addEventListener("click", clearEmployeeForm);
    document.getElementById("newEmployeeBtn")?.addEventListener("click", () => {
        clearEmployeeForm();
        openEmbeddedForm("employeeForm", "Add Employee");
        document.getElementById("eplFullName")?.focus({ preventScroll: true });
    });
    document.getElementById("employeeSearch")?.addEventListener("input", filterEmployees);
    const roleFilter = document.getElementById("employeeRoleFilter");
    const cycleRoleFilter = () => {
        const options = ["", ...new Set(employeeRows.map(row => row.RoleName).filter(Boolean))];
        employeeRoleFilter = options[(options.indexOf(employeeRoleFilter) + 1) % options.length];
        if (roleFilter) roleFilter.textContent = `Department: ${employeeRoleFilter || "All"}`;
        filterEmployees();
    };
    roleFilter?.addEventListener("click", cycleRoleFilter);
    roleFilter?.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); cycleRoleFilter(); } });
    document.getElementById("employeeTableBody")?.addEventListener("click", event => {
        const action = event.target.closest("[data-action]");
        if (!action) return;
        if (action.dataset.action === "edit") editEmployee(action.dataset.id);
        if (action.dataset.action === "delete") deleteEmployee(action.dataset.id);
    });
});
