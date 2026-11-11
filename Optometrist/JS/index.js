









function switchView(name) {

     
    const navItems = document.querySelectorAll('.nav-item[data-view]');

     
    const views = document.querySelectorAll('.view');

     
    navItems.forEach(function (item) {

        if (item.dataset.view === name) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }

    });

     
    views.forEach(function (view) {

        if (view.id === 'view-' + name) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }

    });

     
    const content = document.querySelector('.content');

    if (content) {
        content.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

     
    closeSidebar();
}


 

document.addEventListener('DOMContentLoaded', function () {

    document.querySelectorAll('.nav-item[data-view]').forEach(function (item) {

        item.addEventListener('click', function () {

            const viewName = this.dataset.view;

            switchView(viewName);

        });

    });

    document.getElementById('logoutBtn')?.addEventListener('click', function () {
        fetch('../Admin/Api/auth/logout.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
            .finally(function () { window.location.replace('../Admin/login.html'); });
    });

});






function updateClock() {

    const now = new Date();

    const timeElement = document.getElementById('liveTime');
    const dateElement = document.getElementById('liveDate');

    if (!timeElement || !dateElement) {
        return;
    }

    const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const date = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    timeElement.textContent = time;
    dateElement.textContent = date;
}


 

updateClock();

setInterval(updateClock, 1000);






window.Chart = class {
    static defaults = { font: {}, color: '#8892A6' };

    constructor(canvas, config) {
        this.canvas = canvas;
        this.config = config;
        this.data = config.data;
        this.lastWidth = 0;
        this.lastHeight = 0;
        this.resizeObserver = new ResizeObserver(() => {
            const bounds = this.canvas.getBoundingClientRect();
            if (Math.round(bounds.width) !== this.lastWidth || Math.round(bounds.height) !== this.lastHeight) this.update();
        });
        this.resizeObserver.observe(canvas);
        this.update();
    }

    update() {
        const bounds = this.canvas.getBoundingClientRect();
        const width = Math.max(1, this.canvas.clientWidth || bounds.width);
        const height = Math.max(1, this.canvas.clientHeight || bounds.height);
        this.lastWidth = Math.round(bounds.width);
        this.lastHeight = Math.round(bounds.height);
        const scale = Math.max(1, window.devicePixelRatio || 1);
        this.canvas.width = Math.round(width * scale);
        this.canvas.height = Math.round(height * scale);
        const context = this.canvas.getContext('2d');
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.clearRect(0, 0, width, height);
        if (this.config.type === 'doughnut') this.drawDoughnut(context, width, height);
        else this.drawBars(context, width, height);
    }

    drawBars(context, width, height) {
        const labels = this.data.labels || [];
        const values = (this.data.datasets[0]?.data || []).map(function (value) { return Number(value) || 0; });
        if (!labels.length || !values.length || values.every(function (value) { return value === 0; })) {
            context.fillStyle = '#8892A6';
            context.textAlign = 'center';
            context.fillText('No examinations in this period', width / 2, height / 2);
            return;
        }
        const left = 38, right = 10, top = 10, bottom = 34;
        const chartWidth = Math.max(1, width - left - right);
        const chartHeight = Math.max(1, height - top - bottom);
        const maximum = Math.max(1, ...values);
        context.font = '11px Inter, sans-serif';
        context.textAlign = 'right';
        context.textBaseline = 'middle';
        for (let tick = 0; tick <= 4; tick++) {
            const value = Math.ceil(maximum * (4 - tick) / 4);
            const y = top + chartHeight * tick / 4;
            context.strokeStyle = '#EEF1F5';
            context.beginPath();
            context.moveTo(left, y);
            context.lineTo(width - right, y);
            context.stroke();
            context.fillStyle = '#8892A6';
            context.fillText(String(value), left - 8, y);
        }
        const slot = chartWidth / labels.length;
        const barWidth = Math.min(34, slot * 0.62);
        values.forEach(function (value, index) {
            const barHeight = value / maximum * chartHeight;
            const x = left + slot * index + (slot - barWidth) / 2;
            context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--teal').trim() || '#c385fa';
            context.beginPath();
            context.roundRect(x, top + chartHeight - barHeight, barWidth, barHeight, [5, 5, 0, 0]);
            context.fill();
            context.fillStyle = '#8892A6';
            context.textAlign = 'center';
            context.textBaseline = 'top';
            context.fillText(labels[index], x + barWidth / 2, top + chartHeight + 9, slot);
        });
    }

    drawDoughnut(context, width, height) {
        const values = (this.data.datasets[0]?.data || []).map(function (value) { return Math.max(0, Number(value) || 0); });
        const colors = this.data.datasets[0]?.backgroundColor || [];
        const total = values.reduce(function (sum, value) { return sum + value; }, 0);
        const x = width / 2, y = height / 2, radius = Math.max(1, Math.min(width, height) / 2 - 10);
        let start = -Math.PI / 2;
        if (!total) {
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.strokeStyle = '#EEF1F5';
            context.lineWidth = Math.max(8, radius * 0.28);
            context.stroke();
            context.fillStyle = '#8892A6';
            context.font = '12px Inter, sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('No history yet', x, y);
            return;
        }
        values.forEach(function (value, index) {
            const end = start + (value / total) * Math.PI * 2;
            context.beginPath();
            context.arc(x, y, radius, start, end);
            context.strokeStyle = colors[index] || '#CBD3E0';
            context.lineWidth = Math.max(8, radius * 0.28);
            context.stroke();
            start = end;
        });
    }
};

Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = '#8892A6';






const examData = {
    daily: { labels: [], data: [] },
    weekly: { labels: [], data: [] },
    monthly: { labels: [], data: [] }
};






let examChart = null;

function createExamChart() {

     
    if (typeof Chart === 'undefined') {

        console.error(
            'Chart.js is not loaded.'
        );

        return;

    }


     
    const canvas = document.getElementById('examChart');

    if (!canvas) {

        console.error(
            'Cannot find #examChart'
        );

        return;

    }


     
    examChart = new Chart(canvas, {

        type: 'bar',

        data: {

            labels: examData.daily.labels,

            datasets: [

                {

                    label: 'Examinations',

                    data: examData.daily.data,

                    backgroundColor: '#c385fa',
                    borderColor: '#c385fa',

                    borderWidth: 0,

                    borderRadius: 8,

                    maxBarThickness: 34

                }

            ]

        },


        options: {

            responsive: true,

            maintainAspectRatio: false,

            animation: {
                duration: 400
            },


            plugins: {

                legend: {
                    display: false
                },

                tooltip: {

                    backgroundColor: '#152342',

                    titleColor: '#FFFFFF',

                    bodyColor: '#FFFFFF',

                    padding: 12,

                    cornerRadius: 8

                }

            },


            scales: {

                y: {

                    beginAtZero: true,

                    grid: {
                        color: '#EEF1F5'
                    },

                    ticks: {
                        stepSize: 5
                    }

                },


                x: {

                    grid: {
                        display: false
                    }

                }

            }

        }

    });

}






function setupExamToggle() {

    const buttons =
        document.querySelectorAll('#examToggle button');


    buttons.forEach(function (button) {

        button.addEventListener('click', function () {

             
            buttons.forEach(function (btn) {

                btn.classList.remove('active');

            });


             
            this.classList.add('active');


             
            const range = this.dataset.range;


             
            if (!examData[range]) {

                console.error(
                    'Invalid chart range:',
                    range
                );

                return;

            }


             
            if (!examChart) {
                return;
            }


             
            examChart.data.labels =
                examData[range].labels;


             
            examChart.data.datasets[0].data =
                examData[range].data;


             
            examChart.update();

        });

    });

}






let conditionChart = null;

function createConditionChart() {

    if (typeof Chart === 'undefined') {
        return;
    }


    const canvas =
        document.getElementById('condChart');


    if (!canvas) {

        console.error(
            'Cannot find #condChart'
        );

        return;

    }


    conditionChart = new Chart(canvas, {

        type: 'doughnut',

        data: {

            labels: [
                'Myopia',
                'Astigmatism',
                'Hyperopia',
                'Presbyopia',
                'Other'
            ],


            datasets: [

                {

                    data: [0, 0, 0, 0, 0],


                    backgroundColor: [
                        '#4C7DF0',
                        '#1DAA6B',
                        '#8B6BF0',
                        '#E39A1D',
                        '#CBD3E0'
                    ],


                    borderWidth: 4,

                    borderColor: '#FFFFFF',

                    hoverOffset: 6

                }

            ]

        },


        options: {

            responsive: true,

            maintainAspectRatio: false,

            cutout: '72%',


            plugins: {

                legend: {
                    display: false
                },


                tooltip: {

                    backgroundColor: '#152342',

                    titleColor: '#FFFFFF',

                    bodyColor: '#FFFFFF',

                    padding: 12,

                    cornerRadius: 8

                }

            }

        }

    });

}






function localDateString(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

let appointmentRecords = [];
let appointmentDate = 'all';
let activeAppointmentFilter = 'All';

function updateAppointmentsHeading() {
    const dateInput = document.getElementById('appointmentsDate');
    const subtitle = document.getElementById('appointmentsSubtitle');
    if (!subtitle) return;
    const date = dateInput?.value || appointmentDate !== 'all' ? new Date((dateInput?.value || appointmentDate) + 'T12:00:00') : null;
    const label = date ? date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'All dates';
    subtitle.textContent = label + ' · ' + (document.getElementById('profileRoleDisplay')?.textContent || 'Optometrist');
}

function renderAppointmentsTable() {
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;
    const visible = appointmentRecords.filter(function (appointment) {
        return activeAppointmentFilter === 'All' || (appointment.Status || 'Scheduled') === activeAppointmentFilter;
    });
    tbody.replaceChildren();
    visible.forEach(function (appointment) {
        const row = document.createElement('tr');
        const status = appointment.Status || 'Scheduled';
        const badgeClass = status === 'Completed' ? 'badge-completed' : status === 'Cancelled' ? 'badge-cancelled' : status === 'Confirmed' ? 'badge-confirmed' : 'badge-scheduled';
        row.innerHTML = '<td class="cell-strong"></td><td><div class="cust-cell"><div class="mini-avatar"></div></div></td><td></td><td><span class="badge"></span></td><td><div class="row-actions" style="justify-content:flex-end;flex-wrap:wrap"></div></td>';
        row.cells[0].textContent = (appointment.AppointmentTime || '').slice(0, 5);
        row.querySelector('.mini-avatar').textContent = getInitials(appointment.FullName || '');
        row.querySelector('.cust-cell').appendChild(document.createTextNode(appointment.FullName || ''));
        row.cells[2].textContent = appointment.AppointmentType || 'Routine Eye Exam';
        const badge = row.querySelector('.badge');
        badge.className = 'badge ' + badgeClass;
        badge.textContent = status;
        const actions = row.querySelector('.row-actions');
        const addAction = function (label, handler, className) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = className || 'btn btn-sm btn-outline';
            button.textContent = label;
            button.addEventListener('click', handler);
            actions.appendChild(button);
        };
        addAction('Patient history', function () { viewPatientReport(appointment.CustomerID); }, 'icon-action');
        if (status === 'Scheduled') addAction('Confirm', function () { updateAppointmentStatus(appointment.AppointmentID, 'Confirmed'); });
        if (status === 'Confirmed') {
            addAction('Start exam', function () { startAppointmentExam(appointment.CustomerID); }, 'btn btn-sm btn-primary');
            addAction('Complete', function () { updateAppointmentStatus(appointment.AppointmentID, 'Completed'); });
        }
        if (status !== 'Completed') {
            addAction('Reschedule', function () { rescheduleAppointment(appointment.AppointmentID); });
        }
        if (status === 'Scheduled' || status === 'Confirmed') {
            addAction('Cancel', function () { updateAppointmentStatus(appointment.AppointmentID, 'Cancelled'); }, 'btn btn-sm btn-ghost');
        }
        tbody.appendChild(row);
    });
    if (!visible.length) {
        const row = document.createElement('tr');
        const message = document.createElement('td');
        message.colSpan = 5;
        message.className = 'empty-state';
        message.textContent = 'No ' + (activeAppointmentFilter === 'All' ? '' : activeAppointmentFilter.toLowerCase() + ' ') + 'appointments for this date.';
        row.appendChild(message);
        tbody.appendChild(row);
    }
}

function startAppointmentExam(customerId) {
    const select = document.getElementById('examPatientSelect');
    if (select) {
        const nextId = String(customerId);
        if (select.value !== nextId) {
            select.value = nextId;
            select.dispatchEvent(new Event('change'));
        } else {
            selectExamPatient(nextId);
        }
    }
    switchView('exam');
}

async function updateAppointmentStatus(id, status) {
    try {
        await apiRequest('appointments.php', { method: 'PUT', body: JSON.stringify({ id: Number(id), status: status }) });
        await Promise.all([loadAppointments(), loadDashboard()]);
        showToast('Appointment marked ' + status.toLowerCase() + '.', 'success');
    } catch (error) {
        showToast('Could not update appointment: ' + error.message, 'error');
    }
}

function setupFilterPills() {

    document.querySelectorAll('.filter-pills .pill')
        .forEach(function (pill) {

            pill.addEventListener('click', function () {

                const parent =
                    this.closest('.filter-pills');


                if (!parent) {
                    return;
                }


                 
                parent.querySelectorAll('.pill')
                    .forEach(function (item) {

                        item.classList.remove('active');

                    });


                 
                this.classList.add('active');
                if (parent.closest('#view-appointments')) {
                    activeAppointmentFilter = this.textContent.trim();
                    renderAppointmentsTable();
                } else if (parent.closest('#view-prescriptions')) {
                    const filter = this.textContent.trim();
                    document.querySelectorAll('#prescriptionsTableBody tr[data-rx]').forEach(function (row) {
                        row.hidden = filter !== 'All' && row.dataset.status !== filter;
                    });
                }

            });

        });

    const dateInput = document.getElementById('appointmentsDate');
    if (dateInput) {
        dateInput.value = appointmentDate === 'all' ? '' : appointmentDate;
        dateInput.addEventListener('change', function () {
            appointmentDate = this.value || 'all';
            updateAppointmentsHeading();
            loadAppointments();
        });
        updateAppointmentsHeading();
    }
    document.getElementById('appointmentsAllDates')?.addEventListener('click', function () {
        appointmentDate = 'all';
        if (dateInput) dateInput.value = '';
        updateAppointmentsHeading();
        loadAppointments();
    });

}






function openSidebar() {
    document.body.classList.add('sidebar-open');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (backdrop) backdrop.classList.add('show');
}

function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (backdrop) backdrop.classList.remove('show');
}

function setupMobileSidebar() {
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', openSidebar);
    }
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', closeSidebar);
    }
    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }
}






function showToast(message, type, iconClass) {

    type = type || 'info';
    iconClass = iconClass || (
        type === 'success' ? 'fa-solid fa-circle-check' :
        type === 'error' ? 'fa-solid fa-circle-exclamation' :
        'fa-solid fa-circle-info'
    );

    const stack = document.getElementById('toastStack');
    if (!stack) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<i class="' + iconClass + '"></i><span>' + message + '</span>';

    stack.appendChild(toast);

    setTimeout(function () {
        toast.classList.add('hide');
        setTimeout(function () {
            toast.remove();
        }, 220);
    }, 3200);
}






function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('show');
    clearFieldErrors(modal);
    document.body.style.overflow = '';
}

function setupModalDismiss() {
    document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                closeModal(overlay.id);
            }
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.show').forEach(function (overlay) {
                closeModal(overlay.id);
            });
        }
    });
}

function setFieldError(inputEl, hasError) {
    const field = inputEl.closest('.field');
    if (!field) return;
    field.classList.toggle('field-error', !!hasError);
}

function clearFieldErrors(scope) {
    (scope || document).querySelectorAll('.field.field-error').forEach(function (f) {
        f.classList.remove('field-error');
    });
}






function getInitials(name) {
    if (!name) return '--';
    const parts = name.replace(/^Dr\.?\s*/i, '').trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function todayLabel() {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function addYearsToDateLabel(label, years) {
    let base = new Date(label);
    if (isNaN(base.getTime())) {
        base = new Date();
    }
    base.setFullYear(base.getFullYear() + years);
    return base.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

let editingPatientId = null;
let patientRecentOnly = false;
let patientSearchQuery = '';

function openAddPatientModal() {
    const form = document.getElementById('addPatientForm');
    if (form) form.reset();
    editingPatientId = null;
    document.querySelector('#modalAddPatient .modal-head h3').textContent = 'Add Patient';
    document.querySelector('#modalAddPatient .modal-head p').textContent = 'Create a new patient record.';
    document.querySelector('#modalAddPatient .modal-foot .btn-primary').innerHTML = '<i class="fa-solid fa-user-plus"></i> Add Patient';
    clearFieldErrors(document.getElementById('modalAddPatient'));
    openModal('modalAddPatient');
    setTimeout(function () {
        const el = document.getElementById('patientName');
        if (el) el.focus();
    }, 50);
}

function openEditPatientModal(customerId) {
    const customer = (window.examCustomers || []).find(function (row) { return Number(row.CustomerID) === Number(customerId); });
    if (!customer) return showToast('Patient not found.', 'error');
    editingPatientId = Number(customerId);
    document.getElementById('patientName').value = customer.FullName || '';
    document.getElementById('patientAge').value = customer.Age == null ? '' : customer.Age;
    document.getElementById('patientGender').value = customer.Gender || 'Other';
    document.getElementById('patientPhone').value = customer.Phone || '';
    document.getElementById('patientEmail').value = customer.Email || '';
    document.getElementById('patientHistory').value = customer.MedicalHistory || '';
    document.querySelector('#modalAddPatient .modal-head h3').textContent = 'Edit Patient';
    document.querySelector('#modalAddPatient .modal-head p').textContent = 'Update this patient record.';
    document.querySelector('#modalAddPatient .modal-foot .btn-primary').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
    clearFieldErrors(document.getElementById('modalAddPatient'));
    openModal('modalAddPatient');
}

async function submitAddPatient() {
    const nameEl = document.getElementById('patientName');
    const ageEl = document.getElementById('patientAge');
    const genderEl = document.getElementById('patientGender');
    const phoneEl = document.getElementById('patientPhone');
    const emailEl = document.getElementById('patientEmail');
    const historyEl = document.getElementById('patientHistory');

    let valid = true;

    if (!nameEl.value.trim()) {
        setFieldError(nameEl, true);
        valid = false;
    } else {
        setFieldError(nameEl, false);
    }

    if (!ageEl.value || ageEl.value < 0 || ageEl.value > 120) {
        setFieldError(ageEl, true);
        valid = false;
    } else {
        setFieldError(ageEl, false);
    }

    if (!phoneEl.value.trim()) {
        setFieldError(phoneEl, true);
        valid = false;
    } else {
        setFieldError(phoneEl, false);
    }

    if (emailEl.value.trim() && !emailEl.checkValidity()) {
        setFieldError(emailEl, true);
        valid = false;
    } else {
        setFieldError(emailEl, false);
    }

    if (!valid) {
        showToast('Please fill in all required fields.', 'error');
        return;
    }

    const name = nameEl.value.trim();
    const wasEditing = Boolean(editingPatientId);
    try {
        const payload = { name: name, age: Number(ageEl.value), gender: genderEl.value, phone: phoneEl.value.trim(), email: emailEl.value.trim(), history: historyEl.value.trim() };
        await apiRequest('customers.php', {
            method: editingPatientId ? 'PUT' : 'POST',
            body: JSON.stringify(editingPatientId ? Object.assign(payload, { id: editingPatientId }) : payload)
        });
        closeModal('modalAddPatient');
        showToast(wasEditing ? name + ' was updated.' : name + ' was saved to Patients.', 'success');
        editingPatientId = null;
        try { await loadCustomers(); } catch (refreshError) { showToast('Patient saved, but the list could not be refreshed: ' + refreshError.message, 'error'); }
        if (!wasEditing) recordNotification('patient', 'New patient added', name + ' was added to Patients');
    } catch (error) { showToast('Patient was not saved: ' + error.message, 'error'); }
}





let editingAppointmentId = null;

function openAddAppointmentModal() {
    const form = document.getElementById('addAppointmentForm');
    if (form) form.reset();
    editingAppointmentId = null;
    document.querySelector('#modalAddAppointment .modal-head h3').textContent = 'New Appointment';
    document.querySelector('#modalAddAppointment .modal-head p').textContent = 'Schedule a patient for an appointment.';
    document.querySelector('#modalAddAppointment .modal-foot .btn-primary').innerHTML = '<i class="fa-solid fa-plus"></i> Schedule';
    const dateInput = document.getElementById('apptDate');
    if (dateInput) dateInput.value = appointmentDate === 'all' ? localDateString() : appointmentDate;
    clearFieldErrors(document.getElementById('modalAddAppointment'));
    openModal('modalAddAppointment');
    setTimeout(function () {
        const el = document.getElementById('apptPatient');
        if (el) el.focus();
    }, 50);
}

function rescheduleAppointment(id) {
    const appointment = appointmentRecords.find(function (item) { return Number(item.AppointmentID) === Number(id); });
    if (!appointment) return showToast('Appointment not found.', 'error');
    editingAppointmentId = Number(id);
    document.getElementById('apptPatient').value = String(appointment.CustomerID);
    document.getElementById('apptDate').value = String(appointment.AppointmentDate || '').slice(0, 10);
    document.getElementById('apptTime').value = String(appointment.AppointmentTime || '').slice(0, 5);
    document.getElementById('apptType').value = appointment.AppointmentType || 'Routine Eye Exam';
    document.querySelector('#modalAddAppointment .modal-head h3').textContent = 'Reschedule Appointment';
    document.querySelector('#modalAddAppointment .modal-head p').textContent = 'Change the appointment date, time, or type.';
    document.querySelector('#modalAddAppointment .modal-foot .btn-primary').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
    clearFieldErrors(document.getElementById('modalAddAppointment'));
    openModal('modalAddAppointment');
}

async function submitAddAppointment() {
    const patientEl = document.getElementById('apptPatient');
    const dateEl = document.getElementById('apptDate');
    const timeEl = document.getElementById('apptTime');
    const typeEl = document.getElementById('apptType');

    let valid = true;

    if (!patientEl.value) {
        setFieldError(patientEl, true);
        valid = false;
    } else {
        setFieldError(patientEl, false);
    }

    if (!timeEl.value.trim()) {
        setFieldError(timeEl, true);
        valid = false;
    } else {
        setFieldError(timeEl, false);
    }

    if (!dateEl || !dateEl.value) {
        if (dateEl) setFieldError(dateEl, true);
        valid = false;
    } else {
        setFieldError(dateEl, false);
    }

    if (!valid) {
        showToast('Please fill in all required fields.', 'error');
        return;
    }

    const patient = (window.examCustomers || []).find(function (customer) { return String(customer.CustomerID) === patientEl.value; });
    if (!patient) {
        setFieldError(patientEl, true);
        showToast('Choose a patient from the patient list.', 'error');
        return;
    }
    const name = patient.FullName;
    try {
        const existingAppointment = appointmentRecords.find(function (item) { return Number(item.AppointmentID) === Number(editingAppointmentId); });
        const update = { id: editingAppointmentId, time: timeEl.value.trim(), type: typeEl.value, date: dateEl.value };
        if (existingAppointment?.Status === 'Cancelled') update.status = 'Scheduled';
        const request = editingAppointmentId
            ? apiRequest('appointments.php', { method: 'PUT', body: JSON.stringify(update) })
            : apiRequest('appointments.php', { method: 'POST', body: JSON.stringify({ cusid: Number(patientEl.value), time: timeEl.value.trim(), type: typeEl.value, date: dateEl.value }) });
        await request;
        appointmentDate = dateEl.value;
        const datePicker = document.getElementById('appointmentsDate');
        if (datePicker) datePicker.value = appointmentDate;
        const allFilter = document.querySelector('#view-appointments .filter-pills .pill:first-child');
        if (allFilter) allFilter.click();
        updateAppointmentsHeading();
        await Promise.all([loadAppointments(), loadDashboard()]);
        if (!editingAppointmentId) recordNotification('upcoming', 'Appointment scheduled', name + ' · ' + typeEl.value + ' · ' + timeEl.value.trim());
        else recordNotification('upcoming', 'Appointment rescheduled', name + ' · ' + typeEl.value + ' · ' + timeEl.value.trim());
        closeModal('modalAddAppointment');
        showToast(editingAppointmentId ? 'Appointment rescheduled.' : 'Appointment scheduled for ' + name + '.', 'success');
        editingAppointmentId = null;
    } catch (error) { showToast('Appointment was not saved: ' + error.message, 'error'); }
}






const prescriptionsData = {};
let selectedExamPrescriptionId = '';

function badgeClassForStatus(status) {
    if (status === 'Active') return 'badge-completed';
    if (status === 'Expired') return 'badge-cancelled';
    if (status === 'Pending Sign-off') return 'badge-pending';
    return 'badge-scheduled';
}

 
 
const API_BASE = new URL('Api/', document.baseURI).href;

function renderDashboard(data) {
    const kpi = data.kpi || {};
    document.querySelectorAll('[data-kpi]').forEach(function (element) {
        element.textContent = String(kpi[element.dataset.kpi] ?? 0);
    });
    const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const summary = document.getElementById('dashboardSummary');
    if (summary) summary.textContent = 'You have ' + (kpi.appointments || 0) + ' appointments scheduled today, ' + dateLabel + '.';
    const next = document.querySelector('[data-kpi-next]');
    if (next) {
        const time = kpi.next_time ? new Date('1970-01-01T' + kpi.next_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'No upcoming appointments';
        next.textContent = 'Next at ' + time;
    }
    const greeting = document.getElementById('dashboardGreeting');
    if (greeting) {
        const hour = new Date().getHours();
        const period = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        greeting.textContent = period + ', ' + (document.getElementById('profileNameDisplay')?.textContent || 'Optometrist') + '.';
    }
    const summaryValues = {
        profileAppointmentsToday: kpi.appointments,
        profileExamsCompleted: kpi.completed,
        profileRxIssued: kpi.rx_today
    };
    Object.keys(summaryValues).forEach(function (id) {
        const element = document.getElementById(id);
        if (element) element.textContent = String(summaryValues[id] ?? 0);
    });

    Object.keys(examData).forEach(function (range) {
        const chartData = data.charts?.[range];
        examData[range] = chartData && Array.isArray(chartData.labels) && Array.isArray(chartData.data)
            ? chartData
            : { labels: [], data: [] };
    });
    if (examChart) {
        const activeRange = document.querySelector('#examToggle button.active')?.dataset.range || 'daily';
        examChart.data.labels = examData[activeRange].labels;
        examChart.data.datasets[0].data = examData[activeRange].data;
        examChart.update();
    }

    const conditions = Array.isArray(data.conditions) ? data.conditions : [];
    if (conditionChart) {
        conditionChart.data.labels = conditions.map(function (item) { return item.label; });
        conditionChart.data.datasets[0].data = conditions.map(function (item) { return Number(item.count) || 0; });
        conditionChart.update();
    }
    document.querySelectorAll('#view-dashboard .legend-list .legend-item').forEach(function (row, index) {
        const condition = conditions[index];
        if (!condition) {
            row.hidden = true;
            return;
        }
        row.hidden = false;
        row.querySelector('.lbl').textContent = condition.label;
        row.querySelector('.val').textContent = String(condition.pct || 0) + '%';
    });
}

async function loadDashboard() {
    try {
        renderDashboard(await apiRequest('dashboard.php'));
    } catch (error) {
        const summary = document.getElementById('dashboardSummary');
        if (summary) summary.textContent = 'Could not load today’s dashboard: ' + error.message;
    }
}

async function apiRequest(endpoint, options) {
    let response;
    try {
        response = await fetch(API_BASE + endpoint, Object.assign({ credentials: 'same-origin', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } }, options || {}));
    } catch (_) {
        throw new Error('Cannot reach ' + API_BASE + endpoint + '. Check that WAMP Apache and MySQL are running and open the app through localhost.');
    }
    let body;
    try { body = await response.json(); } catch (_) { throw new Error('The API returned a non-JSON response (HTTP ' + response.status + '). Check the PHP endpoint and server logs.'); }
    if (!response.ok) throw new Error(body.error || 'Request failed (' + response.status + ')');
    return body;
}

async function loadNotifications() {
    const list = document.getElementById('notifActivityList');
    try {
        const data = await apiRequest('dashboard.php');
        renderDashboard(data);
        document.querySelectorAll('[data-notif-count]').forEach(function (node) {
            const key = node.dataset.notifCount;
            node.textContent = String((data.notif && data.notif[key]) || 0);
        });
        const events = getSavedNotifications();
        const unreadEvents = events.filter(function (event) { return !event.read; }).length;
        const total = Object.values(data.notif || {}).reduce(function (sum, value) { return sum + Number(value || 0); }, 0) + unreadEvents;
        const badge = document.getElementById('notifBadge');
        if (badge) {
            badge.textContent = String(total);
            badge.classList.toggle('is-hidden', total === 0);
        }
        const bellDot = document.getElementById('topbarBellDot');
        if (bellDot) bellDot.style.display = total ? '' : 'none';
        if (!list) return;
        list.replaceChildren();
        const styles = {
            patient: ['var(--blue-bg)', 'var(--blue)', 'fa-solid fa-user-plus'],
            exam: ['var(--purple-bg)', 'var(--purple)', 'fa-solid fa-glasses'],
            waiting: ['var(--warning-bg)', 'var(--warning)', 'fa-solid fa-chair'],
            upcoming: ['var(--blue-bg)', 'var(--blue)', 'fa-regular fa-calendar-check'],
            rx: ['var(--success-bg)', 'var(--success)', 'fa-solid fa-file-prescription'],
            followup: ['var(--gray-100)', 'var(--ink-soft)', 'fa-solid fa-rotate']
        };
        const feed = events.map(function (event) {
            return Object.assign({}, event, { sub: event.sub + ' · ' + notificationAge(event.createdAt) });
        }).concat(data.activity || []);
        feed.forEach(function (item, index, items) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:14px;padding:14px 4px;' + (index < items.length - 1 ? 'border-bottom:1px solid var(--gray-100);' : '');
            const icon = document.createElement('div');
            icon.className = 'ni';
            const style = styles[item.type] || styles.waiting;
            icon.style.cssText = 'background:' + style[0] + ';color:' + style[1] + ';width:38px;height:38px;flex-shrink:0;';
            const glyph = document.createElement('i'); glyph.className = style[2]; icon.appendChild(glyph);
            const copy = document.createElement('div');
            const title = document.createElement('div'); title.style.cssText = 'font-size:13.5px;font-weight:700;'; title.textContent = item.title || '';
            const sub = document.createElement('div'); sub.className = 'cell-sub'; sub.textContent = item.sub || '';
            copy.append(title, sub); row.append(icon, copy); list.appendChild(row);
        });
        if (!list.children.length) {
            const empty = document.createElement('div'); empty.className = 'cell-sub'; empty.style.padding = '14px 4px'; empty.textContent = 'No recent activity.'; list.appendChild(empty);
        }
    } catch (error) {
        if (list) list.textContent = 'Could not load notifications.';
        console.error('Could not load notifications:', error);
    }
}

const NOTIFICATION_STORAGE_KEY = 'unitedOpticNotifications';

function getSavedNotifications() {
    try {
        const saved = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (_) { return []; }
}

function notificationAge(isoDate) {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hr ago' : ' hrs ago');
    return Math.floor(hours / 24) + ' days ago';
}

function recordNotification(type, title, sub) {
    const events = getSavedNotifications();
    events.unshift({ type: type, title: title, sub: sub, createdAt: new Date().toISOString(), read: false });
    try { localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(events.slice(0, 50))); } catch (_) {   }
    loadNotifications();
}

function normalizePrescription(row) {
    const id = 'RX-' + row.PrescriptionID;
    const rx = { id: String(row.PrescriptionID), customerId: Number(row.CustomerID), prescriptionDate: row.PrescriptionDate || '', patient: row.FullName || '', initials: getInitials(row.FullName || ''), lensType: row.LensType || '', power: row.LensPower || '', expiry: row.ExpiryDate || '', status: row.Status || 'Active', remarks: row.Remarks || '' };
    prescriptionsData[id] = rx;
    return { id: id, rx: rx };
}

async function loadProfile() {
    try {
        const profile = await apiRequest('optomestrist.php');
        if (!profile || !profile.OptomestristID) throw new Error('The optometrist employee profile is incomplete.');
        const name = profile.FullName || '';
        const role = profile.Role || 'Optometrist';
        const room = profile.Room || '';
        const roleLine = room ? role + ' · ' + room : role;
        document.getElementById('profileNameDisplay').textContent = name;
        document.getElementById('profileRoleDisplay').textContent = roleLine;
        document.getElementById('topbarName').textContent = name;
        document.getElementById('topbarRole').textContent = roleLine;
        document.getElementById('profileAvatarBig').textContent = getInitials(name);
        document.getElementById('topbarAvatar').textContent = getInitials(name);
        const hour = new Date().getHours();
        const period = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        document.getElementById('dashboardGreeting').textContent = period + ', ' + name + '.';
    } catch (error) {
        document.getElementById('profileNameDisplay').textContent = 'Profile unavailable';
        showToast('Could not load profile: ' + error.message, 'error');
    }
}

async function loadPrescriptions() {
    const tbody = document.getElementById('prescriptionsTableBody');
    try {
        const rows = await apiRequest('prescriptions.php');
        if (!tbody) return;
        Object.keys(prescriptionsData).forEach(function (key) { delete prescriptionsData[key]; });
        tbody.innerHTML = '';
        rows.forEach(function (row) {
            const item = normalizePrescription(row);
            renderPrescriptionRow(item.id, item.rx, false);
        });
        if (!rows.length) tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No prescriptions found.</td></tr>';
        updateExamPrescriptionCard(document.getElementById('examPatientSelect')?.value);
    } catch (error) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Could not load prescriptions.</td></tr>';
        showToast('Could not load prescriptions: ' + error.message, 'error');
    }
}

async function loadCustomers() {
    try {
        const rows = await apiRequest('customers.php');
        window.examCustomers = rows;
        [['apptPatient', 'Select a patient…'], ['rxPatient', 'Select a patient…']].forEach(function (entry) {
            const select = document.getElementById(entry[0]);
            if (!select) return;
            const selected = select.value;
            select.replaceChildren(new Option(entry[1], ''));
            rows.forEach(function (customer) { select.add(new Option(customer.FullName, customer.CustomerID)); });
            if (rows.some(function (customer) { return String(customer.CustomerID) === selected; })) select.value = selected;
        });
        const reportSelect = document.getElementById('reportPatientSelect');
        if (reportSelect) {
            reportSelect.replaceChildren(new Option('Select a patient…', ''));
            rows.forEach(function (customer) { reportSelect.add(new Option(customer.FullName, customer.CustomerID)); });
            if (!reportSelect.dataset.bound) {
                reportSelect.dataset.bound = 'true';
                reportSelect.addEventListener('change', function () { loadPatientReport(this.value); });
            }
            if (rows.length) {
                reportSelect.value = String(rows[0].CustomerID);
                await loadPatientReport(reportSelect.value);
            } else {
                const timeline = document.getElementById('reportsTimeline');
                if (timeline) timeline.textContent = 'No patient records are available.';
            }
        }
        const patientSelect = document.getElementById('examPatientSelect');
        if (patientSelect) {
            patientSelect.replaceChildren(new Option('Select a patient…', ''));
            rows.forEach(function (customer) { patientSelect.add(new Option(customer.FullName + ' · ' + (customer.Phone || 'No phone'), customer.CustomerID)); });
            if (rows.length) {
                const requested = new URLSearchParams(location.search).get('patient');
                patientSelect.value = requested && rows.some(function (row) { return String(row.CustomerID) === requested; }) ? requested : String(rows[0].CustomerID);
                await selectExamPatient(patientSelect.value);
            }
        }
        const tbody = document.getElementById('patientsTableBody');
        if (!tbody) return;
        tbody.replaceChildren();
        rows.forEach(function (customer) {
            const row = document.createElement('tr');
            row.innerHTML = '<td class="cell-strong"><div class="cust-cell"><div class="mini-avatar"></div></div></td><td></td><td></td><td></td><td></td><td><div class="row-actions" style="justify-content:flex-end"><button class="icon-action history-action" type="button" aria-label="View patient history"><i class="fa-regular fa-eye"></i></button><button class="icon-action edit-action" type="button" aria-label="Edit patient"><i class="fa-regular fa-pen-to-square"></i></button></div></td>';
            row.dataset.patientId = customer.CustomerID;
            row.querySelector('.mini-avatar').textContent = getInitials(customer.FullName || '');
            row.querySelector('.cust-cell').appendChild(document.createTextNode(customer.FullName || ''));
            row.cells[1].textContent = (customer.Age == null ? '—' : customer.Age) + ' · ' + (customer.Gender || '—');
            row.cells[2].textContent = customer.Phone || '—';
            row.cells[3].textContent = customer.Email || '—';
            row.cells[4].textContent = customer.LastVisit || 'New patient';
            row.querySelector('.history-action').addEventListener('click', function () { viewPatientReport(customer.CustomerID); });
            row.querySelector('.edit-action').addEventListener('click', function () { openEditPatientModal(customer.CustomerID); });
            tbody.appendChild(row);
        });
        if (rows.length) {
            updatePatientCard('#view-patients .patient-card-mini', rows[0]);
            setupPatientSearch(rows);
        } else {
            const card = document.querySelector('#view-patients .patient-card-mini');
            if (card) {
                card.querySelector('.av').textContent = '--';
                card.querySelector('.nm').textContent = 'No patients available';
                card.querySelector('.id').textContent = '';
            }
        }
        updateExamPrescriptionCard(document.getElementById('examPatientSelect')?.value);
    } catch (error) {
        const table = document.getElementById('patientsTableBody');
        if (table) table.innerHTML = '<tr><td colspan="6" class="empty-state">Could not load patients.</td></tr>';
        const patientSelect = document.getElementById('examPatientSelect');
        if (patientSelect) patientSelect.replaceChildren(new Option('Could not load patients — retry', ''));
        ['reportPatientSelect', 'apptPatient', 'rxPatient'].forEach(function (id) {
            const select = document.getElementById(id);
            if (select) select.replaceChildren(new Option('Could not load patients', ''));
        });
        showToast('Could not load patients: ' + error.message, 'error');
    }
}

function viewPatientReport(customerId) {
    const reportSelect = document.getElementById('reportPatientSelect');
    if (reportSelect) reportSelect.value = String(customerId);
    switchView('reports');
    loadPatientReport(customerId);
}

let patientReportRequestId = 0;

async function loadPatientReport(customerId) {
    const timeline = document.getElementById('reportsTimeline');
    const customer = (window.examCustomers || []).find(function (row) { return String(row.CustomerID) === String(customerId); });
    if (!timeline) return;
    if (!customerId) {
        timeline.textContent = 'Select a patient to load their history.';
        ['summaryAppointments', 'summaryExams', 'summaryRx', 'summaryCondition'].forEach(function (id) {
            const element = document.getElementById(id);
            if (element) element.textContent = '—';
        });
        return;
    }
    const requestId = ++patientReportRequestId;
    timeline.textContent = 'Loading patient history…';
    try {
        const [examinations, prescriptions, appointments] = await Promise.all([
            apiRequest('examinations.php?customer_id=' + encodeURIComponent(customerId)),
            apiRequest('prescriptions.php?customer_id=' + encodeURIComponent(customerId)),
            apiRequest('appointments.php?customer_id=' + encodeURIComponent(customerId) + '&date=all')
        ]);
        if (requestId !== patientReportRequestId) return;
        const entries = examinations.map(function (row) {
            return {
                date: row.ExaminationDate || '',
                icon: 'fa-glasses',
                title: 'Eye examination',
                detail: 'OD ' + (row.RightEyeSPH ?? '—') + ' / OS ' + (row.LeftEyeSPH ?? '—') + (row.Notes ? ' · ' + row.Notes : '')
            };
        }).concat(prescriptions.map(function (row) {
            return {
                date: row.PrescriptionDate || '',
                icon: 'fa-file-prescription',
                title: 'Prescription RX-' + row.PrescriptionID,
                detail: [row.LensType, row.LensPower, row.Status, row.ExpiryDate ? 'Expires ' + row.ExpiryDate : ''].filter(Boolean).join(' · ')
            };
        })).concat(appointments.map(function (row) {
            return {
                date: row.AppointmentDate || '',
                icon: 'fa-calendar-check',
                title: 'Appointment · ' + (row.AppointmentType || 'Eye care'),
                detail: [row.Status || 'Scheduled', row.AppointmentTime ? new Date('1970-01-01T' + row.AppointmentTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''].filter(Boolean).join(' · ')
            };
        })).sort(function (a, b) { return b.date.localeCompare(a.date); });

        timeline.replaceChildren();
        if (!entries.length) {
            timeline.textContent = 'No appointment, examination, or prescription history for this patient.';
        } else {
            entries.forEach(function (entry) {
                const item = document.createElement('div');
                item.className = 'tl-item';
                const icon = document.createElement('div');
                icon.className = 'tl-dot';
                const glyph = document.createElement('i');
                glyph.className = 'fa-solid ' + entry.icon;
                icon.appendChild(glyph);
                const date = document.createElement('div');
                date.className = 'tl-date';
                date.textContent = entry.date ? new Date(entry.date + 'T12:00:00').toLocaleDateString() : 'Date unavailable';
                const title = document.createElement('div');
                title.className = 'tl-title';
                title.textContent = entry.title;
                const detail = document.createElement('div');
                detail.className = 'tl-desc';
                detail.textContent = entry.detail || 'No additional details recorded.';
                item.append(icon, date, title, detail);
                timeline.appendChild(item);
            });
        }

        const subtitle = document.getElementById('reportsSubtitle');
        if (subtitle) subtitle.textContent = (customer?.FullName || 'Patient') + ' · Examination and prescription history';
        const examCount = document.getElementById('summaryExams');
        const rxCount = document.getElementById('summaryRx');
        const appointmentCount = document.getElementById('summaryAppointments');
        const condition = document.getElementById('summaryCondition');
        if (examCount) examCount.textContent = String(examinations.length);
        if (rxCount) rxCount.textContent = String(prescriptions.length);
        if (appointmentCount) appointmentCount.textContent = String(appointments.length);
        if (condition) condition.textContent = customer?.MedicalHistory || 'None recorded';
    } catch (error) {
        if (requestId !== patientReportRequestId) return;
        timeline.textContent = 'Could not load patient history: ' + error.message;
    }
}

function setupPatientSearch(customers) {
    const search = document.querySelector('#view-patients .table-toolbar .search-box input');
    if (search && !search.dataset.bound) {
        search.dataset.bound = 'true';
        search.addEventListener('input', function () {
            patientSearchQuery = this.value.trim().toLowerCase();
            applyPatientFilters(customers);
        });
    }
    const recent = document.querySelector('#view-patients .filter-pills .pill:last-child');
    if (recent && !recent.dataset.bound) {
        recent.dataset.bound = 'true';
        recent.addEventListener('click', function () {
            const isRecent = this.classList.toggle('active');
            this.previousElementSibling.classList.toggle('active', !isRecent);
            patientRecentOnly = isRecent;
            applyPatientFilters(customers);
        });
    }
}

function applyPatientFilters(customers) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    document.querySelectorAll('#patientsTableBody tr[data-patient-id]').forEach(function (row) {
        const patient = customers.find(function (item) { return String(item.CustomerID) === row.dataset.patientId; });
        const lastVisit = patient?.LastVisit ? new Date(patient.LastVisit + 'T12:00:00') : null;
        const matchesRecent = !patientRecentOnly || Boolean(lastVisit && lastVisit >= cutoff);
        const matchesSearch = !patientSearchQuery || row.textContent.toLowerCase().includes(patientSearchQuery);
        row.hidden = !matchesRecent || !matchesSearch;
    });
}

function updatePatientCard(selector, customer) {
    const card = document.querySelector(selector);
    if (!card) return;
    card.querySelector('.av').textContent = getInitials(customer.FullName || '');
    card.querySelector('.nm').textContent = customer.FullName || 'Patient';
    card.querySelector('.id').textContent = 'Patient ID #' + (customer.CustomerID ?? '');
    const values = { Age: customer.Age == null ? '—' : customer.Age + ' years', Gender: customer.Gender || '—',
        Phone: customer.Phone || '—', Email: customer.Email || '—', 'Last Visit': customer.LastVisit || 'New patient',
        'Medical History': customer.MedicalHistory || '—' };
    card.parentElement.querySelectorAll('.info-line').forEach(function (line) {
        const key = line.querySelector('.k')?.textContent.trim();
        const value = line.querySelector('.v');
        if (value && Object.prototype.hasOwnProperty.call(values, key)) value.textContent = values[key];
    });
}

async function selectExamPatient(customerId) {
    const customer = (window.examCustomers || []).find(function (row) { return String(row.CustomerID) === String(customerId); });
    if (!customer) return;
    const card = document.querySelector('#view-exam .patient-card-mini');
    card.querySelector('.av').textContent = getInitials(customer.FullName || '');
    card.querySelector('.nm').textContent = customer.FullName || 'Patient';
    card.querySelector('.id').textContent = 'Patient ID #' + (customer.CustomerID ?? '');
    const lines = card.parentElement.querySelectorAll('.info-line .v');
    if (lines[0]) lines[0].textContent = customer.Age == null ? '—' : customer.Age + ' years';
    if (lines[1]) lines[1].textContent = customer.Gender || '—';
    if (lines[2]) lines[2].textContent = customer.Phone || '—';
    if (lines[3]) lines[3].textContent = customer.LastVisit || 'New patient';
    resetExamForm();
    updatePatientCard('#view-exam .patient-card-mini', customer);
    await Promise.all([loadPatientExaminations(), updateExamPrescriptionCard(customerId)]);
}

async function updateExamPrescriptionCard(customerId) {
    const matching = Object.entries(prescriptionsData)
        .filter(function (entry) { return String(entry[1].customerId) === String(customerId || ''); })
        .sort(function (a, b) { return b[1].prescriptionDate.localeCompare(a[1].prescriptionDate) || Number(b[1].id) - Number(a[1].id); });
    const latest = matching[0];
    selectedExamPrescriptionId = latest ? latest[0] : '';
    document.getElementById('examRxNum').textContent = latest ? latest[0] : 'No prescription';
    document.getElementById('examRxExp').textContent = latest && latest[1].expiry ? 'Expires ' + latest[1].expiry : '';
    document.getElementById('examRxType').textContent = latest ? latest[1].lensType || '—' : '—';
    document.getElementById('examRxPower').textContent = latest ? latest[1].power || '—' : '—';
    document.getElementById('examRxRemarks').textContent = latest ? latest[1].remarks || '—' : '—';
    const updateButton = document.getElementById('updateExamPrescriptionBtn');
    const printButton = document.getElementById('printExamPrescriptionBtn');
    updateButton.disabled = !latest;
    printButton.disabled = !latest;
    updateButton.onclick = latest ? function () { openPrescriptionModal('edit', selectedExamPrescriptionId); } : null;
    printButton.onclick = latest ? printPrescriptionCard : null;
}

function resetExamForm() {
    ['examOdSph','examOdCyl','examOdAxis','examOsSph','examOsCyl','examOsAxis','examPd','examVa','examIop','examNotes'].forEach(function(id){ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('examDate').value = new Date().toISOString().slice(0,10);
    document.getElementById('examRecordId').value = '';
}

async function loadPatientExaminations() {
    const id = document.getElementById('examPatientSelect')?.value;
    const list = document.getElementById('examHistoryList');
    if (!id || !list) return;
    list.textContent = 'Loading examination history…';
    try {
        const rows = await apiRequest('examinations.php?customer_id=' + encodeURIComponent(id));
        list.replaceChildren();
        if (!rows.length) { list.textContent = 'No previous examinations.'; return; }
        rows.forEach(function(row) {
            const button = document.createElement('button'); button.type='button'; button.className='exam-history-item';
            button.innerHTML='<span></span><small>Load this examination</small>';
            button.querySelector('span').textContent = row.ExaminationDate || 'Undated examination';
            button.addEventListener('click', function(){ fillExamFromRecord(row); }); list.appendChild(button);
        });
    } catch(error) { list.textContent = 'Could not load history: ' + error.message; }
}

function fillExamFromRecord(row) {
    const fields = {examOdSph:row.RightEyeSPH, examOdCyl:row.RightEyeCYL, examOdAxis:row.RightEyeAXIS, examOsSph:row.LeftEyeSPH, examOsCyl:row.LeftEyeCYL, examOsAxis:row.LeftEyeAXIS, examPd:row.PD, examVa:row.VisualAcuity, examIop:row.EyePressure, examNotes:row.Notes};
    Object.keys(fields).forEach(function(id){ const el=document.getElementById(id); if(el) el.value=fields[id] || ''; });
    document.getElementById('examDate').value = (row.ExaminationDate || '').slice(0,10);
    document.getElementById('examRecordId').value = row.ExaminationID || '';
    showToast('Examination loaded. Update it or save a new one.', 'info');
}

async function loadAppointments() {
    const tbody = document.getElementById('appointmentsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Loading appointments…</td></tr>';
    try {
        const rows = await apiRequest('appointments.php?date=' + encodeURIComponent(appointmentDate));
        appointmentRecords = Array.isArray(rows) ? rows : [];
        renderAppointmentsTable();
    } catch (error) {
        appointmentRecords = [];
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Could not load appointments.</td></tr>';
        showToast('Could not load appointments: ' + error.message, 'error');
    }
}

function openPrescriptionModal(mode, rxId) {
    switchView('prescriptions');

    const titleEl = document.getElementById('rxFormTitle');
    const modeEl = document.getElementById('rxFormMode');
    const originalIdEl = document.getElementById('rxFormOriginalId');
    const cancelBtn = document.getElementById('rxFormCancelBtn');

    if (mode === 'edit' && rxId && prescriptionsData[rxId]) {
        const rx = prescriptionsData[rxId];
        titleEl.textContent = 'Edit Prescription — ' + rxId;
        modeEl.value = 'edit';
        originalIdEl.value = rxId;
        document.getElementById('rxPatient').value = String(rx.customerId);
        document.getElementById('rxLensType').value = rx.lensType;
        document.getElementById('rxPower').value = rx.power;
        document.getElementById('rxExpiry').value = rx.expiry;
        document.getElementById('rxRemarks').value = rx.remarks || '';
        cancelBtn.style.display = 'inline-flex';
        showToast('Editing ' + rxId + '. Update the fields and save.', 'info');
    } else {
        resetPrescriptionForm();
        const examPatient = document.getElementById('examPatientSelect')?.value;
        if (examPatient && document.querySelector('#view-exam').classList.contains('active')) {
            document.getElementById('rxPatient').value = examPatient;
        }
    }

    setTimeout(function () {
        const card = document.getElementById('rxFormTitle');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
}

function resetPrescriptionForm() {
    document.getElementById('rxFormTitle').textContent = 'New Prescription';
    document.getElementById('rxFormMode').value = 'create';
    document.getElementById('rxFormOriginalId').value = '';
    document.getElementById('rxPatient').value = '';
    document.getElementById('rxLensType').value = '';
    document.getElementById('rxPower').value = '';
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    document.getElementById('rxExpiry').value = expiry.getFullYear() + '-' + String(expiry.getMonth() + 1).padStart(2, '0') + '-' + String(expiry.getDate()).padStart(2, '0');
    document.getElementById('rxRemarks').value = '';
    document.getElementById('rxFormCancelBtn').style.display = 'none';
    clearFieldErrors(document.getElementById('prescriptionForm'));
}

function readPrescriptionForm() {
    const customer = (window.examCustomers || []).find(function (row) { return String(row.CustomerID) === document.getElementById('rxPatient').value; });
    return {
        customerId: document.getElementById('rxPatient').value,
        patient: customer ? customer.FullName : '',
        lensType: document.getElementById('rxLensType').value.trim(),
        power: document.getElementById('rxPower').value.trim(),
        expiry: document.getElementById('rxExpiry').value.trim(),
        remarks: document.getElementById('rxRemarks').value.trim()
    };
}

function validatePrescriptionForm(data) {
    let valid = true;
    const map = {
        rxPatient: data.patient,
        rxLensType: data.lensType,
        rxPower: data.power,
        rxExpiry: data.expiry
    };
    Object.keys(map).forEach(function (id) {
        const el = document.getElementById(id);
        if (!map[id]) {
            setFieldError(el, true);
            valid = false;
        } else {
            setFieldError(el, false);
        }
    });
    return valid;
}

function renderPrescriptionRow(rxId, rx, isNew) {
    const tbody = document.getElementById('prescriptionsTableBody');
    if (!tbody) return;

    let row = tbody.querySelector('tr[data-rx="' + rxId + '"]');
    const isRenewable = rx.status === 'Expired';
    if (row) {
        row.replaceChildren();
    } else {
        row = document.createElement('tr');
        row.dataset.rx = rxId;
        row.className = isNew ? 'row-new' : '';
    }
    row.dataset.status = rx.status;
    const activeFilter = document.querySelector('#view-prescriptions .filter-pills .pill.active')?.textContent.trim() || 'All';
    row.hidden = activeFilter !== 'All' && activeFilter !== rx.status;

    const idCell = row.insertCell();
    idCell.className = 'cell-strong';
    idCell.textContent = rxId;
    const patientCell = row.insertCell();
    const patientWrap = document.createElement('div');
    patientWrap.className = 'cust-cell';
    const avatar = document.createElement('div');
    avatar.className = 'mini-avatar';
    avatar.textContent = rx.initials;
    patientWrap.append(avatar, document.createTextNode(rx.patient));
    patientCell.appendChild(patientWrap);
    row.insertCell().textContent = rx.lensType;
    row.insertCell().textContent = rx.expiry;
    const statusCell = row.insertCell();
    const badge = document.createElement('span');
    badge.className = 'badge ' + badgeClassForStatus(rx.status);
    badge.textContent = rx.status;
    statusCell.appendChild(badge);
    const actionsCell = row.insertCell();
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.style.justifyContent = 'flex-end';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'icon-action';
    edit.title = 'Edit';
    edit.setAttribute('aria-label', 'Edit ' + rxId);
    edit.innerHTML = '<i class="fa-regular fa-pen-to-square"></i>';
    edit.addEventListener('click', function () { openPrescriptionModal('edit', rxId); });
    actions.appendChild(edit);
    const action = document.createElement('button');
    action.type = 'button';
    action.className = isRenewable ? 'btn btn-sm btn-outline' : 'icon-action';
    if (isRenewable) {
        action.textContent = 'Renew';
        action.addEventListener('click', function () { renewPrescription(rxId); });
    } else {
        action.title = 'Print';
        action.setAttribute('aria-label', 'Print ' + rxId);
        action.innerHTML = '<i class="fa-solid fa-print"></i>';
        action.addEventListener('click', function () { printPrescriptionByRx(rxId); });
    }
    actions.appendChild(action);
    actionsCell.appendChild(actions);
    if (!row.isConnected) tbody.prepend(row);
}

async function savePrescriptionForm() {
    const data = readPrescriptionForm();

    if (!validatePrescriptionForm(data)) {
        showToast('Please fill in all required fields.', 'error');
        return;
    }

    const mode = document.getElementById('rxFormMode').value;
    const originalId = document.getElementById('rxFormOriginalId').value;
    const requestData = { cusid: Number(data.customerId), lens_type: data.lensType, lens_power: data.power, expiry: data.expiry, remarks: data.remarks };
    const examinationId = document.getElementById('examRecordId')?.value;
    if (examinationId && document.getElementById('examPatientSelect')?.value === data.customerId) requestData.eid = Number(examinationId);
    try {
        const saved = mode === 'edit' && originalId
            ? await apiRequest('prescriptions.php', { method: 'PUT', body: JSON.stringify(Object.assign(requestData, { id: parseInt(originalId.replace(/^RX-/, ''), 10) })) })
            : await apiRequest('prescriptions.php', { method: 'POST', body: JSON.stringify(requestData) });
        if (!saved || !saved.PrescriptionID) throw new Error('The API did not confirm a saved prescription.');
        const item = normalizePrescription(saved);
        renderPrescriptionRow(item.id, item.rx, mode !== 'edit');
        recordNotification('rx', mode === 'edit' ? 'Prescription updated' : 'Prescription created', item.rx.patient + ' · ' + item.id);
        showToast('Prescription ' + item.id + ' saved to database.', 'success');
        resetPrescriptionForm();
        await Promise.all([loadPrescriptions(), loadPatientReport(data.customerId), loadDashboard()]);
    } catch (error) {
        console.error('Prescription save failed:', error);
        showToast('Prescription was not saved: ' + error.message, 'error');
    }
}

async function renewPrescription(rxId) {
    const rx = prescriptionsData[rxId];
    if (!rx) return;
    try {
        const saved = await apiRequest('prescriptions.php', { method: 'PUT', body: JSON.stringify({ id: parseInt(rxId.replace(/^RX-/, ''), 10), renew: true }) });
        const item = normalizePrescription(saved);
        renderPrescriptionRow(item.id, item.rx, false);
        recordNotification('rx', 'Prescription renewed', item.rx.patient + ' · ' + item.id);
        showToast(item.id + ' renewed through ' + item.rx.expiry + '.', 'success');
    } catch (error) { showToast('Could not renew prescription: ' + error.message, 'error'); }
}






async function saveExamination(mode) {
    const fields = [
        'examOdSph', 'examOdCyl', 'examOdAxis',
        'examOsSph', 'examOsCyl', 'examOsAxis',
        'examPd', 'examVa', 'examIop', 'examDate'
    ];

    let valid = true;
    fields.forEach(function (id) {
        const el = document.getElementById(id);
        if (el && !el.value.trim()) {
            setFieldError(el, true);
            valid = false;
        } else if (el) {
            setFieldError(el, false);
        }
    });

    if (!valid) {
        showToast('Please complete all examination fields before saving.', 'error');
        return;
    }

    let patientName = '';
    let customerId = '';
    let savedRecord;
    let isUpdate = false;
    try {
        const patientEl = document.querySelector('#view-exam .patient-card-mini .nm');
        patientName = patientEl ? patientEl.textContent.trim() : '';
        customerId = document.getElementById('examPatientSelect').value;
        if (!customerId) throw new Error('Choose a patient first.');
        const payload = { cusid: Number(customerId), edate: document.getElementById('examDate').value, rsph: val('examOdSph').replace(/[°]/g, ''), rcyl: val('examOdCyl').replace(/[°]/g, ''), raxis: val('examOdAxis').replace(/[°]/g, ''), lsph: val('examOsSph').replace(/[°]/g, ''), lcyl: val('examOsCyl').replace(/[°]/g, ''), laxis: val('examOsAxis').replace(/[°]/g, ''), pd: val('examPd'), va: val('examVa'), ep: val('examIop'), note: val('examNotes') };
        const recordId = document.getElementById('examRecordId');
        isUpdate = mode === 'update' && recordId && recordId.value;
        if (isUpdate) {
            payload.id = Number(recordId.value);
            savedRecord = await apiRequest('examinations.php', { method: 'PUT', body: JSON.stringify(payload) });
        } else {
            savedRecord = await apiRequest('examinations.php', { method: 'POST', body: JSON.stringify(payload) });
        }
        if (recordId && savedRecord.ExaminationID) recordId.value = savedRecord.ExaminationID;
    } catch (error) { showToast('Examination was not saved: ' + error.message, 'error'); return; }

    if (isUpdate) {
        recordNotification('exam', 'Eye examination updated', patientName + ' · ' + document.getElementById('examDate').value.trim());
        showToast('Examination updated successfully.', 'success');
    } else {
        recordNotification('exam', 'Eye examination saved', patientName + ' · ' + document.getElementById('examDate').value.trim());
        showToast('Examination saved successfully.', 'success');
    }
    await Promise.all([loadPatientExaminations(), loadPatientReport(customerId), loadDashboard()]);
}






function printDocument(innerHtml) {
    const printArea = document.getElementById('printArea');
    if (!printArea) return;
    printArea.innerHTML = '<div class="print-doc">' + innerHtml + '</div>';
    window.print();
}

window.addEventListener('afterprint', function () {
    const printArea = document.getElementById('printArea');
    if (printArea) printArea.innerHTML = '';
});

function printHeaderHtml(docTitle) {
    return (
        '<div class="p-head">' +
            '<div class="p-brand">LensPoint<span>Optometrist Panel</span></div>' +
            '<div class="p-meta">' + docTitle + '<br>Printed ' + todayLabel() + '</div>' +
        '</div>'
    );
}

function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
}

function printFooter(note) {
    const name = escapeHtml(document.getElementById('profileNameDisplay')?.textContent || 'Optometrist');
    return '<div class="p-foot">' + note + ' ' + name + ' · For clinical use only.</div>';
}

function printExamination() {
    const patientName = document.querySelector('#view-exam .patient-card-mini .nm');
    const patientId = document.querySelector('#view-exam .patient-card-mini .id');
    if (!document.getElementById('examPatientSelect')?.value) {
        showToast('Choose a patient before printing an examination report.', 'error');
        return;
    }

    const html =
        printHeaderHtml('Eye Examination Report') +
        '<h4>Patient</h4>' +
        '<table><tr><td><strong>' + escapeHtml(patientName ? patientName.textContent : 'Patient') + '</strong></td><td>' + escapeHtml(patientId ? patientId.textContent : '') + '</td></tr></table>' +
        '<h4>Refraction — Right Eye (OD)</h4>' +
        '<table><tr><th>SPH</th><th>CYL</th><th>Axis</th></tr>' +
        '<tr><td>' + escapeHtml(val('examOdSph')) + '</td><td>' + escapeHtml(val('examOdCyl')) + '</td><td>' + escapeHtml(val('examOdAxis')) + '</td></tr></table>' +
        '<h4>Refraction — Left Eye (OS)</h4>' +
        '<table><tr><th>SPH</th><th>CYL</th><th>Axis</th></tr>' +
        '<tr><td>' + escapeHtml(val('examOsSph')) + '</td><td>' + escapeHtml(val('examOsCyl')) + '</td><td>' + escapeHtml(val('examOsAxis')) + '</td></tr></table>' +
        '<h4>Assessment</h4>' +
        '<table>' +
        '<tr><td>Pupillary Distance</td><td>' + escapeHtml(val('examPd')) + '</td></tr>' +
        '<tr><td>Visual Acuity</td><td>' + escapeHtml(val('examVa')) + '</td></tr>' +
        '<tr><td>Eye Pressure (IOP)</td><td>' + escapeHtml(val('examIop')) + '</td></tr>' +
        '<tr><td>Exam Date</td><td>' + escapeHtml(val('examDate')) + '</td></tr>' +
        '</table>' +
        '<h4>Doctor Notes</h4>' +
        '<p>' + escapeHtml(val('examNotes') || 'No notes recorded.') + '</p>' +
        printFooter('This report was generated by LensPoint on behalf of');

    printDocument(html);
}

function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function printPrescriptionCard() {
    if (!selectedExamPrescriptionId) {
        showToast('This patient has no prescription to print.', 'error');
        return;
    }
    printPrescriptionByRx(selectedExamPrescriptionId);
}

function textOf(id) {
    const el = document.getElementById(id);
    return el ? el.textContent.trim() : '';
}

function printPrescriptionForm() {
    const data = readPrescriptionForm();
    const rxId = document.getElementById('rxFormOriginalId').value || 'New Prescription';

    const html =
        printHeaderHtml('Lens Prescription') +
        '<h4>Prescription</h4>' +
        '<table>' +
        '<tr><td>Rx Number</td><td>' + escapeHtml(rxId) + '</td></tr>' +
        '<tr><td>Patient</td><td>' + escapeHtml(data.patient || '—') + '</td></tr>' +
        '<tr><td>Lens Type</td><td>' + escapeHtml(data.lensType || '—') + '</td></tr>' +
        '<tr><td>Lens Power</td><td>' + escapeHtml(data.power || '—') + '</td></tr>' +
        '<tr><td>Expiry</td><td>' + escapeHtml(data.expiry || '—') + '</td></tr>' +
        '<tr><td>Remarks</td><td>' + escapeHtml(data.remarks || '—') + '</td></tr>' +
        '</table>' +
        printFooter('Prescribed by');

    printDocument(html);
}

function printPrescriptionByRx(rxId) {
    const rx = prescriptionsData[rxId];
    if (!rx) {
        showToast('Could not find prescription ' + rxId + '.', 'error');
        return;
    }

    const html =
        printHeaderHtml('Lens Prescription') +
        '<h4>Prescription</h4>' +
        '<table>' +
        '<tr><td>Rx Number</td><td>' + escapeHtml(rxId) + '</td></tr>' +
        '<tr><td>Patient</td><td>' + escapeHtml(rx.patient) + '</td></tr>' +
        '<tr><td>Lens Type</td><td>' + escapeHtml(rx.lensType) + '</td></tr>' +
        '<tr><td>Lens Power</td><td>' + escapeHtml(rx.power) + '</td></tr>' +
        '<tr><td>Status</td><td>' + escapeHtml(rx.status) + '</td></tr>' +
        '<tr><td>Expiry</td><td>' + escapeHtml(rx.expiry) + '</td></tr>' +
        '<tr><td>Remarks</td><td>' + escapeHtml(rx.remarks || '—') + '</td></tr>' +
        '</table>' +
        printFooter('Prescribed by');

    printDocument(html);
}

function printFullReport() {
    const customerId = document.getElementById('reportPatientSelect')?.value;
    const customer = (window.examCustomers || []).find(function (row) { return String(row.CustomerID) === String(customerId); });
    if (!customerId || !customer) {
        showToast('Choose a patient before printing their report.', 'error');
        return;
    }
    const timelineItems = Array.from(document.querySelectorAll('#reportsTimeline .tl-item')).map(function (item) {
        const date = item.querySelector('.tl-date') ? item.querySelector('.tl-date').textContent : '';
        const title = item.querySelector('.tl-title') ? item.querySelector('.tl-title').textContent : '';
        const desc = item.querySelector('.tl-desc') ? item.querySelector('.tl-desc').textContent : '';
        return '<tr><td>' + escapeHtml(date) + '</td><td><strong>' + escapeHtml(title) + '</strong><br>' + escapeHtml(desc) + '</td></tr>';
    }).join('');

    const html =
        printHeaderHtml('Medical Report') +
        '<h4>Patient</h4>' +
        '<table><tr><td><strong>' + escapeHtml(customer.FullName) + '</strong></td><td>Patient ID #' + escapeHtml(customer.CustomerID) + '</td></tr></table>' +
        '<h4>Summary</h4>' +
        '<table>' +
        '<tr><td>Appointments</td><td>' + escapeHtml(textOf('summaryAppointments')) + '</td></tr>' +
        '<tr><td>Eye Examinations</td><td>' + escapeHtml(textOf('summaryExams')) + '</td></tr>' +
        '<tr><td>Prescriptions Issued</td><td>' + escapeHtml(textOf('summaryRx')) + '</td></tr>' +
        '</table>' +
        '<h4>Visit Timeline</h4>' +
        '<table>' + timelineItems + '</table>' +
        printFooter('This report was generated by LensPoint on behalf of');

    printDocument(html);
}

function downloadReportPDF() {
    showToast('Opening print dialog — choose "Save as PDF" as the destination.', 'info');
    setTimeout(printFullReport, 400);
}






function openEditProfileModal() {
    document.getElementById('profileNameInput').value = document.getElementById('profileNameDisplay').textContent.trim();
    clearFieldErrors(document.getElementById('modalEditProfile'));
    openModal('modalEditProfile');
}

async function submitEditProfile() {
    const nameEl = document.getElementById('profileNameInput');

    if (!nameEl.value.trim()) {
        setFieldError(nameEl, true);
        showToast('Please enter your name.', 'error');
        return;
    }
    setFieldError(nameEl, false);

    const name = nameEl.value.trim();
    try {
        const response = await fetch('../Admin/Api/profile.php', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        const saved = await response.json();
        if (!response.ok || !saved.profile) throw new Error(saved.error || 'Could not update the shared account name.');
    } catch (error) {
        showToast('Profile was not saved: ' + error.message, 'error');
        return;
    }

    await loadProfile();
    closeModal('modalEditProfile');
    showToast('Profile updated successfully.', 'success');
}

function openChangePasswordModal() {
    const form = document.getElementById('changePasswordForm');
    if (form) form.reset();
    clearFieldErrors(document.getElementById('modalChangePassword'));
    openModal('modalChangePassword');
}

async function submitChangePassword() {
    const currentEl = document.getElementById('pwCurrent');
    const newEl = document.getElementById('pwNew');
    const confirmEl = document.getElementById('pwConfirm');

    let valid = true;

    if (!currentEl.value) {
        setFieldError(currentEl, true);
        valid = false;
    } else {
        setFieldError(currentEl, false);
    }

    if (!newEl.value || newEl.value.length < 8) {
        setFieldError(newEl, true);
        valid = false;
    } else {
        setFieldError(newEl, false);
    }

    if (!confirmEl.value || confirmEl.value !== newEl.value) {
        setFieldError(confirmEl, true);
        valid = false;
    } else {
        setFieldError(confirmEl, false);
    }

    if (!valid) {
        showToast('Please check the highlighted fields.', 'error');
        return;
    }

    try {
        const shared = await fetch('../Admin/Api/profile.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ action: 'password', current: currentEl.value, new: newEl.value }) }).then(function (response) { return response.json(); });
        if (!shared.success) throw new Error(shared.error || 'Could not update the shared account password.');
        closeModal('modalChangePassword');
        showToast('Password updated successfully.', 'success');
    } catch (error) {
        showToast('Password was not saved: ' + error.message, 'error');
    }
}






function markAllRead() {
    const events = getSavedNotifications().map(function (event) { return Object.assign({}, event, { read: true }); });
    try { localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(events)); } catch (_) {   }
    const navBadge = document.getElementById('notifBadge');
    const bellDot = document.getElementById('topbarBellDot');
    if (navBadge) navBadge.classList.add('is-hidden');
    if (bellDot) bellDot.style.display = 'none';
    showToast('All notifications marked as read.', 'success');
}






document.addEventListener('DOMContentLoaded', function () {

    const patientSelect = document.getElementById('examPatientSelect');
    if (patientSelect) patientSelect.addEventListener('change', function () { selectExamPatient(this.value); });
    window.addEventListener('resize', function () {
        if (examChart) examChart.update();
        if (conditionChart) conditionChart.update();
    });
    const examDate = document.getElementById('examDate');
    if (examDate) examDate.value = new Date().toISOString().slice(0, 10);

     
    createExamChart();


     
    createConditionChart();


     
    setupExamToggle();


     
    setupFilterPills();


     
    setupMobileSidebar();

    loadCustomers();
    loadAppointments();
    loadNotifications();
    loadProfile();

     
    loadPrescriptions();


     
    setupModalDismiss();


     
    const activeView =
        document.querySelector('.view.active');


    if (!activeView) {

        switchView('dashboard');

    }

});






const mainSearch =
    document.querySelector(
        '.topbar .search-box input'
    );


if (mainSearch) {

    mainSearch.addEventListener('input', function () {

        const searchValue =
            this.value.toLowerCase().trim();


         
        document.querySelectorAll(
            '.data-table tbody tr'
        ).forEach(function (row) {

            const rowText =
                row.textContent.toLowerCase();


            if (
                searchValue === '' ||
                rowText.includes(searchValue)
            ) {

                row.style.display = '';

            } else {

                row.style.display = 'none';

            }

        });

    });

}
