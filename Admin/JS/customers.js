




const CUSTOMER_FIELDS = [
    "custID", "custFullName", "custGender", "custDOB",
    "custPhone", "custEmail", "custRegDate", "custAddress"
];

let customerCache = [];
let customerPage = 1;
const CUSTOMER_PAGE_SIZE = 5;
let customerGenderFilter = "";
let customerYearFilter = "all";




function getCustomerForm() {
    const els = {};
    for (const id of CUSTOMER_FIELDS) {
        els[id] = document.getElementById(id);
        if (!els[id]) {
            console.error(`Customer form element #${id} not found.`);
            return null;
        }
    }
    return els;
}

function readCustomerForm(f) {
    return {
        id:      f.custID.value.trim(),
        fname:   f.custFullName.value.trim(),
        gen:     f.custGender.value,
        dob:     f.custDOB.value,
        phone:   f.custPhone.value.trim(),
        email:   f.custEmail.value.trim(),
        rgdate:  f.custRegDate.value,
        address: f.custAddress.value.trim()
    };
}

function initials(name) {
    return String(name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() ?? "")
        .join("");
}

function formatDate(value) {
    if (!value) return "";
    const d = new Date(value + "T00:00:00");
    if (isNaN(d)) return value;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}




async function loadCustomers() {
    const body = document.getElementById("customerTableBody");
    try {
        const response = await apiGet("customer");
        customerCache = Array.isArray(response)
            ? response
            : response?.data || response?.customers || [];
        applyCustomerFilter();
    } catch (error) {
        console.error("Failed to load customers:", error);
        if (body) {
            body.innerHTML = `<tr><td colspan="7" class="empty-message">Failed to load customers: ${escapeHtml(error.message)}</td></tr>`;
        }
    }
}

function applyCustomerFilter() {
    customerPage = 1;
    displayCustomers(filteredCustomers());
}

function filteredCustomers() {
    const q = (document.getElementById("customerSearch")?.value || "").trim().toLowerCase();
    const currentYear = new Date().getFullYear();
    return customerCache.filter(customer => {
        if (customerGenderFilter && String(customer.Gender || "") !== customerGenderFilter) return false;
        const year = Number(String(customer.RegisterationDate || "").slice(0, 4));
        if (customerYearFilter === "current" && year !== currentYear) return false;
        if (customerYearFilter === "previous" && year !== currentYear - 1) return false;
        if (customerYearFilter === "older" && (!year || year >= currentYear - 1)) return false;
        return !q || [customer.CustomerID, customer.FullName, customer.Phone, customer.Email, customer.Gender]
            .some(value => String(value ?? "").toLowerCase().includes(q));
    });
}

function paintCustomerFilters() {
    const gender = document.getElementById("customerGenderFilter");
    const year = document.getElementById("customerYearFilter");
    if (gender) gender.firstChild.textContent = `Gender: ${customerGenderFilter || "All"} `;
    const yearLabels = { current: "This year", previous: "Last year", older: "Earlier", all: "All time" };
    if (year) year.firstChild.textContent = `Registered: ${yearLabels[customerYearFilter]} `;
}

function displayCustomers(customers) {
    const body = document.getElementById("customerTableBody");
    if (!body) {
        console.error("customerTableBody not found");
        return;
    }

    if (!customers.length) {
        body.innerHTML = `<tr><td colspan="7" class="empty-message">No customers found.</td></tr>`;
        renderCustomerPagination(0, 1);
        return;
    }

    const pages = Math.max(1, Math.ceil(customers.length / CUSTOMER_PAGE_SIZE));
    customerPage = Math.min(customerPage, pages);
    const start = (customerPage - 1) * CUSTOMER_PAGE_SIZE;
    const visibleCustomers = customers.slice(start, start + CUSTOMER_PAGE_SIZE);
    body.innerHTML = visibleCustomers.map(c => `
        <tr>
            <td class="cell-primary">CUS-${escapeHtml(c.CustomerID)}</td>
            <td>
                <div class="row-avatar">
                    ${nameWithAvatar(c.FullName)}
                </div>
            </td>
            <td>${escapeHtml(c.Phone)}</td>
            <td>${escapeHtml(c.Email)}</td>
            <td>${escapeHtml(c.Gender)}</td>
            <td>${escapeHtml(formatDate(c.RegisterationDate))}</td>
            <td class="row-actions">
                <button type="button" class="ricon" title="Edit" aria-label="Edit ${escapeHtml(c.FullName)}" data-action="edit" data-id="${escapeHtml(c.CustomerID)}">✎</button>
                <button type="button" class="ricon" title="Delete" aria-label="Delete ${escapeHtml(c.FullName)}" data-action="delete" data-id="${escapeHtml(c.CustomerID)}">🗑</button>
            </td>
        </tr>`).join("");
    renderCustomerPagination(customers.length, pages);
}

function renderCustomerPagination(total, pages) {
    const pagination = document.querySelector("#sec-customers .pagination");
    if (!pagination) return;
    const summary = pagination.querySelector("span");
    const controls = pagination.querySelector(".page-btns");
    if (!summary || !controls) return;
    const from = total ? (customerPage - 1) * CUSTOMER_PAGE_SIZE + 1 : 0;
    const to = Math.min(total, customerPage * CUSTOMER_PAGE_SIZE);
    summary.textContent = `Showing ${from}–${to} of ${total} customers`;
    controls.innerHTML = pages <= 1 ? "" :
        `<button type="button" class="page-btn" data-page="${customerPage - 1}" aria-label="Previous page">‹</button>` +
        Array.from({ length: pages }, (_, index) => index + 1).map(page =>
            `<button type="button" class="page-btn ${page === customerPage ? "active" : ""}" data-page="${page}" aria-current="${page === customerPage ? "page" : "false"}">${page}</button>`
        ).join("") +
        `<button type="button" class="page-btn" data-page="${customerPage + 1}" aria-label="Next page">›</button>`;
    controls.onclick = event => {
        const button = event.target.closest("[data-page]");
        if (!button) return;
        const page = Number(button.dataset.page);
        if (page >= 1 && page <= pages) { customerPage = page; applyCustomerFilterWithoutReset(); }
    };
}

function applyCustomerFilterWithoutReset() {
    displayCustomers(filteredCustomers());
}




async function addCustomer() {
    const f = getCustomerForm();
    if (!f) return;

    const data = readCustomerForm(f);
    if (data.fname === "" || data.gen === "") {
        alert("Please enter the customer's full name and gender.");
        return;
    }
    if (data.id === "") delete data.id; 

    try {
        await apiPost("customer", data);
        alert("Customer added successfully!");
        clearCustomerForm();
        closeModal();
        await loadCustomers();
    } catch (error) {
        console.error("Failed to add customer:", error);
        alert("Failed to add customer: " + error.message);
    }
}




async function editCustomer(id) {
    const f = getCustomerForm();
    if (!f) return;

    let c;
    try {
        c = await apiGet("customer", id);
    } catch (error) {
        alert("Customer not found: " + error.message);
        return;
    }

    f.custID.value       = c.CustomerID ?? "";
    f.custFullName.value = c.FullName ?? "";
    f.custGender.value   = c.Gender ?? "Male";
    f.custDOB.value      = c.DateOfBirth ?? "";
    f.custPhone.value    = c.Phone ?? "";
    f.custEmail.value    = c.Email ?? "";
    f.custRegDate.value  = c.RegisterationDate ?? "";
    f.custAddress.value  = c.Address ?? "";

    f.custID.readOnly = true; 
    document.getElementById("customerSubmitBtn").textContent = "Update Customer";
    openEmbeddedForm("customerForm", "Edit Customer");
}




async function updateCustomer() {
    const f = getCustomerForm();
    if (!f) return;

    const data = readCustomerForm(f);
    if (data.id === "") {
        alert("Please select a customer to update.");
        return;
    }
    if (data.fname === "" || data.gen === "") {
        alert("Please enter the customer's full name and gender.");
        return;
    }

    try {
        await apiPut("customer", data);
        alert("Customer updated successfully!");
        clearCustomerForm();
        closeModal();
        await loadCustomers();
    } catch (error) {
        console.error("Failed to update customer:", error);
        alert("Failed to update customer: " + error.message);
    }
}




async function deleteCustomer(id) {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this customer?")) return;

    try {
        await apiDelete("customer", id);
        alert("Customer deleted successfully!");
        await loadCustomers();
    } catch (error) {
        console.error("Failed to delete customer:", error);
        alert("Failed to delete customer: " + error.message);
    }
}




function clearCustomerForm() {
    CUSTOMER_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = el.tagName === "SELECT" ? "Male" : "";
    });
    const idInput = document.getElementById("custID");
    if (idInput) idInput.readOnly = false;

    const btn = document.getElementById("customerSubmitBtn");
    if (btn) btn.textContent = "Add Customer";
}




document.addEventListener("DOMContentLoaded", () => {

    
    document.getElementById("customerSubmitBtn")?.addEventListener("click", () => {
        const f = document.getElementById("custID");
        return f && f.readOnly && f.value ? updateCustomer() : addCustomer();
    });

    document.getElementById("customerClearBtn")?.addEventListener("click", clearCustomerForm);

    document.getElementById("newCustomerBtn")?.addEventListener("click", () => {
        clearCustomerForm();
        openEmbeddedForm("customerForm", "Add Customer");
        document.getElementById("custFullName")?.focus();
    });

    document.getElementById("customerSearch")?.addEventListener("input", applyCustomerFilter);
    const genderFilter = document.getElementById("customerGenderFilter");
    const yearFilter = document.getElementById("customerYearFilter");
    const activate = (element, callback) => {
        element?.addEventListener("click", callback);
        element?.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); callback(); } });
    };
    activate(genderFilter, () => {
        const values = ["", ...new Set(customerCache.map(row => row.Gender).filter(Boolean))];
        customerGenderFilter = values[(values.indexOf(customerGenderFilter) + 1) % values.length];
        paintCustomerFilters(); applyCustomerFilter();
    });
    activate(yearFilter, () => {
        const values = ["current", "previous", "older", "all"];
        customerYearFilter = values[(values.indexOf(customerYearFilter) + 1) % values.length];
        paintCustomerFilters(); applyCustomerFilter();
    });

    document.getElementById("customerTableBody")?.addEventListener("click", event => {
        const el = event.target.closest("[data-action]");
        if (!el) return;
        if (el.dataset.action === "edit") editCustomer(el.dataset.id);
        if (el.dataset.action === "delete") deleteCustomer(el.dataset.id);
    });

    loadCustomers();
    paintCustomerFilters();
});
