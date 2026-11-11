document.addEventListener("DOMContentLoaded", () => {
    initCrudSection({
        section: "sec-inventory", resource: "inventory", label: "Stock movement", idKey: "InventoryID",
        addButton: /Stock In/i, addLabel: "Stock In", plural: "movements",
        searchKeys: ["ProductName", "SKU", "EmployeeName", "TransactionType", "Qty"],
        filters: [{ key: "TransactionType", label: "Movement", values: rows => [...new Set(rows.map(row => row.TransactionType).filter(Boolean))] }],
        fields: [
            { name: "ProductID", label: "Product", type: "select", required: true,
              lookup: { resource: "products", value: "ProductID", label: row => `${row.ProductName} (stock ${row.StockQTy})` } },
            { name: "TransactionType", label: "Movement", options: ["Stock In", "Stock Out", "Adjustment"], required: true, default: "Stock In" },
            { name: "Qty", label: "Quantity / target stock", type: "number", required: true, step: "1" },
            { name: "EmployeeID", label: "Recorded by", type: "select",
              lookup: { resource: "employees", value: "EmployeeID", label: row => `${row.FullName} (EMP-${row.EmployeeID})` } }
        ],
        renderRow: row => {
            const qty = Number(row.Qty || 0);
            const movement = row.TransactionType === "Stock In" ? `+${qty}` : (qty < 0 ? String(qty) : `+${qty}`);
            return `<tr>
                <td class="cell-primary">${escapeHtml(row.ProductName)}</td>
                <td>${escapeHtml(row.CurrentStock)}</td>
                <td>${escapeHtml(movement)}</td>
                <td>${nameWithAvatar(row.EmployeeName)}</td>
                <td>${badge(row.TransactionType, row.TransactionType === "Stock In" ? "green" : row.TransactionType === "Stock Out" ? "amber" : "blue")}</td>
                <td>${escapeHtml(fmtDate(row.TransactionDate))}</td>
            </tr>`;
        },
        headerButtons: [
            { match: /Stock Adjustment/i, run: (_rows, api) => api.openEditor(null, { TransactionType: "Adjustment" }) },
            { match: /Inventory History/i, run: rows => showTable("Inventory movement history", ["Product", "Type", "Quantity change", "Current stock", "Employee", "Date"], rows.map(row => [row.ProductName, row.TransactionType, row.Qty, row.CurrentStock, row.EmployeeName, fmtDate(row.TransactionDate)])) }
        ],
        onRender: rows => {
            document.getElementById("inventoryMoveCount").textContent = rows.length.toLocaleString();
            document.getElementById("inventoryInCount").textContent = rows.filter(row => row.TransactionType === "Stock In").length.toLocaleString();
            document.getElementById("inventoryOutCount").textContent = rows.filter(row => row.TransactionType === "Stock Out").length.toLocaleString();
            document.getElementById("inventoryAdjustmentCount").textContent = rows.filter(row => row.TransactionType === "Adjustment").length.toLocaleString();
        },
        afterChange: () => clearLookup("products")
    });
});
