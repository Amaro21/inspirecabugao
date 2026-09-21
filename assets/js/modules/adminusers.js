// admin-users.js — Super Admin only: account management (create/
// activate/deactivate/delete Admin accounts) and the System Activity Log
// viewer (the audit trail every action in the system writes to).

// ===================== USERS (Super Admin only) =====================
function loadUsers() {
  const table = qs('#usersTable');
  if (!table) return;
  table.innerHTML = '<div class="loading-state">Loading...</div>';
  const me = currentUser();
  api('users').then(users=>{
    if (!users.length) { table.innerHTML = '<div class="hint">No accounts found.</div>'; return; }
    table.innerHTML = `<table><thead><tr><th>Name</th><th>Username</th><th>Gmail</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${users.map(u=>{
        const isSelf = me && me.id === u.id;
        const roleLabel = u.role === 'super_admin'
          ? '<span class="badge">Super Admin</span>'
          : '<span class="badge">Admin</span>';
        const statusBadge = u.is_active
          ? '<span class="badge">Active</span>'
          : '<span class="badge">Inactive</span>';
        const toggleBtn = isSelf
          ? '<span class="hint" style="font-size:.72rem">This is you</span>'
          : `<button class="btn-${u.is_active?'del':'edit'}" onclick="toggleUser(${u.id},${u.is_active?0:1})">${u.is_active?'Deactivate':'Activate'}</button>
             <button class="btn-del" style="margin-left:6px" onclick="deleteUserAccount(${u.id},'${escH(u.full_name).replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg> Delete</button>`;
        return `<tr>
          <td>${escH(u.full_name)}</td>
          <td>${escH(u.username)}</td>
          <td>${escH(u.email || '—')}</td>
          <td>${roleLabel}</td>
          <td>${statusBadge}</td>
          <td>${toggleBtn}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  });
}

// ===================== ACTIVITY LOG (Super Admin only) =====================
function activityActionMeta(action) {
  const map = {
    login:               { label: 'Logged In',          color: '#2d5fa6' },
    logout:               { label: 'Logged Out',         color: '#777' },
    update_profile:        { label: 'Updated Profile',    color: '#2d5fa6' },
    change_password:       { label: 'Changed Password',   color: '#b06010' },
    forgot_password_request: { label: 'Requested Reset',  color: '#b06010' },
    reset_password_confirm:  { label: 'Reset Password',   color: '#b06010' },
    purok_add:             { label: 'Added Purok',        color: '#2563eb' },
    purok_delete:          { label: 'Deleted Purok',      color: '#c0392b' },
    street_add:            { label: 'Added Street',       color: '#2563eb' },
    street_delete:         { label: 'Deleted Street',     color: '#c0392b' },
    house_add:             { label: 'Added House',        color: '#2563eb' },
    house_edit:            { label: 'Edited House',       color: '#2d5fa6' },
    house_delete:          { label: 'Deleted House',      color: '#c0392b' },
    member_add:            { label: 'Added Resident',      color: '#2563eb' },
    member_edit:           { label: 'Edited Resident',     color: '#2d5fa6' },
    member_delete:         { label: 'Deleted Resident',    color: '#c0392b' },
    facility_add:          { label: 'Added Facility',     color: '#2563eb' },
    facility_edit:         { label: 'Edited Facility',    color: '#2d5fa6' },
    facility_delete:       { label: 'Deleted Facility',   color: '#c0392b' },
    incident_report:       { label: 'Incident Reported',  color: '#b06010' },
    incident_approve:      { label: 'Incident Approved',  color: '#2563eb' },
    incident_reject:       { label: 'Incident Rejected',  color: '#c0392b' },
    incident_update:       { label: 'Incident Updated',   color: '#2d5fa6' },
    incident_delete:       { label: 'Incident Deleted',   color: '#c0392b' },
    user_create:           { label: 'Admin Created',      color: '#2563eb' },
    user_toggle:           { label: 'Admin Activated/Deactivated', color: '#b06010' },
    user_delete:           { label: 'Admin Deleted',      color: '#c0392b' },
    user_role:             { label: 'Role Changed',       color: '#b06010' },
    bulk_import:           { label: 'Bulk Import',        color: '#2d5fa6' },
  };
  return map[action] || { label: action, color: '#777' };
}

function loadActivityLog() {
  const tbody = qs('#alTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="loading-state">Loading...</td></tr>';

  // Populate the account filter once
  const userSel = qs('#alUser');
  if (userSel && userSel.options.length <= 1) {
    api('activity_log_users').then(users => {
      userSel.innerHTML = '<option value="">All Accounts</option>' +
        users.map(u => `<option value="${escH(u.username)}">${escH(u.full_name)} (${escH(u.username)})</option>`).join('');
    });
  }

  const username = qs('#alUser') ? qs('#alUser').value : '';
  const actionFilter = qs('#alAction') ? qs('#alAction').value : '';
  let url = 'activity_logs';
  const params = [];
  if (username) params.push(`username=${encodeURIComponent(username)}`);
  // NOTE: can't call this param "action" — it collides with the ?action=
  // routing parameter the whole API uses, so the server-side filter uses
  // "log_action" instead.
  if (actionFilter) params.push(`log_action=${encodeURIComponent(actionFilter)}`);
  if (params.length) url += '&' + params.join('&');

  api(url).then(logs => {
    if (!Array.isArray(logs)) {
      // Something went wrong server-side (auth, SQL error, missing table, etc.)
      // — show the real reason instead of pretending there's just no data.
      const msg = (logs && logs.error) ? logs.error : 'Could not load the activity log. Check the browser console / Network tab for details.';
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#c0392b;font-size:.84rem">⚠ ${escH(msg)}</td></tr>`;
      console.error('activity_logs response:', logs);
      return;
    }
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--ink-lt);font-size:.84rem">No activity recorded yet.</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map(l => {
      const meta = activityActionMeta(l.action);
      const roleLabel = l.role === 'super_admin' ? 'Super Admin' : (l.role === 'admin' ? 'Admin' : '—');
      const who = l.full_name ? `${escH(l.full_name)} <span style="color:var(--ink-lt);font-size:.72rem">(${escH(l.username)})</span>` : '<span style="color:var(--ink-lt)">Anonymous / Public</span>';
      return `<tr>
        <td style="white-space:nowrap;font-size:.78rem">${fmtIncidentDate(l.created_at)}</td>
        <td style="font-size:.82rem">${who}<br><span style="font-size:.68rem;color:var(--ink-lt)">${roleLabel}</span></td>
        <td><span style="background:${meta.color}14;color:${meta.color};border:1px solid ${meta.color}40;border-radius:20px;padding:2px 9px;font-size:.70rem;font-weight:700;white-space:nowrap">${meta.label}</span></td>
        <td style="font-size:.80rem;max-width:320px">${escH(l.description || '—')}</td>
      </tr>`;
    }).join('');
  });
}

function addAdminAccount() {
  const name = qs('#uaName').value.trim();
  const user = qs('#uaUser').value.trim();
  const pass = qs('#uaPass').value;
  const email = qs('#uaEmail').value.trim();
  const e = qs('#uaErr');
  e.style.display = 'none';
  if (!name || !user || !pass || !email) { e.textContent = 'Full name, username, password and Gmail are required.'; e.style.display = 'block'; return; }
  if (pass.length < 6) { e.textContent = 'Password must be at least 6 characters.'; e.style.display = 'block'; return; }
  if (!/^[^\s@]+@gmail\.com$/i.test(email)) { e.textContent = 'Please enter a valid Gmail address (must end in @gmail.com).'; e.style.display = 'block'; return; }
  apiPost('user_create', { full_name: name, username: user, password: pass, email }).then(r=>{
    if (r.error) { e.textContent = r.error; e.style.display = 'block'; return; }
    qs('#uaName').value = ''; qs('#uaUser').value = ''; qs('#uaPass').value = ''; qs('#uaEmail').value = '';
    loadUsers();
    toast(`Admin account "${user}" created.`);
  });
}

function toggleUser(id, val) {
  apiPost('user_toggle', { id, is_active: val }).then(r=>{
    if (r.success) { loadUsers(); toast(val ? 'Account activated.' : 'Account deactivated.'); }
    else toast('Error: ' + (r.error || 'Could not update account.'));
  });
}

function deleteUserAccount(id, name) {
  showConfirm(`Permanently delete "${name}"'s account?\n\nThis cannot be undone. Their past incident reports, facilities, and import history will stay on record but will no longer show who handled them.`, () => {
    apiPost('user_delete', { id }).then(r=>{
      if (r.success) { loadUsers(); toast(`"${name}" was deleted.`); }
      else toast('Error: ' + (r.error || 'Could not delete account.'));
    });
  });
}

// Triggers a direct browser download of the full database backup. A plain
// navigation (not fetch) is used deliberately — the browser's session
// cookie is sent automatically, and the file streams straight to the
// user's Downloads folder instead of being held in memory as a blob.
function downloadBackup() {
  toast('Preparing backup — this may take a moment for a large database...');
  window.location.href = `${API}?action=export_backup`;
}

