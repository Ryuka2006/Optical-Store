
const API_BASE = new URL("../Api/", document.currentScript?.src || location.href).href;
const LOGIN_PAGE = "login.html";

const API_ENDPOINTS = {
    auth:         "auth/login.php",
    logout:       "auth/logout.php",
    dashboard:    "dashboard.php",
    settings:     "settings.php",
    backup:       "backup.php",
    appointment:  "appointments.php",
    customer:     "customers.php",
    employee:     "employees.php",
    role:         "role.php",
    user:         "users.php",
    users:        "users.php",
    employees:    "employees.php",
    examination:  "examinations.php",
    prescription: "prescriptions.php",
    prescriptions: "prescriptions.php",
    product:      "products.php",
    products:     "products.php",
    brand:        "brands.php",
    brands:       "brands.php",
    supplier:     "suppliers.php",
    suppliers:    "suppliers.php",
    inventory:    "inventory.php",
    sale:         "sale_order.php",
    payment:      "payments.php",
    refund:       "refund.php",
    notification: "notifications.php",
    notifications: "notifications.php",
    profile: "profile.php",
    reports:      "reports.php"
};



async function apiRequest(resource, { method = "GET", id = null, body = null } = {}) {
    const file = API_ENDPOINTS[resource];
    if (!file) throw new Error(`Unknown API resource: ${resource}`);

    let url = new URL(file, API_BASE);
    if ((method === "GET" || method === "DELETE") && id !== null && id !== "") url.searchParams.set("id", id);

    const options = { method, headers: { Accept: "application/json" }, credentials: "same-origin" };
    if (body !== null) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const text = await response.text();

    let data;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        throw new Error("Server did not return valid JSON: " + text.slice(0, 160));
    }

    if (response.status === 401 && resource !== "auth") {
        
        if (!location.pathname.endsWith(LOGIN_PAGE)) location.href = new URL(LOGIN_PAGE, document.baseURI).href;
        throw new Error("Please log in.");
    }
    if (!response.ok) throw new Error((data && data.error) || `Request failed (${response.status})`);
    return data;
}

const apiGet    = (resource, id = null) => apiRequest(resource, { method: "GET", id });
const apiPost   = (resource, data)      => apiRequest(resource, { method: "POST", body: data });
const apiPut    = (resource, data)      => apiRequest(resource, { method: "PUT", body: data });
const apiDelete = (resource, id)        => apiRequest(resource, { method: "DELETE", body: { id } });




function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

function fmtDate(value) {
    if (!value) return "";
    const d = new Date(String(value).slice(0, 10) + "T00:00:00");
    return isNaN(d) ? value : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(n) {
    const v = Number(n);
    return isNaN(v) ? "" : "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

function nameWithAvatar(name, fallback = "—") {
    const displayName = String(name || fallback);
    return `<span class="row-avatar"><span class="mini-avatar" aria-hidden="true">${escapeHtml(initials(displayName))}</span><span>${escapeHtml(displayName)}</span></span>`;
}

const BADGE_COLORS = {
    Active: "green", Paid: "green", Completed: "green", "In Stock": "green",
    Pending: "amber", Scheduled: "amber", "Low Stock": "amber",
    Inactive: "red", Cancelled: "red", Refunded: "red", "Out of Stock": "red",
    Confirmed: "blue", Administrator: "navy"
};
function badge(text, color) {
    return `<span class="badge ${color || BADGE_COLORS[text] || "blue"}">${escapeHtml(text)}</span>`;
}

function toast(message, type = "ok") {
    let box = document.getElementById("uoToasts");
    if (!box) {
        box = document.createElement("div");
        box.id = "uoToasts";
        document.body.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = "uo-toast " + type;
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 3200);
}




let _modalCleanup = null;

function openModal(title, bodyHtml, { wide = false } = {}) {
    closeModal();
    const overlay = document.createElement("div");
    overlay.className = "uo-modal-overlay";
    overlay.innerHTML = `
        <div class="uo-modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
            <div class="uo-modal-head"><h3>${escapeHtml(title)}</h3><button type="button" class="uo-x" aria-label="Close">×</button></div>
            <div class="uo-modal-body">${bodyHtml}</div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("mousedown", e => { if (e.target === overlay) closeModal(); });
    overlay.querySelector(".uo-x").addEventListener("click", closeModal);
    return overlay;
}

function closeModal() {
    const overlay = document.querySelector(".uo-modal-overlay");
    if (!overlay) return;
    overlay.remove();
    const cleanup = _modalCleanup;
    _modalCleanup = null;
    cleanup?.();
}



function openEmbeddedForm(formId, title) {
    const form = document.getElementById(formId);
    if (!form) return null;
    if (_modalCleanup) closeModal();

    const parent = form.parentNode;
    const nextSibling = form.nextSibling;
    const wasHidden = form.hidden;
    const placeholder = document.createComment(`${formId} original position`);
    parent.insertBefore(placeholder, form);
    form.classList.add("uo-embedded-form");

    const overlay = openModal(title, '<div class="uo-embedded-slot"></div>', { wide: true });
    overlay.querySelector(".uo-embedded-slot").appendChild(form);
    form.hidden = false;
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-outline uo-embedded-cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", closeModal);
    overlay.querySelector(".uo-modal-body").appendChild(cancel);

    _modalCleanup = () => {
        form.classList.remove("uo-embedded-form");
        form.hidden = wasHidden;
        if (placeholder.parentNode) {
            placeholder.parentNode.insertBefore(form, nextSibling?.parentNode === placeholder.parentNode ? nextSibling : placeholder);
            placeholder.remove();
        } else {
            parent.appendChild(form);
        }
    };
    return overlay;
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });




const _lookupCache = {};
async function loadLookup(resource) {
    if (!_lookupCache[resource]) {
        const data = await apiGet(resource);
        _lookupCache[resource] = Array.isArray(data) ? data : [];
    }
    return _lookupCache[resource];
}
function clearLookup(resource) { delete _lookupCache[resource]; }





async function openFormModal({ title, fields, values = {}, isEdit = false, submitLabel = "Save", onSubmit }) {
    const visible = fields.filter(f => !(isEdit && f.hideOnEdit));

    
    for (const f of visible) {
        if (f.lookup) {
            try {
                const rows = await loadLookup(f.lookup.resource);
                f._options = rows.map(r => ({
                    value: r[f.lookup.value],
                    label: typeof f.lookup.label === "function" ? f.lookup.label(r) : r[f.lookup.label]
                }));
            } catch { f._options = []; }
        } else if (f.options) {
            f._options = f.options.map(o => typeof o === "object" ? o : { value: o, label: o });
        }
    }

    const fieldHtml = visible.map(f => {
        const val = values[f.name] ?? f.default ?? "";
        const req = f.required ? "required" : "";
        const ro = isEdit && f.readonlyOnEdit ? "readonly" : "";
        let control;
        if (f._options) {
            const emptyChoice = f.required && String(val) === ""
                ? `<option value="" selected disabled>Select ${escapeHtml(f.label.toLowerCase())}…</option>`
                : "";
            const opts = emptyChoice + f._options.map(o =>
                `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(val) ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("");
            control = `<select name="${f.name}" ${req}>${f.required ? "" : '<option value="">—</option>'}${opts}</select>`;
        } else if (f.type === "textarea") {
            control = `<textarea name="${f.name}" rows="3" ${req} placeholder="${escapeHtml(f.placeholder || "")}">${escapeHtml(val)}</textarea>`;
        } else {
            const v = f.type === "password" ? "" : val;
            const ph = f.type === "password" && isEdit ? "Leave blank to keep current" : f.placeholder || "";
            control = `<input name="${f.name}" type="${f.type || "text"}" value="${escapeHtml(v)}" ${req} ${ro}
                        ${f.step ? `step="${f.step}"` : ""} ${f.type === "password" ? "autocomplete=new-password" : ""}
                        placeholder="${escapeHtml(ph)}">`;
        }
        return `<label class="uo-field ${f.full ? "full" : ""}"><span>${escapeHtml(f.label)}${f.required ? " *" : ""}</span>${control}</label>`;
    }).join("");

    const overlay = openModal(title, `
        <form class="uo-form" novalidate>
            <div class="uo-grid">${fieldHtml}</div>
            <div class="uo-error" hidden></div>
            <div class="uo-actions">
                <button type="button" class="btn btn-outline uo-cancel">Cancel</button>
                <button type="submit" class="btn btn-primary">${escapeHtml(submitLabel)}</button>
            </div>
        </form>`);

    const form = overlay.querySelector("form");
    const errBox = overlay.querySelector(".uo-error");
    overlay.querySelector(".uo-cancel").addEventListener("click", closeModal);
    form.querySelector("input,select,textarea")?.focus();

    form.addEventListener("submit", async e => {
        e.preventDefault();
        errBox.hidden = true;
        if (!form.checkValidity()) { form.reportValidity(); return; }

        const data = {};
        new FormData(form).forEach((v, k) => { data[k] = v; });

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            await onSubmit(data);
            closeModal();
        } catch (err) {
            errBox.textContent = err.message;
            errBox.hidden = false;
            btn.disabled = false;
        }
    });
}








function initCrudSection(cfg) {
    const section = document.getElementById(cfg.section);
    if (!section) { console.warn("Section not found:", cfg.section); return null; }
    section.dataset.paginationManaged = "true";

    const container = cfg.container ? section.querySelector(cfg.container) : section.querySelector("tbody");
    if (!container) { console.warn("Container not found in", cfg.section); return null; }

    const pageSize = cfg.pageSize ?? 5;
    const state = { rows: [], page: 1, search: "", filters: {} };
    const idOf = r => r[cfg.idKey];

    
    const searchInput = section.querySelector(".tt-search input");
    searchInput?.addEventListener("input", () => { state.search = searchInput.value.trim().toLowerCase(); state.page = 1; render(); });

    const chips = [...section.querySelectorAll(".filter-chip")];
    (cfg.filters || []).forEach((flt, i) => {
        const chip = chips[i];
        if (!chip) return;
        chip.style.cursor = "pointer";
        const arrow = chip.querySelector("svg")?.outerHTML || "";
        const paint = () => { chip.innerHTML = `${escapeHtml(flt.label)}: ${escapeHtml(state.filters[flt.key] || "All")} ${arrow}`; };
        paint();
        chip.setAttribute("role", "button");
        chip.setAttribute("tabindex", "0");
        chip.addEventListener("click", () => {
            const options = ["", ...(typeof flt.values === "function" ? flt.values(state.rows) : flt.values)];
            const next = options[(options.indexOf(state.filters[flt.key] || "") + 1) % options.length];
            state.filters[flt.key] = next;
            state.page = 1;
            paint();
            render();
        });
        chip.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chip.click(); }
        });
    });

    
    const sectionButtons = () => [...section.querySelectorAll("button")];
    if (cfg.addButton) {
        let btn = sectionButtons().find(b => cfg.addButton.test(b.textContent));
        if (!btn && cfg.addLabel) {
            btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn-primary";
            btn.textContent = cfg.addLabel;
            section.querySelector(".page-actions")?.appendChild(btn);
        }
        btn?.addEventListener("click", () => openEditor(null));
    }
    
    (cfg.headerButtons || []).forEach(h => {
        sectionButtons().filter(b => h.match.test(b.textContent))
            .forEach(b => b.addEventListener("click", () => h.run(state.rows, api)));
    });

    
    container.addEventListener("click", async e => {
        const el = e.target.closest("[data-action]");
        if (!el) return;
        const id = el.dataset.id;
        const row = state.rows.find(r => String(idOf(r)) === String(id));
        if (!row) return;
        const action = el.dataset.action;

        if (action === "edit") openEditor(row);
        else if (action === "delete") remove(row);
        else if (cfg.actions?.[action]) cfg.actions[action](row, api);
    });

    
    async function load() {
        try {
            const res = await apiGet(cfg.resource);
            state.rows = Array.isArray(res) ? res : [];
            render();
        } catch (err) {
            console.error(`Failed to load ${cfg.resource}:`, err);
            const cols = section.querySelectorAll("thead th").length || 6;
            container.innerHTML = cfg.container
                ? `<div class="empty-message">Failed to load: ${escapeHtml(err.message)}</div>`
                : `<tr><td colspan="${cols}" class="empty-message">Failed to load: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    function filtered() {
        return state.rows.filter(r => {
            for (const [key, val] of Object.entries(state.filters)) {
                if (!val) continue;
                const flt = cfg.filters.find(f => f.key === key);
                const cell = flt.get ? flt.get(r) : r[key];
                if (String(cell) !== val) return false;
            }
            if (!state.search) return true;
            const keys = cfg.searchKeys || Object.keys(r);
            return keys.some(k => String(r[k] ?? "").toLowerCase().includes(state.search));
        });
    }

    function render() {
        const list = filtered();
        const pages = Math.max(1, Math.ceil(list.length / pageSize));
        if (state.page > pages) state.page = pages;
        const slice = cfg.paginate === false ? list : list.slice((state.page - 1) * pageSize, state.page * pageSize);

        if (!slice.length) {
            const cols = section.querySelectorAll("thead th").length || 6;
            container.innerHTML = cfg.container
                ? `<div class="empty-message">${cfg.emptyText || "No records found."}</div>`
                : `<tr><td colspan="${cols}" class="empty-message">${cfg.emptyText || "No records found."}</td></tr>`;
        } else {
            container.innerHTML = slice.map(cfg.renderRow).join("");
        }
        renderPagination(list.length, pages);
        cfg.onRender?.(state.rows, api);
    }

    function renderPagination(total, pages) {
        let pag = section.querySelector(".pagination");
        if (!pag) {
            pag = document.createElement("div");
            pag.className = "pagination";
            pag.innerHTML = '<span></span><div class="page-btns"></div>';
            container.insertAdjacentElement("afterend", pag);
        }
        const from = total ? (state.page - 1) * pageSize + 1 : 0;
        const to = Math.min(total, state.page * pageSize);
        pag.querySelector("span").textContent = cfg.paginate === false
            ? `Showing ${total} ${cfg.plural || "records"}`
            : `Showing ${from}–${to} of ${total} ${cfg.plural || "records"}`;

        const btns = pag.querySelector(".page-btns");
        if (!btns) return;
        if (cfg.paginate === false || pages <= 1) { btns.innerHTML = ""; return; }
        let html = `<button type="button" class="page-btn" data-page="${state.page - 1}" aria-label="Previous page">‹</button>`;
        for (let p = 1; p <= pages; p++) html += `<button type="button" class="page-btn ${p === state.page ? "active" : ""}" data-page="${p}" aria-current="${p === state.page ? "page" : "false"}">${p}</button>`;
        html += `<button type="button" class="page-btn" data-page="${state.page + 1}" aria-label="Next page">›</button>`;
        btns.innerHTML = html;
        btns.onclick = e => {
            const b = e.target.closest("[data-page]");
            if (!b) return;
            const p = Number(b.dataset.page);
            if (p >= 1 && p <= pages) { state.page = p; render(); }
        };
    }

    
    function openEditor(row, defaults = {}) {
        const isEdit = !!row;
        openFormModal({
            title: `${isEdit ? "Edit" : "Add"} ${cfg.label}`,
            fields: cfg.fields,
            values: { ...defaults, ...(row || {}) },
            isEdit,
            submitLabel: isEdit ? "Save Changes" : `Add ${cfg.label}`,
            onSubmit: async data => {
                if (isEdit) await apiPut(cfg.resource, { ...data, id: idOf(row) });
                else await apiPost(cfg.resource, data);
                toast(`${cfg.label} ${isEdit ? "updated" : "added"} successfully`);
                cfg.afterChange?.();
                await load();
            }
        });
    }

    async function remove(row) {
        if (!confirm(`Delete this ${cfg.label.toLowerCase()}? This cannot be undone.`)) return;
        try {
            await apiDelete(cfg.resource, idOf(row));
            toast(`${cfg.label} deleted`);
            cfg.afterChange?.();
            await load();
        } catch (err) {
            toast(err.message, "error");
        }
    }

    const api = { reload: load, openEditor, state, section };
    load();
    return api;
}



function initStaticTablePagination() {
    const customSections = new Set(["sec-users", "sec-customers", "sec-employees", "sec-exams", "sec-prescriptions", "sec-products", "sec-brands", "sec-suppliers", "sec-inventory", "sec-sales", "sec-payments"]);
    document.querySelectorAll(".content-section .table-card").forEach(card => {
        const section = card.closest(".content-section");
        if (customSections.has(section?.id) || section?.dataset.paginationManaged === "true") return;
        const tbody = card.querySelector("table tbody");
        if (!tbody) return;

        let pagination = card.querySelector(".pagination");
        if (!pagination) {
            pagination = document.createElement("div");
            pagination.className = "pagination";
            pagination.innerHTML = '<span>Showing 0 records</span><div class="page-btns"></div>';
            card.appendChild(pagination);
        }
        const summary = pagination.querySelector("span");
        const controls = pagination.querySelector(".page-btns");
        if (!summary || !controls) return;
        let rows = [];
        let page = 1;

        const render = () => {
            const total = rows.length;
            const pages = Math.max(1, Math.ceil(total / 5));
            page = Math.min(page, pages);
            rows.forEach((row, index) => {
                row.hidden = index < (page - 1) * 5 || index >= page * 5;
            });
            summary.textContent = total
                ? `Showing ${(page - 1) * 5 + 1}–${Math.min(page * 5, total)} of ${total} records`
                : "Showing 0 records";
            if (total <= 5) { controls.innerHTML = ""; return; }
            controls.innerHTML = `<button type="button" class="page-btn" data-page="${page - 1}" aria-label="Previous page">‹</button>` +
                Array.from({ length: pages }, (_, index) => index + 1).map(number =>
                    `<button type="button" class="page-btn ${number === page ? "active" : ""}" data-page="${number}" aria-current="${number === page ? "page" : "false"}">${number}</button>`
                ).join("") +
                `<button type="button" class="page-btn" data-page="${page + 1}" aria-label="Next page">›</button>`;
        };
        const refreshRows = () => {
            rows = [...tbody.rows].filter(row => !row.querySelector(".empty-message"));
            page = 1;
            render();
        };
        controls.addEventListener("click", event => {
            const button = event.target.closest("[data-page]");
            if (!button) return;
            const requested = Number(button.dataset.page);
            const pages = Math.max(1, Math.ceil(rows.length / 5));
            if (requested >= 1 && requested <= pages) { page = requested; render(); }
        });
        new MutationObserver(refreshRows).observe(tbody, { childList: true });
        refreshRows();
    });
}

document.addEventListener("DOMContentLoaded", initStaticTablePagination);


function actionIcons(id, list = ["edit", "delete"]) {
    const icon = { view: "👁", edit: "✎", delete: "🗑", print: "🖨" };
    const title = { view: "View", edit: "Edit", delete: "Delete", print: "Print" };
    return `<td class="row-actions">${list.map(a =>
        `<button type="button" class="ricon" title="${title[a] || a}" aria-label="${title[a] || a}" data-action="${a}" data-id="${escapeHtml(id)}">${icon[a] || a}</button>`).join("")}</td>`;
}


function showDetails(title, pairs) {
    openModal(title, `<dl class="uo-details">${pairs.map(([k, v]) =>
        `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v ?? "—")}</dd>`).join("")}</dl>
        <div class="uo-actions"><button type="button" class="btn btn-primary uo-close-details">Close</button></div>`);
    document.querySelector(".uo-modal .uo-close-details")?.addEventListener("click", closeModal);
}


function printHtml(title, bodyHtml) {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { toast("Allow pop-ups to print", "error"); return; }
    w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
        <style>body{font-family:Arial,sans-serif;padding:32px;color:#222}h1{font-size:20px}
        table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}
        th{background:#f3f3f3}dt{font-weight:bold;margin-top:10px}dd{margin:2px 0 0}</style></head>
        <body><h1>${escapeHtml(title)}</h1>${bodyHtml}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
}



function showTable(title, headers, rows, { wide = true } = {}) {
    const head = headers.map(h => `<th>${escapeHtml(h)}</th>`).join("");
    const body = rows.length
        ? rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c ?? "")}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${headers.length}" class="empty-message">No data.</td></tr>`;
    openModal(title, `<div class="uo-tablewrap"><table class="uo-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
        <div class="uo-actions">
            <button type="button" class="btn btn-outline" id="uoPrintTable">Print</button>
            <button type="button" class="btn btn-primary uo-close-table">Close</button>
        </div>`, { wide });
    document.querySelector(".uo-modal .uo-close-table")?.addEventListener("click", closeModal);
    document.getElementById("uoPrintTable")?.addEventListener("click", () =>
        printHtml(title, `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`));
}


function downloadCsv(filename, headers, rows) {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

