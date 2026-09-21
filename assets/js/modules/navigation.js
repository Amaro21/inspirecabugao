// navigation.js — page switching (Map/Population/Incidents/Admin),
// the map sidebar (street list, facility list), and the global search bar.

// ===================== SIDEBAR =====================
let curSidebarTab = 'incidents-list';
function sidebarTab(tab) {
  curSidebarTab = tab;
  qsa('.stab').forEach((b,i)=>b.classList.toggle('active',['streets-tab','facilities-list','incidents-list'][i]===tab));
  qs('#sbStreets').classList.toggle('hidden', tab!=='streets-tab');
  qs('#sbFacilities').classList.toggle('hidden', tab!=='facilities-list');
  qs('#sbIncidents').classList.toggle('hidden', tab!=='incidents-list');
  if (tab==='streets-tab') loadStreetSidebar();
  if (tab==='facilities-list') loadSidebarFacilities();
  if (tab==='incidents-list') loadSidebarActiveIncidents();
}

// "Reported 1 min ago" style relative time for pending (not-yet-approved) reports
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(dateStr.replace(' ', 'T')).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

let _incSidebarTimer = null;
let _lastActiveIncs = null, _lastPendingIncs = null;

function _fetchAndRenderIncidentSidebar() {
  api('incidents').then(incs => {
    // "Active" now matches exactly what the map itself shows: approved,
    // and not yet past its 12h post-resolution grace period. A just-
    // resolved incident stays here (and on the map) for those 12h, then
    // both drop it at the same time — rather than the sidebar removing it
    // instantly while the map keeps showing it for hours longer.
    const active = incs.filter(i => i.approved == 1 && !incVisibilityInfo(i)?.expired);
    // Pending review — operational staff only (regular Admin, not Super
    // Admin, who now sees the same map a member of the public would);
    // 'incidents' already includes unapproved rows for officials, so no
    // extra request is needed for this.
    const pending = isOperationalStaff(currentUser())
      ? incs.filter(i => i.approved != 1 && i.status !== 'closed')
            .sort((a, b) => new Date(b.created_at.replace(' ', 'T')) - new Date(a.created_at.replace(' ', 'T')))
      : [];
    _lastActiveIncs = active;
    _lastPendingIncs = pending;
    _renderActiveIncidentList(active, pending);
  });
}

function loadSidebarActiveIncidents() {
  const list = qs('#activeIncidentList');
  // Show the last-known list instantly if we have one — the fetch below
  // will quietly replace it once fresh data arrives. Only show a loading
  // state the very first time, when there's nothing to show yet. Both of
  // these need the sidebar to actually be visible right now.
  if (list) {
    if (_lastActiveIncs) _renderActiveIncidentList(_lastActiveIncs, _lastPendingIncs);
    else list.innerHTML = '<div class="loading-state">Loading...</div>';
  }
  // Always fetch — even if the sidebar isn't showing right now, this
  // keeps _lastActiveIncs/_lastPendingIncs current so the moment the user
  // does open this tab, it's already up to date rather than stuck on
  // whatever was cached before some other action (elsewhere in the app)
  // changed the underlying data.
  _fetchAndRenderIncidentSidebar();

  // Poll every 30s so new reports, approvals, and rejections show up on
  // their own — stop entirely once the tab isn't visible; switching back
  // to it calls this function again and restarts polling. Only relevant
  // while the sidebar is actually showing.
  if (list) {
    if (_incSidebarTimer) clearInterval(_incSidebarTimer);
    _incSidebarTimer = setInterval(() => {
      if (curSidebarTab === 'incidents-list') _fetchAndRenderIncidentSidebar();
      else clearInterval(_incSidebarTimer);
    }, 30000);
  }
}

function _renderActiveIncidentList(active, pending) {
  const list = qs('#activeIncidentList');
  if (!list) return;
  const hasPending = pending && pending.length;

  let html = '';
  if (active.length) {
    html += `<div class="inc-sidebar-section">Active (${active.length})</div>`
      + active.map(i => _incSidebarItem(i, false)).join('');
  } else {
    html += `<div class="empty-state" style="padding:${hasPending ? '16px' : '24px'} 12px;text-align:center">No active incidents.${hasPending ? '' : '<br><span class="hint">Approved reports appear here.</span>'}</div>`;
  }

  if (hasPending) {
    html += `<div class="inc-sidebar-section">Pending Review (${pending.length})</div>`
      + pending.map(i => _incSidebarItem(i, true)).join('');
  }

  list.innerHTML = html;
}

function _incSidebarItem(i, isPending) {
  const hasPin = i.lat && i.lng;
  let timeHtml;
  if (isPending) {
    timeHtml = `<span class="inc-sidebar-time" style="color:var(--ink-lt)">Reported ${timeAgo(i.created_at)}</span>`;
  } else if (i.status === 'investigating' && i.investigating_at) {
    const ago = incInvestigatingTimeAgo(i.investigating_at);
    timeHtml = ago ? `<span class="inc-sidebar-time" style="color:var(--ink-lt)">⏱ Investigating — ${ago}</span>` : '';
  } else if (i.status === 'resolved' || i.status === 'closed') {
    // Still within its 12h grace period (see the "active" filter above) —
    // shows the same countdown the map itself displays, so it's clear at
    // a glance why a resolved item is still listed here at all.
    const vis = incVisibilityInfo(i);
    timeHtml = vis ? `<span class="inc-sidebar-time" style="color:var(--ink-lt)">⏱ Resolved — ${vis.text}</span>` : '';
  } else {
    // Open (approved, not yet investigating) or any other status not
    // explicitly handled above — falls back to the original report time
    // rather than showing nothing.
    timeHtml = `<span class="inc-sidebar-time" style="color:var(--ink-lt)">Reported ${timeAgo(i.created_at)}</span>`;
  }
  return `<div class="inc-sidebar-item ${hasPin ? 'clickable' : ''}"
    onclick="${hasPin ? `flyToIncident(${i.lat},${i.lng},${i.id})` : ''}"
    title="${hasPin ? 'Click to focus on map' : 'No location pinned'}">
    <div class="inc-sidebar-icon">${incIcon(i.category)}</div>
    <div class="inc-sidebar-body">
      <div class="inc-sidebar-title">${i.title}</div>
      <div class="inc-sidebar-meta">
        ${incLabel(i.category) !== i.title ? `<span class="inc-sidebar-cat">${incLabel(i.category)}</span>` : ''}
        ${timeHtml}
      </div>
      ${(i.reporter_name && isOperationalStaff(currentUser())) ? `<div class="inc-sidebar-reporter">Reported by ${i.reporter_name}</div>` : ''}
    </div>
  </div>`;
}

function flyToIncident(lat, lng, id) {
  if (!map) return;
  if (isMobileScreen()) closeMobileSidebar();
  map.flyTo([+lat, +lng], 18);
  flyToMarkerPopup(markers.incidents, lat, lng);
}

function loadStreetSidebar() {
  qs('#streetList').innerHTML='<div class="loading-state">Loading...</div>';
  api('streets').then(streets=>{
    if (!streets.length){
      qs('#streetList').innerHTML='<div class="empty-state" style="padding:24px 12px">No streets yet.<br><span class="hint">Admin can add streets via Dashboard.</span></div>';
      return;
    }
    qs('#streetList').innerHTML=`
      <div class="street-hint">Click a street to focus on the map</div>
      ${streets.map(s=>`
      <div class="street-item ${selectedStreetId==s.id?'selected':''}" data-sid="${s.id}" onclick="flyStreet(${s.id})">
        <div class="street-name">${s.name}</div>
        <div class="street-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg> ${s.house_count} houses &nbsp;·&nbsp; <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg> ${s.population} residents</div>
      </div>`).join('')}
    `;
  });
}

function loadSidebarFacilities() {
  const cat=qs('#facCatFilter').value;
  qs('#facilityList').innerHTML='<div class="loading-state">Loading...</div>';
  api(`facilities${cat?'&category='+cat:''}`).then(facs=>{
    if(!facs.length){qs('#facilityList').innerHTML='<div class="empty-state">No facilities.</div>';return;}
    qs('#facilityList').innerHTML=facs.map(f=>`
      <div class="fac-item" onclick="flyFacility(${f.lat},${f.lng})">
        <div class="fac-name">${facIcon(f.category)} ${f.name}</div>
        <div class="fac-cat" style="color:${facCategoryColor(f.category)}">${facLabel(f.category)}</div>
      </div>`).join('');
  });
}

function flyFacility(lat,lng) {
  if(lat&&lng) {
    if (isMobileScreen()) closeMobileSidebar();
    map.flyTo([+lat,+lng],18);
    flyToMarkerPopup(markers.facilities, lat, lng);
  }
}

// ===================== SEARCH =====================
let searchTimer;
function doSearch(q) {
  clearTimeout(searchTimer);
  if(q.length<2){qs('#searchResults').classList.remove('show');return;}
  searchTimer=setTimeout(()=>{
    api(`search&q=${encodeURIComponent(q)}`).then(d=>{
      const sr=qs('#searchResults');
      if(!d.results||!d.results.length){sr.innerHTML='<div style="padding:12px;font-size:.82rem;color:var(--text-lt);text-align:center">No results found.</div>';sr.classList.add('show');return;}
      sr.innerHTML=d.results.map(r=>`
        <div class="search-item" onclick="handleSearchResult(${JSON.stringify(r).replace(/"/g,'&quot;')})">
          <span>${searchTypeIcon(r.type)}</span>
          <div><div class="search-item-label">${r.label.trim()}</div><div class="search-item-sub">${r.sublabel||r.type}</div></div>
        </div>`).join('');
      sr.classList.add('show');
    });
  },300);
}

function handleSearchResult(r) {
  qs('#searchResults').classList.remove('show');
  qs('#globalSearch').value='';
  showPage('map');
  const u=currentUser();
  // Same 100ms delay the original fly-to used — the map page has just
  // become visible via showPage() above, and Leaflet needs a beat before
  // flyTo()/popup operations behave correctly on a freshly-shown map.
  setTimeout(() => {
    if (r.type === 'street') {
      flyStreet(r.id);
    } else if (r.type === 'facility') {
      flyFacility(r.lat, r.lng);
    } else if (r.type === 'incident') {
      flyToIncident(r.lat, r.lng, r.id);
    } else if (r.type === 'purok') {
      if (r.lat && r.lng) {
        if (isMobileScreen()) closeMobileSidebar();
        map.flyTo([+r.lat,+r.lng],18);
        flyToMarkerPopup(markers.puroks||[], r.lat, r.lng);
      }
    } else if (r.lat && r.lng) {
      map.flyTo([+r.lat,+r.lng],18);
    }
    if (isOperationalStaff(u) && (r.type==='member'||r.type==='house')) {
      setTimeout(()=>openHouseModal(r.house_id||r.id),400);
    }
  }, 100);
}

function searchTypeIcon(t){const icons={house:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>',member:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>',facility:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>',street:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"/></svg>',purok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>'};return icons[t]||icons.house;}
document.addEventListener('click',e=>{if(!e.target.closest('.header-search')) qs('#searchResults').classList.remove('show');});


// ===================== NAVIGATION =====================
function showPage(pg) {
  // Guard pages that require login
  const restricted = ['population','facilities','incidents','admin'];
  if(restricted.includes(pg) && !isStaff(_user)){
    redirectToAdminLogin();
    return;
  }
  qsa('.page').forEach(p=>p.classList.remove('active'));
  qsa('.nav-btn[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===pg));
  // Sync mobile nav
  const mobMap = {map:'mnMap',population:'mnPop',incidents:'mnInc',admin:'mnAdmin'};
  qsa('.mob-nav-btn').forEach(b=>b.classList.remove('active'));
  const activeMob = mobMap[pg] ? qs('#'+mobMap[pg]) : null;
  if (activeMob) activeMob.classList.add('active');
  const el=qs(`#page-${pg}`);
  if(el) el.classList.add('active');
  const statsBar = qs('.stats-bar');
  if (statsBar) statsBar.style.display = pg === 'map' ? '' : 'none';
  if(pg==='map'){setTimeout(()=>{if(map)map.invalidateSize();},100);loadStreetSidebar();loadSidebarActiveIncidents();}
  if(pg==='population') loadPopulationPage();
  if(pg==='facilities') { showPage('admin'); setTimeout(()=>adminTab('facilities'),100); return; }
  if(pg==='incidents') { loadIncidentReport(); }
  if(pg==='admin') loadAdminPage();
  // Show/hide report incident buttons — only on the map page, and only for guests
  const onMap = pg === 'map' && !isStaff(_user);
  updateReportButtonVisibility(onMap);
}

