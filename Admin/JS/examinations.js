
const examState = { rows: [], page: 1, pageSize: 5, search: "" };

function examNotice(message, type = "ok") {
    if (typeof toast === "function") toast(message, type);
    else window.alert(message);
}

function examDateToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function loadExaminations() {
    const body = document.getElementById("examTableBody");
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6" class="empty-message">Loading examinations…</td></tr>';
    try {
        const result = await apiGet("examination");
        examState.rows = Array.isArray(result) ? result : [];
        renderExaminations();
    } catch (error) {
        body.innerHTML = `<tr><td colspan="6" class="empty-message">Could not load examinations: ${escapeHtml(error.message)}</td></tr>`;
    }
}

function filteredExaminations() {
    if (!examState.search) return examState.rows;
    return examState.rows.filter(row => [
        row.ExamID, row.CustomerID, row.CustomerName, row.OptometristID,
        row.OptometristName, row.ExamDate, row.ResultSummary
    ].some(value => String(value ?? "").toLowerCase().includes(examState.search)));
}

function renderExaminations() {
    const body = document.getElementById("examTableBody");
    if (!body) return;
    const rows = filteredExaminations();
    const pages = Math.max(1, Math.ceil(rows.length / examState.pageSize));
    examState.page = Math.min(examState.page, pages);
    const start = (examState.page - 1) * examState.pageSize;
    const visible = rows.slice(start, start + examState.pageSize);

    body.innerHTML = visible.length ? visible.map(row => {
        const id = escapeHtml(row.ExamID);
        const summary = String(row.ResultSummary || "").trim();
        return `<tr>
            <td class="cell-primary">EX-${id}</td>
            <td>${nameWithAvatar(row.CustomerName, `Customer #${row.CustomerID}`)}</td>
            <td>${escapeHtml(fmtDate(row.ExamDate))}</td>
            <td>${nameWithAvatar(row.OptometristName, `Employee #${row.OptometristID}`)}</td>
            <td title="${escapeHtml(summary)}">${escapeHtml(summary || "—")}</td>
            <td class="row-actions">
                <button type="button" class="ricon" data-action="view" data-id="${id}" title="View examination" aria-label="View examination ${id}">View</button>
                <button type="button" class="ricon" data-action="edit" data-id="${id}" title="Edit examination" aria-label="Edit examination ${id}">Edit</button>
                <button type="button" class="ricon" data-action="delete" data-id="${id}" title="Delete examination" aria-label="Delete examination ${id}">Delete</button>
            </td>
        </tr>`;
    }).join("") : '<tr><td colspan="6" class="empty-message">No examination records match your search.</td></tr>';

    renderExamPagination(rows.length, pages);
}

function renderExamPagination(total, pages) {
    const pagination = document.getElementById("examPagination");
    const summary = pagination?.querySelector("span");
    const controls = pagination?.querySelector(".page-btns");
    if (!summary || !controls) return;
    const from = total ? (examState.page - 1) * examState.pageSize + 1 : 0;
    const to = Math.min(total, examState.page * examState.pageSize);
    summary.textContent = `Showing ${from}–${to} of ${total} examinations`;
    controls.innerHTML = pages <= 1 ? "" :
        `<button type="button" class="page-btn" data-page="${examState.page - 1}" aria-label="Previous page">‹</button>` +
        Array.from({ length: pages }, (_, i) => i + 1).map(page =>
            `<button type="button" class="page-btn ${page === examState.page ? "active" : ""}" data-page="${page}" aria-current="${page === examState.page ? "page" : "false"}">${page}</button>`
        ).join("") +
        `<button type="button" class="page-btn" data-page="${examState.page + 1}" aria-label="Next page">›</button>`;
}

async function examinationChoices() {
    const [customers, employees] = await Promise.all([apiGet("customer"), apiGet("employees")]);
    const customerRows = Array.isArray(customers) ? customers : [];
    const employeeRows = Array.isArray(employees) ? employees : [];
    const optometrists = employeeRows.filter(employee => /optometrist|optician/i.test(String(employee.RoleName || "")));
    const staff = optometrists.length ? optometrists : employeeRows;
    if (!customerRows.length) throw new Error("Add a customer before recording an examination.");
    if (!staff.length) throw new Error("Add an optometrist/employee before recording an examination.");
    return {
        customers: customerRows.map(customer => ({ value: customer.CustomerID, label: `${customer.FullName} (CUS-${customer.CustomerID})` })),
        staff: staff.map(employee => ({ value: employee.EmployeeID, label: `${employee.FullName} (EMP-${employee.EmployeeID})` }))
    };
}

async function openExaminationEditor(row = null) {
    const editing = Boolean(row);
    try {
        const choices = await examinationChoices();
        await openFormModal({
            title: editing ? `Edit examination EX-${row.ExamID}` : "Record eye examination",
            values: row || { ExamDate: examDateToday() },
            submitLabel: editing ? "Save changes" : "Save examination",
            fields: [
                { name: "CustomerID", label: "Customer", type: "select", required: true, options: choices.customers },
                { name: "OptometristID", label: "Optometrist", type: "select", required: true, options: choices.staff },
                { name: "ExamDate", label: "Examination date", type: "date", required: true, default: examDateToday() },
                { name: "LeftEyeSPH", label: "Left eye sphere (SPH)", type: "number", step: "0.01", placeholder: "e.g. -1.25" },
                { name: "LeftEyeCYL", label: "Left eye cylinder (CYL)", type: "number", step: "0.01", placeholder: "e.g. -0.50" },
                { name: "LeftEyeAXIS", label: "Left eye axis", type: "number", step: "1", placeholder: "0–180°" },
                { name: "RightEyeSPH", label: "Right eye sphere (SPH)", type: "number", step: "0.01", placeholder: "e.g. -1.25" },
                { name: "RightEyeCYL", label: "Right eye cylinder (CYL)", type: "number", step: "0.01", placeholder: "e.g. -0.50" },
                { name: "RightEyeAXIS", label: "Right eye axis", type: "number", step: "1", placeholder: "0–180°" },
                { name: "PD", label: "Pupillary distance (PD)", type: "number", step: "0.01", placeholder: "mm" },
                { name: "EyePressure", label: "Eye pressure", type: "number", step: "0.01", placeholder: "mmHg" },
                { name: "VisualAcuity", label: "Visual acuity", placeholder: "e.g. 20/20" },
                { name: "ResultSummary", label: "Notes / findings", type: "textarea", full: true, placeholder: "Additional examination notes" }
            ],
            onSubmit: async data => {
                data.CustomerID = Number(data.CustomerID);
                data.OptometristID = Number(data.OptometristID);
                data.ResultSummary = data.ResultSummary.trim();
                if (editing) {
                    data.ExamID = row.ExamID;
                    await apiPut("examination", data);
                } else {
                    await apiPost("examination", data);
                }
                examNotice(editing ? "Examination updated." : "Examination recorded.");
                await loadExaminations();
            }
        });
    } catch (error) {
        examNotice(`Could not open examination form: ${error.message}`, "error");
    }
}

function viewExamination(row) {
    openModal(`Examination EX-${row.ExamID}`, `
        <dl class="uo-details">
            <dt>Customer</dt><dd>${escapeHtml(row.CustomerName || `Customer #${row.CustomerID}`)}</dd>
            <dt>Optometrist</dt><dd>${escapeHtml(row.OptometristName || `Employee #${row.OptometristID}`)}</dd>
            <dt>Examination date</dt><dd>${escapeHtml(fmtDate(row.ExamDate))}</dd>
            <dt>Left eye</dt><dd>SPH ${escapeHtml(row.LeftEyeSPH ?? "—")} · CYL ${escapeHtml(row.LeftEyeCYL ?? "—")} · AXIS ${escapeHtml(row.LeftEyeAXIS ?? "—")}</dd>
            <dt>Right eye</dt><dd>SPH ${escapeHtml(row.RightEyeSPH ?? "—")} · CYL ${escapeHtml(row.RightEyeCYL ?? "—")} · AXIS ${escapeHtml(row.RightEyeAXIS ?? "—")}</dd>
            <dt>PD</dt><dd>${escapeHtml(row.PD ?? "—")}</dd>
            <dt>Eye pressure</dt><dd>${escapeHtml(row.EyePressure ?? "—")}</dd>
            <dt>Visual acuity</dt><dd>${escapeHtml(row.VisualAcuity || "—")}</dd>
            <dt>Findings</dt><dd>${escapeHtml(row.ResultSummary || "No findings recorded.")}</dd>
        </dl>
        <div class="uo-actions"><button type="button" class="btn btn-outline uo-cancel">Close</button></div>
    `);
    document.querySelector(".uo-modal .uo-cancel")?.addEventListener("click", closeModal);
}

async function deleteExamination(row) {
    if (!confirm(`Delete examination EX-${row.ExamID}? This cannot be undone.`)) return;
    try {
        await apiDelete("examination", row.ExamID);
        examNotice("Examination deleted.");
        await loadExaminations();
    } catch (error) {
        examNotice(`Could not delete examination: ${error.message}`, "error");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("newExamBtn")?.addEventListener("click", () => openExaminationEditor());
    document.getElementById("examSearch")?.addEventListener("input", event => {
        examState.search = event.target.value.trim().toLowerCase();
        examState.page = 1;
        renderExaminations();
    });
    document.getElementById("examPagination")?.addEventListener("click", event => {
        const button = event.target.closest("[data-page]");
        if (!button) return;
        const page = Number(button.dataset.page);
        const pages = Math.max(1, Math.ceil(filteredExaminations().length / examState.pageSize));
        if (page >= 1 && page <= pages) { examState.page = page; renderExaminations(); }
    });
    document.getElementById("examTableBody")?.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const row = examState.rows.find(item => String(item.ExamID) === button.dataset.id);
        if (!row) return;
        if (button.dataset.action === "view") viewExamination(row);
        if (button.dataset.action === "edit") openExaminationEditor(row);
        if (button.dataset.action === "delete") deleteExamination(row);
    });
    document.getElementById("printExamsBtn")?.addEventListener("click", () => {
        const rows = filteredExaminations().map(row => [
            `EX-${row.ExamID}`, row.CustomerName || `Customer #${row.CustomerID}`,
            fmtDate(row.ExamDate), row.OptometristName || `Employee #${row.OptometristID}`,
            row.ResultSummary || ""
        ]);
        const table = `<table><thead><tr><th>Exam ID</th><th>Customer</th><th>Date</th><th>Optometrist</th><th>Findings</th></tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        printHtml("Eye Examination Report", table);
    });
    loadExaminations();
});
