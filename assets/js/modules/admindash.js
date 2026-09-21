// admin-dashboard.js — the Admin Dashboard shell (tab switching, the
// welcome header) and the Pending Reports workflow (approve/reject).

// ===================== ADMIN =====================
function loadAdminPage() {
  const u = currentUser();
  if (!u) return;
  const isSuper = isSuperAdminUser(u);

  const welcome = qs('#adminWelcome');
  if (welcome) welcome.textContent = `Welcome, ${u.full_name} (${isSuper ? 'Super Admin' : 'Admin'})`;

  // Admin lands on Pending Reports (primary day-to-day task); Super
  // Admin lands on Users instead, since Pending Reports and the other
  // operational tabs are now hidden from that role (see the
  // not-superadmin-tab class in index.php).
  const targetLabel = isSuper ? 'Users' : 'Pending';
  const targetPanelId = isSuper ? 'ap-users' : 'ap-pending';
  qsa('.adtab').forEach(b => b.classList.remove('active'));
  qsa('.admin-panel').forEach(p => p.classList.remove('active'));
  qsa('.adtab').forEach(b => { if (b.textContent.includes(targetLabel)) b.classList.add('active'); });
  const pp = qs('#' + targetPanelId);
  if (pp) pp.classList.add('active');

  loadPendingIncidents(); // both roles always load pending count

  if (isStaff(u)) {
    loadAdminStreets();
    // Silent check — fires off a real backup email only if 7+ days have
    // passed since the last one. Cheap no-op on every other visit (just
    // one quick query), so it's safe to call on every dashboard load
    // rather than needing actual server-side scheduling.
    api('check_auto_backup').then(r => {
      if (r.ran && r.sent) toast('Automatic weekly backup emailed.');
    }).catch(()=>{});
  }
  if (isSuper) {
    loadUsers();
  }
}

function adminTab(tab) {
  qsa('.adtab').forEach(b=>b.classList.remove('active'));
  qsa('.admin-panel').forEach(p=>p.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  const panel = qs(`#ap-${tab}`);
  if (panel) panel.classList.add('active');
  if(tab==='pending')    loadPendingIncidents();
  if(tab==='facilities') loadFacilitiesPage();
  if(tab==='streets')    { loadAdminStreets(); setTimeout(initStreetPinMap, 150); }
  if(tab==='puroks')     { loadAdminPuroks(); setTimeout(initPurokPinMap, 150); }
  if(tab==='users')      loadUsers();
  if(tab==='activitylog') loadActivityLog();
}

// ===================== PENDING INCIDENTS =====================
function loadPendingIncidents() {
  api('incidents_pending').then(incs => {
    // Update badge count
    const badge = qs('#pendingBadge');
    if (badge) {
      badge.textContent = incs.length;
      badge.style.display = incs.length ? 'inline-block' : 'none';
    }
    const container = qs('#pendingList');
    if (!container) return;

    if (!incs.length) {
      container.innerHTML = '<div class="empty-state" style="padding:40px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>No pending incident reports. All caught up!</div>';
      return;
    }

    container.innerHTML = incs.map(i => {
      const sev = incUrgencyMeta(i.urgency);
      const subLabel = incSubtypeLabel(i.category, i.subtype);
      const reporter = i.reporter_name || i.reporter_fullname || 'Anonymous';
      const photoHtml = i.photo
        ? `<div style="margin-bottom:12px">
             <div style="font-size:.72rem;font-weight:700;color:var(--ink-mid);text-transform:uppercase;letter-spacing:.3px;margin-bottom:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;vertical-align:-2px"><path d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"/><path d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"/></svg> Photo Proof</div>
             <img src="${i.photo}" style="width:100%;max-height:260px;object-fit:cover;border-radius:var(--r);border:1px solid var(--border);cursor:pointer" onclick="openPhotoLightbox('${i.photo}')" title="Click to view full size">
           </div>`
        : '';
      return `
      <div class="pending-card" id="pc-${i.id}">
        <div class="pending-card-hd">
          ${photoHtml}
          <div class="inc-pop" style="margin-bottom:10px">
            <div class="inc-pop-hd">
              <div class="inc-pop-icon">${incIcon(i.category)}</div>
              <div>
                <div class="inc-pop-title">${incLabel(i.category)}${subLabel ? ' — ' + subLabel : ''}</div>
                <div class="inc-pop-sub">${i.address || 'Brgy. Cabugao'}</div>
              </div>
            </div>
            <div class="inc-pop-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg> ${new Date(i.created_at).toLocaleString('en-PH')}</div>
            <div class="inc-pop-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg> <b>${reporter}</b></div>
            ${i.reporter_contact ? `<div class="inc-pop-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"/></svg> ${i.reporter_contact}</div>` : ''}
            ${i.reference_code ? `<div class="inc-pop-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"/></svg> Ref: <b style="font-family:monospace;letter-spacing:1px">${i.reference_code}</b></div>` : ''}
            ${i.description ? `<div class="inc-pop-quote">“${i.description}”</div>` : ''}
            <div class="inc-pop-status">
              <span class="inc-pop-pill" style="color:${sev.color};border-color:${sev.color}55;background:${sev.color}14">● ${sev.label}</span>
            </div>
          </div>
        </div>
        <div class="pending-actions">
          <button class="btn-approve" onclick="approveIncident(${i.id}, this)">Verify</button>
          <button class="btn-reject" onclick="rejectIncident(${i.id}, this)">Reject</button>
          ${i.lat && i.lng
            ? `<button class="btn-secondary" style="font-size:.76rem;padding:4px 12px" onclick="previewOnMap(${i.id})">Preview on Map</button>`
            : '<span class="hint" style="font-size:.75rem">No GPS location pinned</span>'}
        </div>
      </div>`;
    }).join('');
  });
}

function approveIncident(id, btn) {
  showConfirm('Approve this incident? It will immediately appear as a pin on the map for all users.', () => {
    if (btn) { btn.disabled = true; btn.textContent = 'Approving...'; }
    apiPost('incident_approve', {id}).then(r => {
      if (r.success) {
        loadPendingIncidents();  // refresh pending list + badge
        loadMapData();           // approved pin now appears on map
        loadStats();
        loadSidebarActiveIncidents();
        loadIncidentsPage();
        toast('Approved! The incident pin is now visible on the public map.');
      } else {
        if (btn) { btn.disabled = false; btn.textContent = 'Verify'; }
        toast('Error: ' + (r.error || 'Could not approve.'));
      }
    });
  }, { danger: false, okLabel: 'Approve' });
}

function rejectIncident(id, btn) {
  showRejectPrompt((reason) => {
    if (btn) { btn.disabled = true; btn.textContent = 'Rejecting...'; }
    apiPost('incident_reject', {id, reason}).then(r => {
      if (r.success) {
        loadPendingIncidents();  // refresh pending list + badge
        loadMapData();           // remove the pulsing pending pin from the map
        loadStats();
        loadSidebarActiveIncidents();
        toast('Report rejected and removed.');
      } else {
        if (btn) { btn.disabled = false; btn.textContent = 'Reject'; }
        toast('Error: ' + (r.error || 'Could not reject.'));
      }
    });
  });
}

// Called from the Manage Incident modal's Reject button
function openRejectModal(id) {
  rejectIncident(id, null);
  loadPendingIncidents();
}

