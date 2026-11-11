(() => {
    const profileFields = {
        name: document.getElementById('profileFullName'),
        email: document.getElementById('profileEmail'),
        phone: document.getElementById('profilePhone'),
        role: document.getElementById('profileRole'),
        username: document.getElementById('profileUsername')
    };

    async function loadProfile() {
        try {
            const result = await apiGet('profile');
            const profile = result.profile || {};
            if (profileFields.name) profileFields.name.textContent = profile.FullName || profile.Username || '—';
            if (profileFields.email) profileFields.email.textContent = profile.Email || '—';
            if (profileFields.phone) profileFields.phone.textContent = profile.Phone || '—';
            if (profileFields.role) profileFields.role.textContent = profile.Role || '—';
            if (profileFields.username) profileFields.username.textContent = profile.Username || '-';
            const topName = profile.FullName || profile.Username || '';
            document.querySelector('.profile-chip .pname')?.replaceChildren(document.createTextNode(topName));
            document.querySelector('.profile-chip .prole')?.replaceChildren(document.createTextNode(profile.Role || ''));
            const initials = topName.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase() || '').join('');
            document.querySelector('.profile-chip .avatar')?.replaceChildren(document.createTextNode(initials || 'U'));
            document.getElementById('profileAvatar')?.replaceChildren(document.createTextNode(initials || 'U'));
            const subtitle = document.getElementById('profileSubtitle');
            if (subtitle) subtitle.textContent = profile.Role || 'Account profile';
        } catch (error) {
            if (profileFields.name) profileFields.name.textContent = 'Could not load profile';
            toast(error.message, 'error');
        }
    }

    document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
        try {
            const result = await apiGet('profile');
            const profile = result.profile || {};
            if (!profile.CanEditName) { toast('This account is not linked to an editable employee profile.', 'error'); return; }
            await openFormModal({
                title: 'Edit Profile',
                fields: [
                    { name: 'fullName', label: 'Full name', required: true },
                    { name: 'email', label: 'Email', type: 'email', value: profile.Email || '' },
                    ...(profile.CanEditPhone ? [{ name: 'phone', label: 'Phone', value: profile.Phone || '' }] : [])
                ],
                values: { fullName: profile.FullName || '', email: profile.Email || '', phone: profile.Phone || '' },
                submitLabel: 'Save Changes',
                onSubmit: async data => {
                    await apiPut('profile', data);
                    closeModal();
                    await loadProfile();
                    toast('Profile updated.');
                }
            });
        } catch (error) { toast(error.message, 'error'); }
    });

    document.getElementById('changePasswordBtn')?.addEventListener('click', () => openFormModal({
        title: 'Change Password',
        fields: [
            { name: 'currentPassword', label: 'Current Password', type: 'password', required: true },
            { name: 'newPassword', label: 'New Password', type: 'password', required: true, placeholder: 'At least 10 characters, with a letter and number' },
            { name: 'confirmPassword', label: 'Confirm New Password', type: 'password', required: true }
        ],
        submitLabel: 'Update Password',
        onSubmit: async data => {
            if (data.newPassword !== data.confirmPassword) throw new Error('The new passwords do not match.');
            await apiPut('profile', { action: 'password', currentPassword: data.currentPassword, newPassword: data.newPassword });
            closeModal();
            toast('Password updated.');
        }
    }));

    const backupLabel = document.getElementById('lastBackupLabel');
    const previousBackup = localStorage.getItem('practiceBackupDownloadedAt');
    if (backupLabel && previousBackup) backupLabel.textContent = new Date(previousBackup).toLocaleString();
    document.getElementById('backupNowBtn')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const response = await fetch(new URL('backup.php', API_BASE), { credentials: 'same-origin', headers: { Accept: 'application/json' } });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `practice-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            const downloadedAt = new Date().toISOString();
            localStorage.setItem('practiceBackupDownloadedAt', downloadedAt);
            if (backupLabel) backupLabel.textContent = new Date(downloadedAt).toLocaleString();
            toast('Database backup downloaded.');
        } catch (error) { toast(error.message || 'Could not download backup.', 'error'); }
        finally { button.disabled = false; }
    });

    const list = document.getElementById('notificationList');
    let notifications = [];
    function renderNotifications() {
        if (!list) return;
        if (!notifications.length) {
            list.innerHTML = '<div class="empty-message">You’re all caught up. No current notifications.</div>';
            return;
        }
        list.innerHTML = notifications.map(item => `
            <article style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 20px;border-bottom:1px solid var(--border,#e8edf3);${item.read ? 'opacity:.65;' : ''}">
                <div><strong>${escapeHtml(item.title)}</strong><div style="margin-top:5px;color:var(--text-mute);font-size:13px">${escapeHtml(item.message)}</div></div>
                <div style="display:flex;align-items:center;gap:12px;white-space:nowrap"><small>${escapeHtml(item.createdAt || '')}</small>${item.read ? '<span>Read</span>' : `<button class="btn btn-outline btn-sm" data-notification-read="${escapeHtml(item.id)}">Mark read</button>`}</div>
            </article>`).join('');
    }
    async function loadNotifications() {
        if (!list) return;
        try {
            const result = await apiGet('notifications');
            notifications = result.notifications || [];
            renderNotifications();
        } catch (error) {
            list.innerHTML = `<div class="empty-message">${escapeHtml(error.message)}</div>`;
        }
    }
    list?.addEventListener('click', async event => {
        const button = event.target.closest('[data-notification-read]');
        if (!button) return;
        button.disabled = true;
        try { await apiPut('notifications', { id: button.dataset.notificationRead }); await loadNotifications(); }
        catch (error) { button.disabled = false; toast(error.message, 'error'); }
    });
    document.getElementById('markAllNotificationsRead')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try { await apiPut('notifications', { all: true }); await loadNotifications(); toast('Notifications marked as read.'); }
        catch (error) { toast(error.message, 'error'); }
        finally { button.disabled = false; }
    });

    loadProfile();
    loadNotifications();
})();
