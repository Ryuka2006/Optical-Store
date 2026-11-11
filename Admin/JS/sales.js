const saleState = { rows: [], search: "", payment: "", staff: "", page: 1, pageSize: 5 };

function filteredSales() {
    return saleState.rows.filter(row => {
        if (saleState.payment && String(row.PaymentStatus || "Unpaid") !== saleState.payment) return false;
        if (saleState.staff && String(row.SalesStaffName || "Unassigned") !== saleState.staff) return false;
        return !saleState.search || [row.OrderID, row.CustomerName, row.SalesStaffName, row.PaymentMethod, row.PaymentStatus]
            .some(value => String(value ?? "").toLowerCase().includes(saleState.search));
    });
}

function paintSalesFilters() {
    const payment = document.getElementById("salesPaymentFilter");
    const staff = document.getElementById("salesStaffFilter");
    if (payment) payment.textContent = `Payment: ${saleState.payment || "All"}`;
    if (staff) staff.textContent = `Staff: ${saleState.staff || "All"}`;
}

async function loadSales() {
    const body = document.getElementById("salesTableBody");
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6" class="empty-message">Loading sales...</td></tr>';
    try { saleState.rows = await apiGet("sale") || []; renderSales(); }
    catch (error) { body.innerHTML = '<tr><td colspan="6" class="empty-message">Could not load sales: ' + escapeHtml(error.message) + '</td></tr>'; }
}

function renderSales() {
    const body = document.getElementById("salesTableBody");
    const section = document.getElementById("sec-sales");
    const summary = section?.querySelector(".pagination span");
    const controls = section?.querySelector(".page-btns");
    if (!body || !summary || !controls) return;
    const rows = filteredSales();
    const pages = Math.max(1, Math.ceil(rows.length / saleState.pageSize));
    saleState.page = Math.min(saleState.page, pages);
    const from = rows.length ? (saleState.page - 1) * saleState.pageSize + 1 : 0;
    const visible = rows.slice(from ? from - 1 : 0, saleState.page * saleState.pageSize);
    body.innerHTML = visible.length ? visible.map(row => '<tr><td class="cell-primary">INV-' + escapeHtml(String(row.OrderID).padStart(5, "0")) +
        '</td><td>' + nameWithAvatar(row.CustomerName, "Walk-in customer") + '</td><td>' + nameWithAvatar(row.SalesStaffName) +
        '</td><td>' + escapeHtml(fmtMoney(row.TotalAmount)) + '</td><td>' + badge(row.PaymentStatus || "Unpaid", row.PaymentStatus === "Completed" ? "green" : "amber") +
        '</td><td class="row-actions"><button class="ricon" type="button" data-action="view" data-id="' + escapeHtml(row.OrderID) + '">View</button></td></tr>').join("")
        : '<tr><td colspan="6" class="empty-message">No sales match your search.</td></tr>';
    summary.textContent = "Showing " + from + "–" + Math.min(rows.length, saleState.page * saleState.pageSize) + " of " + rows.length + " sales";
    controls.innerHTML = pages <= 1 ? "" : '<button type="button" class="page-btn" data-page="' + (saleState.page - 1) + '">‹</button>' +
        Array.from({ length: pages }, (_, i) => '<button type="button" class="page-btn ' + (i + 1 === saleState.page ? "active" : "") + '" data-page="' + (i + 1) + '">' + (i + 1) + '</button>').join("") +
        '<button type="button" class="page-btn" data-page="' + (saleState.page + 1) + '">›</button>';
}

async function openSaleEditor() {
    try {
    const [customers, employees, products] = await Promise.all([apiGet("customer"), apiGet("employees"), apiGet("products")]);
    const available = (Array.isArray(products) ? products : []).filter(p => String(p.Status || "Active").toLowerCase() === "active" && Number(p.StockQTy) > 0);
    if (!available.length) { toast("There are no active products in stock to sell.", "error"); return; }
        await openFormModal({
            title: "New POS sale",
            submitLabel: "Complete sale",
            fields: [
                { name: "CustomerID", label: "Customer (optional)", type: "select", options: (customers || []).map(c => ({ value: c.CustomerID, label: c.FullName })) },
                { name: "SalesStaffID", label: "Sales staff (optional)", type: "select", options: (employees || []).map(e => ({ value: e.EmployeeID, label: e.FullName })) },
                { name: "ProductID", label: "Product", type: "select", required: true, options: available.map(p => ({ value: p.ProductID, label: p.ProductName + " · " + fmtMoney(p.UnitPrice) + " · stock " + p.StockQTy })) },
                { name: "Qty", label: "Quantity", type: "number", required: true, step: "1", default: 1 },
                { name: "Discount", label: "Discount amount", type: "number", step: "0.01", default: 0 },
                { name: "Method", label: "Payment method", type: "select", required: true, options: ["Cash", "Card", "Mobile Payment", "Insurance"] }
            ],
            onSubmit: async data => {
                const payload = { CustomerID: data.CustomerID, SalesStaffID: data.SalesStaffID, Discount: data.Discount || 0, Method: data.Method,
                    Items: [{ ProductID: data.ProductID, Qty: data.Qty }] };
                await apiPost("sale", payload);
                toast("Sale completed, stock updated and payment recorded.");
                await loadSales();
                clearLookup("products");
            }
        });
    } catch (error) { toast("Could not start sale: " + error.message, "error"); }
}

async function showSaleDetails(id) {
    try {
        const order = await apiGet("sale", id);
        const items = order.Items || [];
        const rows = items.map(item => "<tr><td>" + escapeHtml(item.ProductName) + "</td><td>" + escapeHtml(item.Qty) +
            "</td><td>" + escapeHtml(fmtMoney(item.UnitPrice)) + "</td><td>" + escapeHtml(fmtMoney(Number(item.Qty) * Number(item.UnitPrice))) + "</td></tr>").join("");
        openModal("Invoice INV-" + order.OrderID, '<dl class="uo-details"><dt>Customer</dt><dd>' + escapeHtml(order.CustomerName || "Walk-in") +
            '</dd><dt>Sales staff</dt><dd>' + escapeHtml(order.SalesStaffName || "—") + '</dd><dt>Payment</dt><dd>' + escapeHtml(order.PaymentMethod || "—") +
            ' · ' + escapeHtml(order.PaymentStatus || "—") + '</dd><dt>Subtotal</dt><dd>' + escapeHtml(fmtMoney(order.SubTotal)) +
            '</dd><dt>Discount</dt><dd>' + escapeHtml(fmtMoney(order.Discount)) + '</dd><dt>Total</dt><dd>' + escapeHtml(fmtMoney(order.TotalAmount)) +
            '</dd></dl><table class="uo-table"><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>' + rows + '</tbody></table>');
    } catch (error) { toast("Could not open invoice: " + error.message, "error"); }
}

document.addEventListener("DOMContentLoaded", () => {
    loadSales();
    document.getElementById("newSaleBtn")?.addEventListener("click", openSaleEditor);
    document.getElementById("salesSearch")?.addEventListener("input", event => { saleState.search = event.target.value.trim().toLowerCase(); saleState.page = 1; renderSales(); });
    const cycleFilter = key => {
        const options = key === "payment"
            ? ["", ...new Set(saleState.rows.map(row => row.PaymentStatus || "Unpaid").filter(Boolean))]
            : ["", ...new Set(saleState.rows.map(row => row.SalesStaffName || "Unassigned").filter(Boolean))];
        saleState[key] = options[(options.indexOf(saleState[key]) + 1) % options.length];
        saleState.page = 1; paintSalesFilters(); renderSales();
    };
    [["salesPaymentFilter", "payment"], ["salesStaffFilter", "staff"]].forEach(([id, key]) => {
        const element = document.getElementById(id);
        element?.addEventListener("click", () => cycleFilter(key));
        element?.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); cycleFilter(key); } });
    });
    document.querySelector("#sec-sales .page-btns")?.addEventListener("click", event => {
        const page = Number(event.target.closest("[data-page]")?.dataset.page);
        const max = Math.max(1, Math.ceil(filteredSales().length / saleState.pageSize));
        if (page >= 1 && page <= max) { saleState.page = page; renderSales(); }
    });
    document.getElementById("salesTableBody")?.addEventListener("click", event => {
        const button = event.target.closest('[data-action="view"]');
        if (button) showSaleDetails(button.dataset.id);
    });
    document.getElementById("viewRefundsBtn")?.addEventListener("click", () => openRefundsModal(false));
    paintSalesFilters();
});
