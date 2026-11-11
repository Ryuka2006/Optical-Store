const paymentState = { rows: [], search: "", page: 1, pageSize: 5 };

async function loadPayments() {
    const body = document.getElementById("paymentTableBody");
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6" class="empty-message">Loading payments...</td></tr>';
    try { paymentState.rows = await apiGet("payment") || []; renderPayments(); }
    catch (error) { body.innerHTML = '<tr><td colspan="6" class="empty-message">Could not load payments: ' + escapeHtml(error.message) + '</td></tr>'; }
}

function renderPayments() {
    const body = document.getElementById("paymentTableBody");
    const section = document.getElementById("sec-payments");
    const summary = section?.querySelector(".pagination span");
    const controls = section?.querySelector(".page-btns");
    if (!body || !summary || !controls) return;
    const rows = paymentState.rows.filter(row => !paymentState.search || [row.OrderID, row.CustomerName, row.Method, row.Status, row.ReferenceNo]
        .some(value => String(value ?? "").toLowerCase().includes(paymentState.search)));
    const pages = Math.max(1, Math.ceil(rows.length / paymentState.pageSize));
    paymentState.page = Math.min(paymentState.page, pages);
    const from = rows.length ? (paymentState.page - 1) * paymentState.pageSize + 1 : 0;
    const visible = rows.slice(from ? from - 1 : 0, paymentState.page * paymentState.pageSize);
    body.innerHTML = visible.length ? visible.map(row => '<tr><td class="cell-primary">INV-' + escapeHtml(row.OrderID) +
        '</td><td>' + nameWithAvatar(row.CustomerName, "Walk-in customer") + '</td><td>' + escapeHtml(row.Method) +
        '</td><td>' + escapeHtml(fmtMoney(row.Amount)) + '</td><td>' + badge(row.Status || "Completed", row.Status === "Completed" ? "green" : row.Status === "Refunded" ? "red" : "amber") +
        '</td><td class="row-actions"><button type="button" class="ricon" data-action="refund" data-id="' + escapeHtml(row.PaymentID) + '" title="Request refund">Refund</button></td></tr>').join("")
        : '<tr><td colspan="6" class="empty-message">No payments match your search.</td></tr>';
    summary.textContent = "Showing " + from + "–" + Math.min(rows.length, paymentState.page * paymentState.pageSize) + " of " + rows.length + " payments";
    controls.innerHTML = pages <= 1 ? "" : '<button type="button" class="page-btn" data-page="' + (paymentState.page - 1) + '">‹</button>' +
        Array.from({ length: pages }, (_, index) => '<button type="button" class="page-btn ' + (index + 1 === paymentState.page ? "active" : "") + '" data-page="' + (index + 1) + '">' + (index + 1) + '</button>').join("") +
        '<button type="button" class="page-btn" data-page="' + (paymentState.page + 1) + '">›</button>';
}

async function requestRefund(paymentId) {
    const payment = paymentState.rows.find(row => String(row.PaymentID) === String(paymentId));
    if (!payment || !["Completed", "Paid", "Partial Refund"].includes(payment.Status)) return toast("This payment is not eligible for a refund.", "error");
    await openFormModal({
        title: "Request refund for invoice INV-" + payment.OrderID,
        submitLabel: "Submit request",
        fields: [{ name: "Amount", label: "Refund amount (maximum " + fmtMoney(payment.Amount) + ")", type: "number", required: true, step: "0.01" }],
        onSubmit: async data => {
            await apiPost("refund", { PaymentID: payment.PaymentID, Amount: data.Amount });
            toast("Refund request submitted for review.");
            await loadPayments();
        }
    });
}

async function openRefundsModal(approvalOnly = false) {
    try {
        const result = await apiGet("refund");
        const rows = (Array.isArray(result) ? result : []).filter(row => !approvalOnly || row.Status === "Pending");
        const heading = approvalOnly ? "Pending refund requests" : "Refund history";
        const body = rows.length ? rows.map(row => '<tr><td>RF-' + escapeHtml(row.RefundID) +
            '</td><td>INV-' + escapeHtml(row.OrderID) + '</td><td>' + nameWithAvatar(row.CustomerName, "Walk-in") +
            '</td><td>' + escapeHtml(fmtMoney(row.Amount)) + '</td><td>' + escapeHtml(fmtDate(row.RefundDate)) +
            '</td><td>' + badge(row.Status, row.Status === "Approved" ? "green" : row.Status === "Rejected" ? "red" : "amber") +
            (approvalOnly && row.Status === "Pending" ? '<div class="refund-review-actions"><button type="button" class="btn btn-primary btn-sm" data-refund-action="Approved" data-id="' + escapeHtml(row.RefundID) + '">Approve</button><button type="button" class="btn btn-outline btn-sm" data-refund-action="Rejected" data-id="' + escapeHtml(row.RefundID) + '">Reject</button></div>' : '') +
            '</td></tr>').join("") : '<tr><td colspan="6" class="empty-message">No refund requests found.</td></tr>';
        const overlay = openModal(heading, '<div class="uo-tablewrap"><table class="uo-table"><thead><tr><th>Refund</th><th>Invoice</th><th>Customer</th><th>Amount</th><th>Date</th><th>Status / Actions</th></tr></thead><tbody>' + body + '</tbody></table></div>');
        overlay.addEventListener("click", async event => {
            const button = event.target.closest("[data-refund-action]");
            if (!button) return;
            button.disabled = true;
            try {
                await apiPut("refund", { RefundID: button.dataset.id, Status: button.dataset.refundAction });
                toast("Refund " + button.dataset.refundAction.toLowerCase() + ".");
                await openRefundsModal(true);
                await loadPayments();
            } catch (error) { toast(error.message, "error"); button.disabled = false; }
        });
    } catch (error) { toast("Could not load refunds: " + error.message, "error"); }
}

document.addEventListener("DOMContentLoaded", () => {
    loadPayments();
    document.getElementById("paymentSearch")?.addEventListener("input", event => { paymentState.search = event.target.value.trim().toLowerCase(); paymentState.page = 1; renderPayments(); });
    document.querySelector("#sec-payments .page-btns")?.addEventListener("click", event => {
        const page = Number(event.target.closest("[data-page]")?.dataset.page);
        const max = Math.max(1, Math.ceil(paymentState.rows.length / paymentState.pageSize));
        if (page >= 1 && page <= max) { paymentState.page = page; renderPayments(); }
    });
    document.getElementById("paymentTableBody")?.addEventListener("click", event => {
        const button = event.target.closest('[data-action="refund"]');
        if (button) requestRefund(button.dataset.id).catch(error => toast(error.message, "error"));
    });
    document.getElementById("paymentHistoryBtn")?.addEventListener("click", () => showTable("Payment history", ["Invoice", "Customer", "Method", "Amount", "Date", "Status"], paymentState.rows.map(row => [
        "INV-" + row.OrderID, row.CustomerName || "Walk-in", row.Method, fmtMoney(row.Amount), fmtDate(row.PaymentDate), row.Status
    ])));
    document.getElementById("approveRefundBtn")?.addEventListener("click", () => openRefundsModal(true));
});
