



let appointmentPage = 1;
let appointmentRows = [];
let appointmentWeekOffset = 0;
let appointmentSelectedDate = localDateString(new Date());
let appointmentSelectedStaff = "";
const APPOINTMENT_PAGE_SIZE = 5;

function localDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function renderAppointmentWeek() {
    const week = document.getElementById("appointmentWeek");
    if (!week) return;
    const today = new Date();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) + appointmentWeekOffset * 7);
    week.innerHTML = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        const iso = localDateString(date);
        return `<button type="button" class="appt-day ${appointmentSelectedDate === iso ? "active" : ""}" data-date="${iso}" aria-pressed="${appointmentSelectedDate === iso}"><span class="d-num">${String(date.getDate()).padStart(2, "0")}</span><span class="d-name">${date.toLocaleDateString(undefined, { weekday: "short" })}</span></button>`;
    }).join("");
}

function currentAppointmentWeekRange() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) + appointmentWeekOffset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return [localDateString(start), localDateString(end)];
}






function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}


function formatTime(time) {

    if (!time) {
        return "";
    }

    const parts = String(time).split(":");

    const hour = parseInt(parts[0], 10);
    const minute = parts[1] || "00";

    if (isNaN(hour)) {
        return time;
    }

    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${suffix}`;
}






const STATUS_BADGE = {
    Scheduled: "amber",
    Confirmed: "blue",
    Completed: "green",
    Cancelled: "red"
};






const USER_ICON = `
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
    >
        <circle cx="12" cy="8" r="4"></circle>
        <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"></path>
    </svg>
`;






const FORM_FIELDS = [
    "appointmentID",
    "customerID",
    "optometristID",
    "appointmentDate",
    "appointmentTime",
    "appointmentStatus"
];


function getForm() {

    const form = {};

    for (const id of FORM_FIELDS) {

        const element = document.getElementById(id);

        if (!element) {
            console.error(`Element #${id} not found.`);
            return null;
        }

        form[id] = element;
    }

    return form;
}






function readFormData(form) {

    return {
        id: form.appointmentID.value.trim(),

        cusid: form.customerID.value.trim(),

        optoid: form.optometristID.value.trim(),

        date: form.appointmentDate.value,

        time: form.appointmentTime.value,

        status: form.appointmentStatus.value
    };
}






function isFormValid(data) {

    if (!data.cusid) return false;
    if (!data.optoid) return false;
    if (!data.date) return false;
    if (!data.time) return false;
    if (!data.status) return false;

    return true;
}

async function loadAppointmentChoices(customerId = "", employeeId = "") {
    const form = getForm();
    if (!form) return;
    const [customers, employees] = await Promise.all([apiGet("customer"), apiGet("employees")]);
    form.customerID.innerHTML = '<option value="">Select customer...</option>' +
        (customers || []).map(row => `<option value="${escapeHtml(row.CustomerID)}">${escapeHtml(row.FullName)} (CUS-${escapeHtml(row.CustomerID)})</option>`).join("");
    const eligible = (employees || []).filter(row => /optometrist|optician/i.test(String(row.RoleName || "")));
    const staff = eligible.length ? eligible : (employees || []);
    form.optometristID.innerHTML = '<option value="">Select optometrist...</option>' +
        staff.map(row => `<option value="${escapeHtml(row.EmployeeID)}">${escapeHtml(row.FullName)} (EMP-${escapeHtml(row.EmployeeID)})</option>`).join("");
    form.customerID.value = String(customerId || "");
    form.optometristID.value = String(employeeId || "");
}






async function loadAppointments() {

    const container =
        document.getElementById("appointmentContainer");

    if (!container) {
        console.error(
            "#appointmentContainer was not found."
        );
        return;
    }

    container.innerHTML = `
        <div class="empty-message">
            Loading appointments...
        </div>
    `;

    try {

        const response = await apiGet("appointment");

        console.log("Appointments response:", response);

        let appointments = [];

        if (Array.isArray(response)) {

            appointments = response;

        } else if (Array.isArray(response?.data)) {

            appointments = response.data;

        } else if (Array.isArray(response?.appointments)) {

            appointments = response.appointments;

        }

        appointmentRows = appointments;
        renderAppointmentWeek();
        displayAppointments(appointmentRows);

    } catch (error) {

        console.error(
            "Failed to load appointments:",
            error
        );

        container.innerHTML = `
            <div class="empty-message">
                Failed to load appointments.<br>
                ${escapeHtml(error.message)}
            </div>
        `;
    }
}






function displayAppointments(appointments) {

    const container =
        document.getElementById("appointmentContainer");

    if (!container) {
        console.error(
            "#appointmentContainer not found."
        );
        return;
    }

    let filtered = Array.isArray(appointments) ? appointments : [];
    if (appointmentSelectedDate) filtered = filtered.filter(row => String(row.AppointmentDate).slice(0, 10) === appointmentSelectedDate);
    else {
        const [startDate, endDate] = currentAppointmentWeekRange();
        filtered = filtered.filter(row => String(row.AppointmentDate).slice(0, 10) >= startDate && String(row.AppointmentDate).slice(0, 10) <= endDate);
    }
    if (appointmentSelectedStaff) filtered = filtered.filter(row => String(row.OptometristID) === appointmentSelectedStaff);
    if (!filtered.length) {

        container.innerHTML = `
            <div class="empty-message">
                No appointments found.
            </div>
        `;
        renderAppointmentPagination(0, 1);
        return;
    }

    const pages = Math.max(1, Math.ceil(filtered.length / APPOINTMENT_PAGE_SIZE));
    appointmentPage = Math.min(appointmentPage, pages);
    const start = (appointmentPage - 1) * APPOINTMENT_PAGE_SIZE;
    const visibleAppointments = filtered.slice(start, start + APPOINTMENT_PAGE_SIZE);


    container.innerHTML = visibleAppointments.map(appointment => {

        const status =
            appointment.Status ?? "Scheduled";

        const badge =
            STATUS_BADGE[status] || "blue";

        let cardClass = "";

        if (status === "Completed") {
            cardClass = " completed";
        }

        if (status === "Cancelled") {
            cardClass = " cancelled";
        }

        
        const customerDisplay = nameWithAvatar(appointment.CustomerName, `Customer #${appointment.CustomerID}`);

        const optometristDisplay = nameWithAvatar(appointment.OptometristName, `Optometrist #${appointment.OptometristID}`);


        return `
            <div class="appt-card${cardClass}">

                <div class="appt-time">
                    ${escapeHtml(appointment.AppointmentDate)}
                    ·
                    ${escapeHtml(
                        formatTime(
                            appointment.AppointmentTime
                        )
                    )}
                </div>

                <div class="appt-name">
                    ${customerDisplay}
                </div>

                <div class="appt-with">
                    ${USER_ICON}
                    ${optometristDisplay}
                </div>

                <div class="appt-foot">

                    <span class="badge ${badge}">
                        ${escapeHtml(status)}
                    </span>

                    <span class="appt-actions">

                        <button
                            type="button"
                            class="btn btn-ghost btn-sm"
                            data-action="edit"
                            data-id="${escapeHtml(
                                appointment.AppointmentID
                            )}"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="btn btn-ghost btn-sm btn-danger"
                            data-action="delete"
                            data-id="${escapeHtml(
                                appointment.AppointmentID
                            )}"
                        >
                            Delete
                        </button>

                    </span>

                </div>

            </div>
        `;

    }).join("");
    renderAppointmentPagination(filtered.length, pages);
}

function renderAppointmentPagination(total, pages) {
    const pagination = document.getElementById("appointmentPagination");
    const summary = pagination?.querySelector("span");
    const controls = pagination?.querySelector(".page-btns");
    if (!summary || !controls) return;
    const from = total ? (appointmentPage - 1) * APPOINTMENT_PAGE_SIZE + 1 : 0;
    const to = Math.min(total, appointmentPage * APPOINTMENT_PAGE_SIZE);
    summary.textContent = `Showing ${from}–${to} of ${total} appointments`;
    controls.innerHTML = pages <= 1 ? "" :
        `<button type="button" class="page-btn" data-page="${appointmentPage - 1}" aria-label="Previous page">‹</button>` +
        Array.from({ length: pages }, (_, index) => index + 1).map(page =>
            `<button type="button" class="page-btn ${page === appointmentPage ? "active" : ""}" data-page="${page}" aria-current="${page === appointmentPage ? "page" : "false"}">${page}</button>`
        ).join("") +
        `<button type="button" class="page-btn" data-page="${appointmentPage + 1}" aria-label="Next page">›</button>`;
    controls.onclick = event => {
        const button = event.target.closest("[data-page]");
        if (!button) return;
        const page = Number(button.dataset.page);
        if (page >= 1 && page <= pages) {
            appointmentPage = page;
            displayAppointments(appointmentRows);
        }
    };
}






async function getAppointment(id) {

    try {

        const response =
            await apiGet("appointment", id);

        console.log(
            "Single appointment:",
            response
        );

        return (
            response?.data ??
            response?.appointment ??
            response
        );

    } catch (error) {

        console.error(
            "Failed to get appointment:",
            error
        );

        return null;
    }
}






async function addAppointment() {

    const form = getForm();

    if (!form) return;


    const data = readFormData(form);


    if (!isFormValid(data)) {

        alert(
            "Please fill in all appointment fields."
        );

        return;
    }


    
    delete data.id;


    try {

        console.log(
            "Adding appointment:",
            data
        );

        await apiPost(
            "appointment",
            data
        );

        alert(
            "Appointment added successfully!"
        );

        clearAppointmentForm();
        closeModal();

        await loadAppointments();

    } catch (error) {

        console.error(
            "Failed to add appointment:",
            error
        );

        alert(
            "Failed to add appointment:\n" +
            error.message
        );
    }
}






async function editAppointment(id) {

    const form = getForm();

    if (!form) return;


    const appointment =
        await getAppointment(id);


    if (
        !appointment ||
        !appointment.AppointmentID
    ) {

        alert(
            "Appointment not found."
        );

        return;
    }


    form.appointmentID.value =
        appointment.AppointmentID ?? "";

    await loadAppointmentChoices(appointment.CustomerID, appointment.OptometristID);

    form.appointmentDate.value =
        appointment.AppointmentDate ?? "";

    form.appointmentTime.value =
        String(
            appointment.AppointmentTime ?? ""
        ).substring(0, 5);

    form.appointmentStatus.value =
        appointment.Status ?? "Scheduled";


    const button =
        document.getElementById(
            "appointmentSubmitBtn"
        );

    if (button) {
        button.textContent =
            "Update Appointment";
    }


    openEmbeddedForm("appointmentForm", "Edit Appointment");
}






async function updateAppointment() {

    const form = getForm();

    if (!form) return;


    const data = readFormData(form);


    if (!data.id) {

        alert(
            "Please select an appointment to update."
        );

        return;
    }


    if (!isFormValid(data)) {

        alert(
            "Please fill in all appointment fields."
        );

        return;
    }


    try {

        console.log(
            "Updating appointment:",
            data
        );

        await apiPut(
            "appointment",
            data
        );

        alert(
            "Appointment updated successfully!"
        );

        clearAppointmentForm();
        closeModal();

        await loadAppointments();

    } catch (error) {

        console.error(
            "Failed to update appointment:",
            error
        );

        alert(
            "Failed to update appointment:\n" +
            error.message
        );
    }
}






async function deleteAppointment(id) {

    if (!id) {

        console.error(
            "Appointment ID is missing."
        );

        return;
    }


    const confirmed = confirm(
        "Are you sure you want to delete this appointment?"
    );

    if (!confirmed) return;


    try {

        await apiDelete(
            "appointment",
            id
        );

        alert(
            "Appointment deleted successfully!"
        );

        await loadAppointments();

    } catch (error) {

        console.error(
            "Failed to delete appointment:",
            error
        );

        alert(
            "Failed to delete appointment:\n" +
            error.message
        );
    }
}






function clearAppointmentForm() {

    const form = getForm();

    if (!form) return;


    form.appointmentID.value = "";

    form.customerID.value = "";

    form.optometristID.value = "";

    form.appointmentDate.value = "";

    form.appointmentTime.value = "";

    form.appointmentStatus.value =
        "Scheduled";


    const button =
        document.getElementById(
            "appointmentSubmitBtn"
        );

    if (button) {
        button.textContent =
            "Add Appointment";
    }
}






document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Appointment JavaScript loaded."
        );


        
        document
            .getElementById(
                "appointmentSubmitBtn"
            )
            ?.addEventListener(
                "click",
                () => {

                    const id =
                        document
                            .getElementById(
                                "appointmentID"
                            )
                            ?.value
                            .trim();

                    if (id) {

                        updateAppointment();

                    } else {

                        addAppointment();

                    }
                }
            );


        
        document
            .getElementById(
                "newAppointmentBtn"
            )
            ?.addEventListener(
                "click",
                () => {

                    clearAppointmentForm();
                    loadAppointmentChoices();
                    openEmbeddedForm("appointmentForm", "New Appointment");

                    document
                        .getElementById(
                            "customerID"
                        )
                        ?.focus();
                }
            );


        
        document
            .getElementById(
                "appointmentContainer"
            )
            ?.addEventListener(
                "click",
                event => {

                    const button =
                        event.target.closest(
                            "button[data-action]"
                        );

                    if (!button) return;


                    const id =
                        button.dataset.id;

                    const action =
                        button.dataset.action;


                    if (action === "edit") {

                        editAppointment(id);

                    }


                    if (action === "delete") {

                        deleteAppointment(id);

                    }

                }
            );


        renderAppointmentWeek();
        document.getElementById("appointmentWeek")?.addEventListener("click", event => {
            const button = event.target.closest("[data-date]");
            if (!button) return;
            appointmentSelectedDate = button.dataset.date;
            appointmentPage = 1;
            renderAppointmentWeek();
            displayAppointments(appointmentRows);
        });
        document.getElementById("appointmentWeekPrev")?.addEventListener("click", () => {
            appointmentWeekOffset--;
            appointmentSelectedDate = "";
            renderAppointmentWeek();
            displayAppointments(appointmentRows);
        });
        document.getElementById("appointmentWeekNext")?.addEventListener("click", () => {
            appointmentWeekOffset++;
            appointmentSelectedDate = "";
            renderAppointmentWeek();
            displayAppointments(appointmentRows);
        });
        document.getElementById("appointmentStaffFilter")?.addEventListener("click", async () => {
            try {
                const employees = await apiGet("employees");
                await openFormModal({
                    title: "Filter by Optometrist",
                    fields: [{ name: "EmployeeID", label: "Optometrist", type: "select", options: [
                        { value: "", label: "All optometrists" }, ...(employees || []).map(row => ({ value: row.EmployeeID, label: row.FullName }))
                    ] }],
                    values: { EmployeeID: appointmentSelectedStaff },
                    submitLabel: "Apply Filter",
                    onSubmit: async data => {
                        appointmentSelectedStaff = data.EmployeeID;
                        const label = (employees || []).find(row => String(row.EmployeeID) === String(data.EmployeeID))?.FullName || "All";
                        document.getElementById("appointmentStaffFilter").childNodes[0].textContent = `Optometrist: ${label} `;
                        appointmentPage = 1;
                        displayAppointments(appointmentRows);
                    }
                });
            } catch (error) { toast(`Could not load optometrists: ${error.message}`, "error"); }
        });

        
        loadAppointmentChoices().catch(error => console.error("Could not load appointment choices:", error));
        loadAppointments();

    }
);
