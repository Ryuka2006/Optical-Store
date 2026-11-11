document.addEventListener("DOMContentLoaded", () => {
    initCrudSection({
        section: "sec-suppliers", resource: "suppliers", label: "Supplier", idKey: "SupplierID",
        addButton: /Add Supplier/i, plural: "suppliers",
        searchKeys: ["SupplierName", "ContactPerson", "Phone", "Email", "Address"],
        fields: [
            { name: "SupplierName", label: "Supplier name", required: true },
            { name: "ContactPerson", label: "Contact person" },
            { name: "Phone", label: "Phone", type: "tel" },
            { name: "Email", label: "Email", type: "email" },
            { name: "Address", label: "Address", type: "textarea", full: true }
        ],
        renderRow: row => `<tr>
            <td class="cell-primary">${escapeHtml(row.SupplierName)}</td>
            <td>${escapeHtml(row.ContactPerson || "—")}</td>
            <td>${escapeHtml(row.Phone || "—")}</td>
            <td>${escapeHtml(row.Email || "—")}</td>
            <td>${escapeHtml(row.Address || "—")}</td>
            ${actionIcons(row.SupplierID)}
        </tr>`,
        afterChange: () => clearLookup("suppliers")
    });
});
