document.addEventListener("DOMContentLoaded", () => {
    initCrudSection({
        section: "sec-prescriptions", resource: "prescriptions", label: "Prescription", idKey: "PrescriptionID",
        addButton: /Add Prescription/i, plural: "prescriptions",
        searchKeys: ["PrescriptionID", "CustomerName", "OptometristName", "PrescriptionDate", "ExpiryDate"],
        fields: [
            { name: "ExaminationID", label: "Eye examination", type: "select", required: true,
              lookup: { resource: "examination", value: "ExamID", label: row => `EX-${row.ExamID} · ${row.CustomerName || "Customer"} · ${fmtDate(row.ExamDate)}` } },
            { name: "CustomerID", label: "Customer", type: "select", required: true,
              lookup: { resource: "customer", value: "CustomerID", label: row => `${row.FullName} (CUS-${row.CustomerID})` } },
            { name: "OptometristID", label: "Optometrist", type: "select", required: true,
              lookup: { resource: "employees", value: "EmployeeID", label: row => `${row.FullName} (EMP-${row.EmployeeID})` } },
            { name: "PrescriptionDate", label: "Prescription date", type: "date", required: true, default: new Date().toISOString().slice(0, 10) },
            { name: "ExpiryDate", label: "Expiry date", type: "date" }
        ],
        renderRow: row => `<tr>
            <td class="cell-primary">RX-${escapeHtml(String(row.PrescriptionID).padStart(5, "0"))}</td>
            <td>${nameWithAvatar(row.CustomerName, `Customer #${row.CustomerID || "—"}`)}</td>
            <td>${nameWithAvatar(row.OptometristName, `Employee #${row.OptometristID || "—"}`)}</td>
            <td>${escapeHtml(fmtDate(row.PrescriptionDate))}</td>
            <td>${escapeHtml(fmtDate(row.ExpiryDate) || "—")}</td>
            ${actionIcons(row.PrescriptionID, ["view", "edit", "delete"])}
        </tr>`,
        actions: {
            view: row => showDetails(`Prescription RX-${row.PrescriptionID}`, [
                ["Customer", row.CustomerName], ["Optometrist", row.OptometristName],
                ["Eye examination", row.ExaminationID], ["Issued", fmtDate(row.PrescriptionDate)], ["Expires", fmtDate(row.ExpiryDate)]
            ])
        },
        headerButtons: [{ match: /Print Prescription/i, run: rows => printHtml("Prescription Report", `<table><thead><tr><th>Rx</th><th>Customer</th><th>Optometrist</th><th>Issued</th><th>Expires</th></tr></thead><tbody>${rows.map(row => `<tr><td>RX-${escapeHtml(row.PrescriptionID)}</td><td>${escapeHtml(row.CustomerName)}</td><td>${escapeHtml(row.OptometristName)}</td><td>${escapeHtml(fmtDate(row.PrescriptionDate))}</td><td>${escapeHtml(fmtDate(row.ExpiryDate))}</td></tr>`).join("")}</tbody></table>` ) }]
    });
});
