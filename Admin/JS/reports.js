const reportDefinitions = [
    { title: "Customer Report", resource: "customer", columns: ["Customer ID", "Name", "Gender", "Phone", "Email", "Registered"], row: r => [r.CustomerID, r.FullName, r.Gender, r.Phone, r.Email, fmtDate(r.RegisterationDate)] },
    { title: "Eye Examination Report", resource: "examination", columns: ["Exam ID", "Customer", "Optometrist", "Date", "Findings"], row: r => [r.ExamID, r.CustomerName, r.OptometristName, fmtDate(r.ExamDate), r.ResultSummary] },
    { title: "Prescription Report", resource: "prescriptions", columns: ["Prescription ID", "Customer", "Optometrist", "Issued", "Expires"], row: r => [r.PrescriptionID, r.CustomerName, r.OptometristName, fmtDate(r.PrescriptionDate), fmtDate(r.ExpiryDate)] },
    { title: "Product Inventory Report", resource: "products", columns: ["Product", "SKU", "Category", "Brand", "Stock", "Unit Price", "Status"], row: r => [r.ProductName, r.SKU, r.ProductType, r.BrandName, r.StockQTy, fmtMoney(r.UnitPrice), r.Status] },
    { title: "Sales Report", resource: "sale", columns: ["Invoice", "Customer", "Staff", "Date", "Subtotal", "Discount", "Total", "Payment"], row: r => [r.OrderID, r.CustomerName || "Walk-in", r.SalesStaffName, fmtDate(r.OrderDate), fmtMoney(r.SubTotal), fmtMoney(r.Discount), fmtMoney(r.TotalAmount), r.PaymentStatus] },
    { title: "Purchase Report", resource: "inventory", columns: ["Product", "Movement", "Quantity", "Employee", "Date"], row: r => [r.ProductName, r.TransactionType, r.Qty, r.EmployeeName, fmtDate(r.TransactionDate)] },
    { title: "Supplier Report", resource: "suppliers", columns: ["Supplier", "Contact", "Phone", "Email", "Address"], row: r => [r.SupplierName, r.ContactPerson, r.Phone, r.Email, r.Address] },
    { title: "Revenue Report", resource: "sale", columns: ["Invoice", "Date", "Subtotal", "Discount", "Revenue"], row: r => [r.OrderID, fmtDate(r.OrderDate), fmtMoney(r.SubTotal), fmtMoney(r.Discount), fmtMoney(r.TotalAmount)] },
    { title: "Best Selling Products Report", resource: "reports", reportId: "best-sellers", columns: ["Product", "SKU", "Units Sold", "Revenue"], row: r => [r.ProductName, r.SKU, r.UnitsSold, fmtMoney(r.Revenue)] }
];

async function reportData(definition) {
    const result = await apiGet(definition.resource, definition.reportId || null);
    const rows = Array.isArray(result) ? result : [];
    return { headers: definition.columns, rows: rows.map(definition.row) };
}

async function previewReport(definition, exportFile = false) {
    try {
        const data = await reportData(definition);
        if (exportFile) return downloadCsv(definition.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".csv", data.headers, data.rows);
        showTable(definition.title, data.headers, data.rows);
    } catch (error) { toast("Could not load report: " + error.message, "error"); }
}

async function chooseReportExport(format) {
    await openFormModal({
        title: format === "csv" ? "Export report as CSV" : "Print report",
        fields: [{ name: "Report", label: "Report", type: "select", required: true, options: reportDefinitions.map(def => ({ value: def.title, label: def.title })) }],
        submitLabel: format === "csv" ? "Download CSV" : "Open print view",
        onSubmit: async data => {
            const definition = reportDefinitions.find(def => def.title === data.Report);
            if (!definition) throw new Error("Select a report.");
            const result = await reportData(definition);
            if (format === "csv") downloadCsv(definition.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".csv", result.headers, result.rows);
            else {
                const head = result.headers.map(value => "<th>" + escapeHtml(value) + "</th>").join("");
                const body = result.rows.map(row => "<tr>" + row.map(value => "<td>" + escapeHtml(value ?? "") + "</td>").join("") + "</tr>").join("");
                printHtml(definition.title, "<table><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table>");
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("#sec-reports .report-card").forEach((card, index) => {
        const definition = reportDefinitions[index];
        if (!definition) return;
        const buttons = card.querySelectorAll(".report-foot button");
        buttons[0]?.addEventListener("click", () => previewReport(definition));
        buttons[1]?.addEventListener("click", () => previewReport(definition, true));
    });
    const headerButtons = document.querySelectorAll("#sec-reports .page-actions button");
    headerButtons[0]?.addEventListener("click", () => chooseReportExport("csv"));
    headerButtons[1]?.addEventListener("click", () => chooseReportExport("pdf"));
});
