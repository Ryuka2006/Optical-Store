(() => {
    const goToSection = target => {
        const item = document.querySelector(`.nav-item[data-target="${target}"]`);
        if (item) item.click();
        else document.getElementById(`sec-${target}`)?.classList.add('active');
        document.body.classList.remove('nav-open');
    };
    const bindSection = (id, target) => document.getElementById(id)?.addEventListener('click', () => goToSection(target));

    bindSection('openCalendarBtn', 'appointments');
    bindSection('openMessagesBtn', 'notifications');
    bindSection('openNotificationsBtn', 'notifications');
    bindSection('openProfileBtn', 'profile');
    bindSection('dashboardQuickSaleBtn', 'sales');
    bindSection('dashboardNewAppointmentBtn', 'appointments');
    bindSection('employeeScheduleBtn', 'appointments');
    document.getElementById('dashboardQuickSaleBtn')?.addEventListener('click', () => window.openSaleEditor?.());
    document.getElementById('dashboardNewAppointmentBtn')?.addEventListener('click', () => document.getElementById('newAppointmentBtn')?.click());
    document.querySelectorAll('[data-nav-target]').forEach(link => link.addEventListener('click', event => {
        event.preventDefault(); goToSection(link.dataset.navTarget);
    }));

    const clock = document.querySelector('.datetime');
    if (clock) {
        const updateClock = () => {
            const date = new Intl.DateTimeFormat(undefined, { timeZone: 'Asia/Phnom_Penh', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
            const time = new Intl.DateTimeFormat(undefined, { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit' }).format(new Date());
            clock.innerHTML = `<b>${escapeHtml(date)}</b><br>${escapeHtml(time)} (+07:00)`;
        };
        updateClock(); setInterval(updateClock, 30000);
    }
    apiGet('profile').then(({ profile }) => {
        const name = profile?.FullName || profile?.Username || '';
        const role = profile?.Role || '';
        document.querySelector('.profile-chip .pname')?.replaceChildren(document.createTextNode(name));
        document.querySelector('.profile-chip .prole')?.replaceChildren(document.createTextNode(role));
        const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase() || '').join('');
        document.querySelector('.profile-chip .avatar')?.replaceChildren(document.createTextNode(initials || 'U'));
        document.querySelector('#sec-dashboard .page-title')?.replaceChildren(document.createTextNode(`Welcome, ${name || 'Administrator'}`));
    }).catch(() => {});

    
    const settingControls = {
        store_name: 'settingsStoreName', store_address: 'settingsAddress', support_email: 'settingsEmail',
        store_phone: 'settingsPhone', vat_rate: 'settingsVatRate', hours_weekday: 'settingsWeekdayHours',
        hours_saturday: 'settingsSaturdayHours', hours_sunday: 'settingsSundayHours'
    };
    const switchControls = { tax_inclusive: 'settingsTaxInclusive', auto_apply_tax: 'settingsAutoApplyTax' };
    const setSwitch = (element, active) => {
        if (!element) return;
        element.classList.toggle('on', Boolean(active));
        element.classList.toggle('off', !active);
        element.setAttribute('aria-checked', active ? 'true' : 'false');
    };
    Object.values(switchControls).forEach(id => {
        const element = document.getElementById(id);
        element?.addEventListener('click', () => setSwitch(element, element.getAttribute('aria-checked') !== 'true'));
        element?.addEventListener('keydown', event => {
            if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); element.click(); }
        });
    });
    apiGet('settings').then(({ settings = {} }) => {
        Object.entries(settingControls).forEach(([key, id]) => {
            const element = document.getElementById(id);
            if (element && settings[key] != null) element.value = settings[key];
        });
        Object.entries(switchControls).forEach(([key, id]) => setSwitch(document.getElementById(id), settings[key] === '1'));
    }).catch(error => toast(`Settings could not be loaded: ${error.message}`, 'error'));
    document.getElementById('saveSettingsBtn')?.addEventListener('click', async event => {
        const button = event.currentTarget; button.disabled = true;
        try {
            const settings = {};
            Object.entries(settingControls).forEach(([key, id]) => { settings[key] = document.getElementById(id)?.value.trim() || ''; });
            Object.entries(switchControls).forEach(([key, id]) => { settings[key] = document.getElementById(id)?.getAttribute('aria-checked') === 'true' ? '1' : '0'; });
            await apiPut('settings', { settings });
            toast('Settings saved to the database.');
        } catch (error) { toast(error.message, 'error'); }
        finally { button.disabled = false; }
    });

    
    document.getElementById('customerHistoryBtn')?.addEventListener('click', async () => {
        try {
            const customers = await apiGet('customer');
            if (!Array.isArray(customers) || !customers.length) { toast('Add a customer before viewing history.', 'error'); return; }
            const overlay = openModal('Customer History', `<label class="uo-field"><span>Customer</span><select id="historyCustomerSelect">${customers.map(c => `<option value="${escapeHtml(c.CustomerID)}">${escapeHtml(c.FullName)} (CUS-${escapeHtml(c.CustomerID)})</option>`).join('')}</select></label><div id="customerHistoryResults" class="empty-message">Choose a customer to load their history.</div>` , { wide: true });
            const select = overlay.querySelector('#historyCustomerSelect');
            const renderHistory = async () => {
                const target = overlay.querySelector('#customerHistoryResults');
                target.textContent = 'Loading customer history…';
                const groups = [
                    ['Appointments', 'appointment', row => row.AppointmentDate, row => `${row.Status} with ${row.OptometristName || 'staff'}`],
                    ['Eye examinations', 'examination', row => row.ExamDate, row => row.ResultSummary || row.Notes || row.VisualAcuity || 'Examination recorded'],
                    ['Prescriptions', 'prescriptions', row => row.PrescriptionDate, row => `Expires ${row.ExpiryDate || 'not set'}`],
                    ['Sales', 'sale', row => row.OrderDate, row => `Total ${fmtMoney(row.TotalAmount)}`]
                ];
                const results = await Promise.allSettled(groups.map(([, resource]) => apiGet(resource)));
                const parts = groups.map(([title], index) => {
                    const result = results[index];
                    if (result.status !== 'fulfilled') return `<h4>${title}</h4><p>${escapeHtml(result.reason.message)}</p>`;
                    const rows = (Array.isArray(result.value) ? result.value : []).filter(row => String(row.CustomerID) === select.value);
                    return `<h4>${title} (${rows.length})</h4>${rows.length ? `<ul>${rows.map(row => `<li>${escapeHtml(groups[index][2](row) || '')} — ${escapeHtml(groups[index][3](row) || '')}</li>`).join('')}</ul>` : '<p>No records</p>'}`;
                });
                target.innerHTML = parts.join('');
            };
            select.addEventListener('change', renderHistory);
            renderHistory();
        } catch (error) { toast(`Could not open customer history: ${error.message}`, 'error'); }
    });

    document.getElementById('assignOptometristBtn')?.addEventListener('click', async () => {
        try {
            const [appointments, employees] = await Promise.all([apiGet('appointment'), apiGet('employees')]);
            const pending = (appointments || []).filter(row => ['Scheduled', 'Confirmed'].includes(row.Status));
            const staff = (employees || []).filter(row => /optometrist|optician/i.test(row.RoleName || ''));
            if (!pending.length) { toast('There are no scheduled appointments to assign.', 'error'); return; }
            if (!staff.length) { toast('No optometrists are available. Add an employee with the Optometrist role.', 'error'); return; }
            await openFormModal({ title: 'Assign Optometrist', submitLabel: 'Assign', fields: [
                { name: 'AppointmentID', label: 'Appointment', type: 'select', required: true, options: pending.map(row => ({ value: row.AppointmentID, label: `${row.AppointmentDate} ${String(row.AppointmentTime).slice(0, 5)} — ${row.CustomerName}` })) },
                { name: 'OptometristID', label: 'Optometrist', type: 'select', required: true, options: staff.map(row => ({ value: row.EmployeeID, label: row.FullName })) }
            ], onSubmit: async data => {
                const row = pending.find(item => String(item.AppointmentID) === String(data.AppointmentID));
                if (!row) throw new Error('Appointment no longer exists.');
                await apiPut('appointment', { id: row.AppointmentID, cusid: row.CustomerID, optoid: data.OptometristID, date: row.AppointmentDate, time: String(row.AppointmentTime).slice(0, 5), status: row.Status });
                toast('Optometrist assigned.'); await loadAppointments();
            } });
        } catch (error) { toast(`Could not assign optometrist: ${error.message}`, 'error'); }
    });

    document.getElementById('assignRolesBtn')?.addEventListener('click', async () => {
        try {
            const [users, roles] = await Promise.all([apiGet('users'), apiGet('role')]);
            if (!users?.length || !roles?.length) { toast('Create at least one user and one role first.', 'error'); return; }
            await openFormModal({ title: 'Assign User Role', submitLabel: 'Save Role', fields: [
                { name: 'UserID', label: 'User account', type: 'select', required: true, options: users.map(row => ({ value: row.UserID, label: `${row.Username} — ${row.EmployeeName || 'Unassigned'}` })) },
                { name: 'RoleID', label: 'Role', type: 'select', required: true, options: roles.map(row => ({ value: row.RoleID, label: row.RoleName })) }
            ], onSubmit: async data => {
                const user = users.find(row => String(row.UserID) === String(data.UserID));
                const payload = user.AccountMode === 'direct'
                    ? { UserID: user.UserID, FullName: user.EmployeeName, Email: user.EmployeeEmail, Role: roles.find(role => String(role.RoleID) === String(data.RoleID))?.RoleName, Username: user.Username, Status: user.Status }
                    : { UserID: user.UserID, EmployeeID: user.EmployeeID, RoleID: data.RoleID, Username: user.Username, Status: user.Status };
                await apiPut('user', payload);
                toast(`Role updated for ${user.Username}.`); window.loadUsers?.();
            } });
        } catch (error) { toast(`Could not assign role: ${error.message}`, 'error'); }
    });

    
    document.getElementById('employeeSalaryBtn')?.addEventListener('click', async () => {
        try {
            const employees = await apiGet('employees');
            const total = (employees || []).reduce((sum, row) => sum + Number(row.Salary || 0), 0);
            const rows = (employees || []).map(row => `<tr><td>${escapeHtml(row.FullName)}</td><td>${escapeHtml(row.RoleName || '—')}</td><td>${escapeHtml(fmtMoney(row.Salary || 0))}</td></tr>`).join('');
            openModal('Salary Management', `<p>Recorded monthly payroll total: <strong>${escapeHtml(fmtMoney(total))}</strong></p><table class="uo-table"><thead><tr><th>Employee</th><th>Position</th><th>Salary</th></tr></thead><tbody>${rows || '<tr><td colspan="3">No employee records found.</td></tr>'}</tbody></table>`, { wide: true });
        } catch (error) { toast(`Could not load salary information: ${error.message}`, 'error'); }
    });
    document.getElementById('employeeScheduleBtn')?.addEventListener('click', async () => {
        try {
            const [employees, appointments] = await Promise.all([apiGet('employees'), apiGet('appointment')]);
            const staff = employees || [];
            if (!staff.length) { toast('Add an employee before viewing a work schedule.', 'error'); return; }
            const overlay = openModal('Work Schedule', `<label class="uo-field"><span>Employee</span><select id="scheduleEmployeeSelect">${staff.map(row => `<option value="${escapeHtml(row.EmployeeID)}">${escapeHtml(row.FullName)}</option>`).join('')}</select></label><div id="scheduleResults"></div>`, { wide: true });
            const select = overlay.querySelector('#scheduleEmployeeSelect');
            const renderSchedule = () => {
                const rows = (appointments || []).filter(row => String(row.OptometristID) === select.value && ['Scheduled','Confirmed'].includes(row.Status)).sort((a,b) => String(a.AppointmentDate).localeCompare(String(b.AppointmentDate)) || String(a.AppointmentTime).localeCompare(String(b.AppointmentTime)));
                overlay.querySelector('#scheduleResults').innerHTML = rows.length
                    ? `<table class="uo-table"><thead><tr><th>Date</th><th>Time</th><th>Customer</th><th>Status</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.AppointmentDate)}</td><td>${escapeHtml(String(row.AppointmentTime).slice(0,5))}</td><td>${escapeHtml(row.CustomerName || '')}</td><td>${escapeHtml(row.Status)}</td></tr>`).join('')}</tbody></table>`
                    : '<p class="empty-message">No scheduled or confirmed appointments for this employee.</p>';
            };
            select.addEventListener('change', renderSchedule); renderSchedule();
        } catch (error) { toast(`Could not load work schedule: ${error.message}`, 'error'); }
    });

    
    const search = document.getElementById('globalSearch');
    const searchResources = [
        { resource: 'customer', section: 'customers', field: 'customerSearch', label: row => `CUS-${row.CustomerID} · ${row.FullName}`, keys: ['CustomerID','FullName','Phone','Email'] },
        { resource: 'employees', section: 'employees', field: 'employeeSearch', label: row => `EMP-${row.EmployeeID} · ${row.FullName}`, keys: ['EmployeeID','FullName','RoleName','Email'] },
        { resource: 'products', section: 'products', field: 'productSearch', label: row => `${row.ProductName} · ${row.SKU || ''}`, keys: ['ProductID','ProductName','SKU','ProductType'] },
        { resource: 'sale', section: 'sales', field: 'salesSearch', label: row => `INV-${row.OrderID} · ${row.CustomerName || 'Walk-in'}`, keys: ['OrderID','CustomerName','SalesStaffName'] },
        { resource: 'prescriptions', section: 'prescriptions', field: 'prescriptionSearch', label: row => `RX-${row.PrescriptionID} · ${row.CustomerName || ''}`, keys: ['PrescriptionID','CustomerName'] }
    ];
    search?.addEventListener('keydown', async event => {
        if (event.key !== 'Enter') return;
        const query = search.value.trim().toLowerCase();
        if (!query) return;
        search.disabled = true;
        try {
            const responses = await Promise.allSettled(searchResources.map(config => apiGet(config.resource)));
            const matches = responses.flatMap((result, index) => {
                if (result.status !== 'fulfilled') return [];
                const config = searchResources[index];
                return (Array.isArray(result.value) ? result.value : []).filter(row => config.keys.some(key => String(row[key] ?? '').toLowerCase().includes(query))).slice(0, 8).map(row => ({ config, row }));
            });
            if (!matches.length && responses.every(result => result.status === 'rejected')) throw new Error('Search services could not be reached.');
            const html = matches.length ? `<ul>${matches.map((match, index) => `<li><button type="button" class="btn btn-outline btn-sm" data-global-result="${index}">${escapeHtml(match.config.label(match.row))}</button></li>`).join('')}</ul>` : '<p>No matching records found.</p>';
            const overlay = openModal('Search Results', html, { wide: true });
            overlay.querySelectorAll('[data-global-result]').forEach(button => button.addEventListener('click', () => {
                const match = matches[Number(button.dataset.globalResult)]; closeModal(); goToSection(match.config.section);
                const input = document.getElementById(match.config.field);
                if (input) { input.value = query; input.dispatchEvent(new Event('input', { bubbles: true })); }
            }));
        } catch (error) { toast(`Search failed: ${error.message}`, 'error'); }
        finally { search.disabled = false; }
    });
})();
