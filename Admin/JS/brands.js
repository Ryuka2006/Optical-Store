document.addEventListener("DOMContentLoaded", () => {
    initCrudSection({
        section: "sec-brands", resource: "brand", label: "Brand", idKey: "BrandID",
        addButton: /Add Brand/i, plural: "brands", searchKeys: ["BrandName", "Description"],
        fields: [
            { name: "BrandName", label: "Brand name", required: true, placeholder: "Brand name" },
            { name: "Description", label: "Description", type: "textarea", full: true, placeholder: "About this brand" }
        ],
        renderRow: row => `<tr><td class="cell-primary">${escapeHtml(row.BrandName)}</td>
            <td>${escapeHtml(row.Description || "—")}</td><td>${escapeHtml(row.ProductCount ?? 0)}</td>
            ${actionIcons(row.BrandID)}</tr>`,
        afterChange: () => clearLookup("brand")
    });
});
