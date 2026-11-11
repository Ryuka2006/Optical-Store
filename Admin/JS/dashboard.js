async function loadDashboard() {
    try {
        const data = await apiGet('dashboard');
        for (const [key, value] of Object.entries(data)) {
            const el = document.getElementById(key);
            if (el && !Array.isArray(value) && typeof value !== 'object') el.textContent = Number(value || 0).toLocaleString();
        }
        window.setDashboardSalesData?.(data.salesSeries);
    } catch (error) { console.error('Failed to load dashboard:', error); }

    const dateKey = date => {
        const value = new Date(date);
        if (Number.isNaN(value.getTime())) return String(date || '');
        return value.toISOString().slice(0, 10);
    };
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(new Date());
    const [alertsResult, appointmentsResult, salesResult, stockResult] = await Promise.allSettled([
        apiGet('notifications'), apiGet('appointment'), apiGet('sale'), apiGet('inventory')
    ]);
    const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value.notifications || [] : [];
    const alertsBox = document.getElementById('alertList');
    if (alertsBox) alertsBox.innerHTML = alerts.length
        ? alerts.slice(0, 5).map(item => `<div class="uo-note ${item.read ? 'read' : 'unread'}"><div class="alert-text"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.message)}</span></div></div>`).join('')
        : '<div class="empty-message">No current alerts.</div>';

    const appointments = appointmentsResult.status === 'fulfilled' && Array.isArray(appointmentsResult.value) ? appointmentsResult.value : [];
    const todayBox = document.getElementById('todayAppointments');
    const todayRows = appointments.filter(row => dateKey(row.AppointmentDate) === today && row.Status !== 'Cancelled').sort((a, b) => String(a.AppointmentTime).localeCompare(String(b.AppointmentTime)));
    if (todayBox) todayBox.innerHTML = todayRows.length
        ? todayRows.slice(0, 6).map(row => `<div class="uo-note"><div class="alert-text"><b>${escapeHtml(String(row.AppointmentTime).slice(0, 5))} · ${escapeHtml(row.CustomerName || 'Customer')}</b><span>${escapeHtml(row.Status)} with ${escapeHtml(row.OptometristName || 'staff')}</span></div></div>`).join('')
        : '<div class="empty-message">No appointments today.</div>';

    const sales = salesResult.status === 'fulfilled' && Array.isArray(salesResult.value) ? salesResult.value : [];
    const movements = stockResult.status === 'fulfilled' && Array.isArray(stockResult.value) ? stockResult.value : [];
    const activity = [
        ...sales.map(row => ({ date: row.OrderDate, label: `Sale INV-${row.OrderID} completed`, detail: `${row.CustomerName || 'Walk-in customer'} · ${fmtMoney(row.TotalAmount)}` })),
        ...movements.map(row => ({ date: row.TransactionDate, label: `${row.TransactionType} · ${row.ProductName}`, detail: `Quantity ${row.Qty} · ${row.EmployeeName || 'Staff'}` }))
    ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
    const activityBox = document.getElementById('activityList');
    if (activityBox) activityBox.innerHTML = activity.length
        ? activity.map(row => `<div class="uo-note"><div class="alert-text"><b>${escapeHtml(row.label)}</b><span>${escapeHtml(row.detail)} · ${escapeHtml(row.date)}</span></div></div>`).join('')
        : '<div class="empty-message">No recent activity.</div>';
}
document.addEventListener('DOMContentLoaded', loadDashboard);
