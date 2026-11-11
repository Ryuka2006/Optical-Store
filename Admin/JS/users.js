
let userCache = [];
const userView = { search: "", role: "", status: "", page: 1, pageSize: 5 };

function userNotice(message, type = "ok") {
    if (typeof toast === "function") toast(message, type);
    else window.alert(message);
}

async function loadUsers() {
    const body = document.getElementById("userTableBody");
    if (!body) return;
    body.innerHTML = '<tr><td colspan="7" class="empty-message">Loading users...</td></tr>';
    try {
        const result = await apiGet("users");
        userCache = Array.isArray(result) ? result : [];
        renderUsers();
    } catch (error) {
        body.innerHTML = `<tr><td colspan="7" class="empty-message">Could not load users: ${escapeHtml(error.message)}</td></tr>`;
    }
}

function filteredUsers() {
    return userCache.filter(user => {
        if (userView.role && String(user.RoleName) !== userView.role) return false;
        if (userView.status && String(user.Status) !== userView.status) return false;
        if (!userView.search) return true;
        return [user.UserID, user.EmployeeID, user.EmployeeName, user.EmployeeEmail, user.RoleName, user.Username, user.Status]
            .some(value => String(value ?? "").toLowerCase().includes(userView.search));
    });
}

function renderUsers() {
    const body = document.getElementById("userTableBody");
    if (!body) return;
    const rows = filteredUsers();
    const pages = Math.max(1, Math.ceil(rows.length / userView.pageSize));
    userView.page = Math.min(userView.page, pages);
    const start = (userView.page - 1) * userView.pageSize;
    const pageRows = rows.slice(start, start + userView.pageSize);
    if (!pageRows.length) {
        body.innerHTML = '<tr><td colspan="7" class="empty-message">No users match your search.</td></tr>';
    } else {
        body.innerHTML = pageRows.map(user => {
            const id = escapeHtml(user.UserID);
            const name = escapeHtml(user.EmployeeName || "Unassigned");
            const username = escapeHtml(user.Username || "");
            const role = escapeHtml(user.RoleName || "Unassigned");
            const status = String(user.Status || "Inactive");
            return `<tr>
                <td class="cell-primary">USR-${id}</td>
                <td><div class="row-avatar"><span class="mini-avatar">${escapeHtml(initials(name))}</span>${name}</div></td>
                <td>${username}</td>
                <td>${escapeHtml(user.EmployeeEmail || "—")}</td>
                <td>${role}</td>
                <td>${badge(status, status === "Active" ? "green" : "red")}</td>
                <td class="row-actions">
                    <button type="button" class="ricon" data-action="edit" data-id="${id}" aria-label="Edit ${username}" title="Edit user">✎</button>
                    <button type="button" class="ricon" data-action="delete" data-id="${id}" aria-label="Delete ${username}" title="Delete user">⌫</button>
                </td>
            </tr>`;
        }).join("");
    }
    renderUserPagination(rows.length, pages);
    paintUserFilters();
}

function renderUserPagination(total, pages) {
    const section = document.getElementById("sec-users");
    const pagination = section?.querySelector(".pagination");
    const summary = pagination?.querySelector("span");
    const buttons = pagination?.querySelector(".page-btns");
    if (!pagination || !summary || !buttons) return;
    const from = total ? (userView.page - 1) * userView.pageSize + 1 : 0;
    const to = Math.min(total, userView.page * userView.pageSize);
    summary.textContent = `Showing ${from}–${to} of ${total} users`;
    buttons.innerHTML = pages <= 1 ? "" :
        `<button type="button" class="page-btn" data-page="${userView.page - 1}" aria-label="Previous page">‹</button>` +
        Array.from({ length: pages }, (_, i) => i + 1).map(page =>
            `<button type="button" class="page-btn ${page === userView.page ? "active" : ""}" data-page="${page}" aria-current="${page === userView.page ? "page" : "false"}">${page}</button>`
        ).join("") +
        `<button type="button" class="page-btn" data-page="${userView.page + 1}" aria-label="Next page">›</button>`;
}

function paintUserFilters() {
    const chips = document.querySelectorAll("#sec-users .filter-chip");
    if (chips[0]) chips[0].firstChild.textContent = `Role: ${userView.role || "All"} `;
    if (chips[1]) chips[1].firstChild.textContent = `Status: ${userView.status || "All"} `;
}

function cycleUserFilter(key) {
    const options = key === "role"
        ? ["", ...new Set(userCache.map(user => user.RoleName).filter(Boolean))]
        : ["", ...new Set(userCache.map(user => user.Status).filter(Boolean))];
    const current = userView[key];
    userView[key] = options[(options.indexOf(current) + 1) % options.length];
    userView.page = 1;
    renderUsers();
}

function userFields({ editing = false } = {}) {
    const direct = userCache[0]?.AccountMode === "direct";
    if (direct) return [
        { name: "FullName", label: "Full name", required: true, placeholder: "Enter full name" },
        { name: "Email", label: "Email", type: "email" },
        { name: "Role", label: "Role", type: "select", required: true,
          lookup: { resource: "role", value: "RoleName", label: "RoleName" } },
        { name: "Username", label: "Username", required: true, placeholder: "Enter a unique username" },
        { name: "Password", label: editing ? "New password (optional)" : "Password", type: "password", required: !editing,
          placeholder: editing ? "Leave blank to keep current" : "At least 8 characters" },
        { name: "Status", label: "Status", type: "select", required: true, options: ["Active", "Inactive"], default: "Active" }
    ];
    return [
        { name: "EmployeeID", label: "Employee", type: "select", required: true,
          lookup: { resource: "employees", value: "EmployeeID", label: row => `${row.FullName} (EMP-${row.EmployeeID})` } },
        { name: "RoleID", label: "Role", type: "select", required: true,
          lookup: { resource: "role", value: "RoleID", label: "RoleName" } },
        { name: "Username", label: "Username", required: true, placeholder: "Enter a unique username" },
        { name: "Password", label: editing ? "New password (optional)" : "Password", type: "password", required: !editing,
          placeholder: editing ? "Leave blank to keep the current password" : "At least 8 characters" },
        { name: "Status", label: "Status", type: "select", required: true, options: ["Active", "Inactive"], default: "Active" }
    ];
}

async function openUserEditor(user = null) {
    const editing = Boolean(user);
    const direct = userCache[0]?.AccountMode === "direct";
    const values = direct && user ? {
        FullName: user.EmployeeName, Email: user.EmployeeEmail, Role: user.RoleName,
        Username: user.Username, Status: user.Status
    } : (user || { Status: "Active" });
    await openFormModal({
        title: editing ? `Edit user ${user.Username}` : "Add user",
        fields: userFields({ editing }),
        values,
        isEdit: false,
        submitLabel: editing ? "Save changes" : "Create user",
        onSubmit: async data => {
            if (editing) {
                data.UserID = user.UserID;
                if (!data.Password) delete data.Password;
                await apiPut("user", data);
            } else {
                await apiPost("user", data);
            }
            userNotice(editing ? "User updated." : "User created.");
            await loadUsers();
        }
    });
}

async function resetUserPassword() {
    if (!userCache.length) return userNotice("There are no accounts to reset.", "error");
    const userOptions = userCache.map(user => ({
        value: user.UserID,
        label: `${user.Username} — ${user.EmployeeName || "Unassigned"}`
    }));
    await openFormModal({
        title: "Reset user password",
        fields: [
            { name: "UserID", label: "User account", type: "select", required: true, options: userOptions },
            { name: "Password", label: "New password", type: "password", required: true, placeholder: "At least 8 characters" },
            { name: "ConfirmPassword", label: "Confirm new password", type: "password", required: true }
        ],
        submitLabel: "Reset password",
        onSubmit: async data => {
            if (data.Password !== data.ConfirmPassword) throw new Error("The passwords do not match.");
            const user = userCache.find(row => String(row.UserID) === String(data.UserID));
            if (!user) throw new Error("Select a valid user account.");
            const payload = user.AccountMode === "direct"
                ? { UserID: user.UserID, FullName: user.EmployeeName, Email: user.EmployeeEmail, Role: user.RoleName, Username: user.Username, Status: user.Status, Password: data.Password }
                : { UserID: user.UserID, EmployeeID: user.EmployeeID, RoleID: user.RoleID, Username: user.Username, Status: user.Status, Password: data.Password };
            await apiPut("user", payload);
            userNotice(`Password reset for ${user.Username}.`);
        }
    });
}

async function deleteUser(id) {
    const user = userCache.find(row => String(row.UserID) === String(id));
    if (!user || !confirm(`Delete user ${user.Username}? This cannot be undone.`)) return;
    try {
        await apiDelete("user", id);
        userNotice("User deleted.");
        await loadUsers();
    } catch (error) {
        userNotice(`Could not delete user: ${error.message}`, "error");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const section = document.getElementById("sec-users");
    const addButton = [...(section?.querySelectorAll(".page-actions button") || [])]
        .find(button => /add user/i.test(button.textContent));
    const resetButton = section?.querySelector(".spacer button");
    const search = section?.querySelector(".tt-search input");
    const chips = section?.querySelectorAll(".filter-chip");

    addButton?.addEventListener("click", () => openUserEditor());
    resetButton?.addEventListener("click", resetUserPassword);
    search?.addEventListener("input", () => {
        userView.search = search.value.trim().toLowerCase();
        userView.page = 1;
        renderUsers();
    });
    chips?.[0]?.addEventListener("click", () => cycleUserFilter("role"));
    chips?.[1]?.addEventListener("click", () => cycleUserFilter("status"));
    chips?.forEach(chip => chip.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chip.click(); }
    }));
    section?.querySelector(".page-btns")?.addEventListener("click", event => {
        const button = event.target.closest("[data-page]");
        if (!button) return;
        const page = Number(button.dataset.page);
        const pages = Math.max(1, Math.ceil(filteredUsers().length / userView.pageSize));
        if (page >= 1 && page <= pages) { userView.page = page; renderUsers(); }
    });
    document.getElementById("userTableBody")?.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const user = userCache.find(row => String(row.UserID) === String(button.dataset.id));
        if (button.dataset.action === "edit" && user) openUserEditor(user);
        if (button.dataset.action === "delete") deleteUser(button.dataset.id);
    });
    loadUsers();
});
