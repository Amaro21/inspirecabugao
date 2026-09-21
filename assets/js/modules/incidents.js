// incidents.js — the incident reporting & management lifecycle from the
// PUBLIC side: the report form (incl. reCAPTCHA + honeypot), the
// reference-code success screen and status lookup, the monthly Incident
// Reports page, the map popup card renderer, and admin-side single-incident
// management (Manage modal, preview-on-map, view-all-on-map).

// ===================== INCIDENTS =====================
function loadIncidentsPage() { loadIncidentReport(); }

// ===================== INCIDENT REPORT (MONTHLY) =====================
let _irIncidents = []; // store current filtered incidents for map view
let irMap = null;       // dedicated Leaflet instance for the Incidents page split-view (separate from the main map on #page-map)
let irMapMarkers = [];  // every currently-plotted incident marker, tagged with .incidentId so a list click can find and focus the right one

// Lazily creates the Incidents page's own map — only tiles, the barangay
// boundary, and whichever single incident is currently selected in the
// list. Deliberately lighter than the main map (no streets/puroks/houses/
// facilities layers), since its only job is "show me where this one report
// happened" as the admin clicks through the list.
function initIrMap() {
  if (irMap) return;
  const el = qs('#irMap');
  if (!el) return;
  const bounds = L.latLngBounds(L.latLng(BRGY.swLat, BRGY.swLng), L.latLng(BRGY.neLat, BRGY.neLng));
  irMap = L.map('irMap', {
    zoomControl:        true,
    zoomSnap:            0.5,
    zoomDelta:           0.5,
    minZoom:             BRGY.minZoom,
    maxZoom:             BRGY.maxZoom,
    maxBounds:           bounds,
    maxBoundsViscosity:  1.0
  }).setView([BRGY.lat, BRGY.lng], BRGY.minZoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap', maxZoom:20 }).addTo(irMap);

  L.polygon(BRGY.polygon, { color:'#1a6b3a', weight:3, opacity:0.95, fill:false, dashArray:'8 5' }).addTo(irMap);
  const world = [[90,-180],[90,180],[-90,180],[-90,-180]];
  L.polygon([world, BRGY.polygon], { color:'transparent', fillColor:'#000', fillOpacity:0.18, interactive:false }).addTo(irMap);
}

function initIncidentReportFilters() {
  const yr = qs('#irYear');
  if (!yr || yr.options.length > 1) return;
  const allOpt = document.createElement('option');
  allOpt.value = ''; allOpt.textContent = 'All Years';
  yr.appendChild(allOpt);
  const now = new Date();
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    yr.appendChild(o);
  }
  // All filters default to "All" / unfiltered — no year, month, category,
  // or subtype pre-selected, so the report opens showing everything.
  yr.value = '';
  qs('#irMonth').value = '';
}

function loadIncidentReport() {
  initIncidentReportFilters();
  const year   = qs('#irYear') ? qs('#irYear').value : '';
  const month  = qs('#irMonth') ? qs('#irMonth').value : '';
  const cat    = qs('#irCat') ? qs('#irCat').value : '';
  const subtype = qs('#irSubtype') ? qs('#irSubtype').value : '';
  let url = `incidents_monthly`;
  const params = [];
  if (year)   params.push(`year=${year}`);
  if (month)  params.push(`month=${month}`);
  if (cat)    params.push(`category=${cat}`);
  if (subtype) params.push(`subtype=${subtype}`);
  if (params.length) url += '&' + params.join('&');

  const listPanel = qs('#irListItems');
  if (listPanel) listPanel.innerHTML = `<div class="loading-state">Loading...</div>`;

  api(url).then(d => {
    const incs = d.incidents || [];
    _irIncidents = incs;

    // List
    initIrMap();
    setTimeout(() => { if (irMap) irMap.invalidateSize(); }, 50);

    if (!incs.length) {
      if (listPanel) listPanel.innerHTML = `<div style="text-align:center;padding:24px;color:var(--ink-lt);font-size:.84rem">No incidents found for this period.</div>`;
      irMapMarkers.forEach(m => irMap.removeLayer(m));
      irMapMarkers = [];
      return;
    }
    const stColor  = { open:'#b06010', investigating:'#2d5fa6', resolved:'#2563eb', closed:'#666' };
    if (listPanel) listPanel.innerHTML = incs.map(i => `
      <div class="ir-list-item" data-id="${i.id}" onclick="previewIncidentOnMap(${i.id})">
        <div class="ir-list-item-top">
          <span class="ir-list-item-date">${i.date_fmt}</span>
          <span class="ir-status-pill" style="background:${stColor[i.status]||'#666'}20;color:${stColor[i.status]||'#666'};border:1px solid ${stColor[i.status]||'#666'}40;border-radius:20px;padding:2px 8px;font-size:.66rem;font-weight:700;white-space:nowrap">${i.status}</span>
        </div>
        <div class="ir-list-item-type">${incIcon(i.category)} ${incLabel(i.category)}</div>
        <div class="ir-list-item-desc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:text-top;flex-shrink:0"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg> ${i.description||'No description provided'}</div>
        <div class="ir-list-item-meta">
          <span style="font-size:.72rem;color:var(--ink-lt);display:flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;flex-shrink:0"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg> Reported by ${i.reporter_name||i.reporter_fullname||'Anonymous'}</span>
          ${i.lat&&i.lng?'':'<span style="font-size:.68rem;color:var(--ink-lt)">No pin</span>'}
        </div>
      </div>`).join('');

    // Plot everything the current filters match — runs on every load, so
    // the map stays in sync automatically as filters change.
    viewIncidentsOnMap();
  });
}

function previewIncidentOnMap(id) {
  const i = _irIncidents.find(x => x.id === id);
  if (!i || !i.lat || !i.lng) return;

  initIrMap();

  // Highlight the selected card in the list
  qsa('#irListItems .ir-list-item').forEach(el => el.classList.remove('selected'));
  const item = qs(`#irListItems .ir-list-item[data-id="${id}"]`);
  if (item) item.classList.add('selected');

  irMap.invalidateSize();
  irMap.flyTo([+i.lat, +i.lng], 18);

  // The full filtered set is already plotted (viewIncidentsOnMap runs on
  // every load) — reuse that exact marker rather than clearing the map
  // down to just this one, so the rest of the filtered incidents stay
  // visible while this one gets focused.
  const existing = irMapMarkers.find(m => m.incidentId === id);
  if (existing) {
    setTimeout(() => existing.openPopup(), 600);
    return;
  }

  // Fallback for the rare case this marker isn't already on the map
  // (e.g. called before the list has finished loading).
  const vSize = 32;
  const ic = pinDivIcon('#e53935', vSize, incIcon(i.category), { fontSize: 16 });
  const m = L.marker([+i.lat, +i.lng], { icon: ic }).addTo(irMap);
  m.bindPopup(renderIncidentPopup(i, true), { maxWidth:270, minWidth:240 });
  m.incidentId = id;
  irMapMarkers.push(m);
  setTimeout(() => m.openPopup(), 600);
}

function viewIncidentsOnMap() {
  const total = _irIncidents.length;
  if (!total) return;

  initIrMap();

  // "View all" isn't about any one row, so clear the single-item selection
  qsa('#irListItems .ir-list-item').forEach(el => el.classList.remove('selected'));
  irMapMarkers.forEach(m => irMap.removeLayer(m));
  irMapMarkers = [];

  irMap.invalidateSize();

  const unpinned = [];
  const vSize = 32;

  _irIncidents.forEach(i => {
    if (i.lat && i.lng) {
      const ic = pinDivIcon('#e53935', vSize, incIcon(i.category), { fontSize: 16 });
      const m  = L.marker([+i.lat, +i.lng], {icon:ic}).addTo(irMap);
      m.bindPopup(renderIncidentPopup(i, true), {maxWidth:270, minWidth:240});
      m.incidentId = i.id; // lets previewIncidentOnMap() find and reuse this exact marker later
      irMapMarkers.push(m);
    } else {
      unpinned.push(i);
    }
  });

  if (unpinned.length) {
    const uSize = 30;
    unpinned.forEach((i, idx) => {
      const lat = BRGY.lat + (idx * 0.00008);
      const lng = BRGY.lng + (idx * 0.00008);
      const ic = pinDivIcon('#888', uSize, incIcon(i.category), { dashed: true, fontSize: 14 });
      const m  = L.marker([lat, lng], {icon:ic, opacity:0.85}).addTo(irMap);
      const card = renderIncidentPopup(i, true).replace(
        '<div class="inc-pop-row">',
        '<div class="inc-pop-row" style="color:#b06010">⚠ Exact location not pinned</div><div class="inc-pop-row">'
      );
      m.bindPopup(card, {maxWidth:270, minWidth:240});
      m.incidentId = i.id;
      irMapMarkers.push(m);
    });
  }
}

let incidentModalMode = 'report'; // 'report' or 'manage'
let managingIncidentId = null;

function updateIncTypeIcon() {
  const ic = qs('#iCatIcon');
  if (ic) ic.innerHTML = incIcon(qs('#iCat').value);
}

// Subtype options per incident type — 'other' has none, since it's already
// the catch-all. Kept in sync with the whitelist in incident_report on the
// backend. "Other X" is just a fixed option here, not free text — anyone
// picking it is expected to explain in the Description field instead.
const INC_SUBTYPES = {
  fire: [
    ['structural', 'Structural Fire'],
    ['grass_wildland', 'Grass/Wildland Fire'],
    ['electrical', 'Electrical Fire'],
    ['vehicle', 'Vehicle Fire'],
    ['other_fire', 'Other Fire'],
  ],
  accident: [
    ['vehicular', 'Vehicular Accident'],
    ['pedestrian', 'Pedestrian Accident'],
    ['work_related', 'Work-Related Accident'],
    ['fall_injury', 'Fall/Injury'],
    ['other_accident', 'Other Accident'],
  ],
  crime: [
    ['theft_robbery', 'Theft/Robbery'],
    ['physical_altercation', 'Physical Altercation'],
    ['vandalism', 'Vandalism'],
    ['suspicious_activity', 'Suspicious Activity'],
    ['public_disturbance', 'Public Disturbance'],
    ['other_crime', 'Other Crime'],
  ],
};

function updateIncSubtype() {
  const grp = qs('#iSubtypeGroup');
  const sel = qs('#iSubtype');
  const opts = INC_SUBTYPES[qs('#iCat').value];
  if (!opts) { grp.style.display = 'none'; sel.innerHTML = ''; return; }
  grp.style.display = '';
  sel.innerHTML = opts.map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
}

// Looks up a subtype's display label for showing on an already-submitted
// report (popups, manage modal) — the reverse of what the form itself does.
function incSubtypeLabel(category, subtype) {
  const opts = INC_SUBTYPES[category];
  if (!opts || !subtype) return '';
  const hit = opts.find(([v]) => v === subtype);
  return hit ? hit[1] : '';
}

// Same idea as updateIncSubtype() above, but for the Incidents page's
// filter row — enables/disables the subtype dropdown based on which
// category is selected (it's always visible, just unclickable when
// there's nothing to narrow down), and always includes an "All Subtypes"
// option since this filters a list rather than describing one new report.

// Resets every incident filter back to its default "All" state, resets
// the map view back to its default center/zoom too, and reloads the
// list/map to match.
function resetIrFilters() {
  qs('#irYear').value = '';
  qs('#irMonth').value = '';
  qs('#irCat').value = '';
  updateIrSubtypeFilter(); // also disables the subtype select, since category is now blank
  if (irMap) irMap.setView([BRGY.lat, BRGY.lng], BRGY.minZoom);
  loadIncidentReport();
}

function updateIrSubtypeFilter() {
  const sel = qs('#irSubtype');
  if (!sel) return;
  const opts = INC_SUBTYPES[qs('#irCat').value];
  if (!opts) { sel.disabled = true; sel.value = ''; sel.innerHTML = '<option value="">All Subtypes</option>'; return; }
  sel.disabled = false;
  sel.innerHTML = '<option value="">All Subtypes</option>' + opts.map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
}

function incUrgencyMeta(sev) {
  return {
    normal:    { label: 'Normal',    color: 'var(--ink-mid)' },
    urgent:    { label: 'Urgent',    color: '#e67e22' },
    emergency: { label: 'Emergency', color: '#c0392b' },
  }[sev] || { label: sev || 'Normal', color: 'var(--ink-mid)' };
}

// Keeps the "09" prefix fixed no matter what the user does to it (typing
// over it, selecting-all and pasting a different number, deleting it with
// backspace, etc.) — the field always re-settles back to 09 + up to 9 more
// digits, 11 characters total, matching a PH mobile number.
function formatContactNumber(input) {
  let digits = input.value.replace(/\D/g, ''); // strip everything but digits
  if (digits.substring(0, 2) !== '09') {
    // Prefix got broken somehow — rebuild it from whatever digits remain,
    // dropping a leading 0 and/or 9 if present so they don't double up.
    digits = '09' + digits.replace(/^0?9?/, '');
  }
  input.value = digits.substring(0, 11);
}

function openIncidentModal() {
  const u = currentUser();
  // Officials and admin cannot submit incident reports — they manage them
  if (isStaff(u)) {
    toast('Officials manage incidents via the Admin Dashboard → Pending Reports.');
    showPage('admin');
    return;
  }
  incidentModalMode='report'; managingIncidentId=null;
  qs('#incModalTitle').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;vertical-align:middle;margin-right:4px"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>Report Incident';
  qs('#iTitle').value='';qs('#iCat').value='fire';qs('#iSev').value='normal';qs('#iDesc').value='';
  updateIncTypeIcon();
  updateIncSubtype();
  qs('#iAddr').value='';qs('#iName').value='';qs('#iContact').value='09';qs('#iLat').value='';qs('#iLng').value='';qs('#iId').value='';
  qs('#iConsent').checked = false;
  qs('#iErr').style.display='none';
  resetPinUI('incPinInfo','incPinEmpty');
  // Reset use-location button
  const locBtn = qs('#useLocationBtn');
  if (locBtn) { locBtn.disabled=false; locBtn.textContent='Use My Current Location'; locBtn.style.background=''; locBtn.style.color=''; locBtn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="9" stroke-dasharray="2 2"/></svg> Use My Current Location`; }
  openModal('incidentModal');
  setTimeout(()=>initPinMap('incPinMap',(la,ln)=>{qs('#iLat').value=la;qs('#iLng').value=ln;qs('#incPinCoord').textContent=`${la}, ${ln}`;qs('#incPinInfo').style.display='flex';qs('#incPinEmpty').style.display='none';}),150);
  setTimeout(initOrResetRecaptcha, 200);
}

// ===================== reCAPTCHA =====================
let _recaptchaSiteKey = null;
let _recaptchaWidgetId = null;

function initOrResetRecaptcha() {
  if (_recaptchaWidgetId !== null && window.grecaptcha) {
    grecaptcha.reset(_recaptchaWidgetId);
    return;
  }
  if (_recaptchaSiteKey === null) {
    api('app_config').then(cfg => {
      _recaptchaSiteKey = cfg.recaptcha_site_key || '';
      renderRecaptchaWhenReady();
    });
  } else {
    renderRecaptchaWhenReady();
  }
}

function renderRecaptchaWhenReady() {
  if (!_recaptchaSiteKey) return; // no key configured — CAPTCHA disabled
  const container = qs('#recaptchaContainer');
  if (!container) return;
  if (!window.grecaptcha || !grecaptcha.render) {
    setTimeout(renderRecaptchaWhenReady, 250); // wait for Google's script to finish loading
    return;
  }
  if (_recaptchaWidgetId !== null) return; // already rendered
  _recaptchaWidgetId = grecaptcha.render(container, { sitekey: _recaptchaSiteKey });
}

function getRecaptchaResponse() {
  if (!_recaptchaSiteKey) return ''; // CAPTCHA disabled — nothing to check
  if (_recaptchaWidgetId === null || !window.grecaptcha) return '';
  return grecaptcha.getResponse(_recaptchaWidgetId);
}


function useMyLocation() {
  const btn = qs('#useLocationBtn');
  if (!navigator.geolocation) {
    toast('Your browser does not support GPS location.');
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = 'Getting location...'; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      // Place pin on the incident map
      const onPlace = (la, ln) => {
        qs('#iLat').value = la;
        qs('#iLng').value = ln;
        qs('#incPinCoord').textContent = `${la}, ${ln}`;
        qs('#incPinInfo').style.display = 'flex';
        qs('#incPinEmpty').style.display = 'none';
      };
      placePinMap('incPinMap', lat, lng, onPlace);
      // Pan the incident pin map to the location
      if (pinMaps['incPinMap']) {
        pinMaps['incPinMap'].setView([+lat, +lng], 18);
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="9" stroke-dasharray="2 2"/></svg> Location Set ✓`;
        btn.style.background = 'var(--green)';
        btn.style.color = '#fff';
      }
      toast('Location pinned from your GPS!');
    },
    err => {
      if (btn) { btn.disabled = false; btn.textContent = 'Use My Current Location'; }
      const msgs = {
        1: 'Location access denied. Please allow location in your browser settings.',
        2: 'Unable to determine your location. Try pinning manually.',
        3: 'Location request timed out. Try pinning manually.'
      };
      toast(msgs[err.code] || 'Could not get location.');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function clearIncPin(){clearPinMap('incPinMap',()=>{resetPinUI('incPinInfo','incPinEmpty');qs('#iLat').value='';qs('#iLng').value=''});}

function submitIncident() {
  const cat=qs('#iCat').value, desc=qs('#iDesc').value.trim();
  const name=qs('#iName').value.trim(), contact=qs('#iContact').value.trim();
  const lat=qs('#iLat').value, lng=qs('#iLng').value;
  const subtypeVisible = qs('#iSubtypeGroup').style.display !== 'none';
  const subtype = subtypeVisible ? qs('#iSubtype').value : null;
  const urgency = qs('#iSev').value;
  const e=qs('#iErr');

  if(!lat||!lng){e.textContent='Please pin the incident location on the map.';e.style.display='block';return;}
  if(subtypeVisible && !subtype){e.textContent='Please select a subtype.';e.style.display='block';return;}
  if(!desc){e.textContent='Description is required.';e.style.display='block';return;}
  if(!name){e.textContent='Your name is required.';e.style.display='block';return;}
  if(!contact){e.textContent='Your contact number is required.';e.style.display='block';return;}
  if(!qs('#iConsent').checked){e.textContent='Please confirm you understand how your information will be used before submitting.';e.style.display='block';return;}
  const photoFile = qs('#iPhoto') && qs('#iPhoto').files[0];
  if(!photoFile){e.textContent='Please attach a photo as proof.';e.style.display='block';return;}

  const recaptchaResponse = getRecaptchaResponse();
  if (_recaptchaSiteKey && !recaptchaResponse) {
    e.textContent = 'Please complete the "I\'m not a robot" check before submitting.';
    e.style.display = 'block';
    return;
  }
  e.style.display='none';

  const title=qs('#iTitle').value.trim()||incLabel(cat);

  const doSubmit = (photoData) => {
    const website = qs('#iWebsite') ? qs('#iWebsite').value : ''; // honeypot
    const data={title,category:cat,subtype,description:desc,urgency,address:qs('#iAddr').value.trim(),reporter_name:name,reporter_contact:contact,lat,lng,photo:photoData||null,website,g_recaptcha_response:recaptchaResponse};
    apiPost('incident_report',data).then(r=>{
      if (window.grecaptcha && _recaptchaWidgetId !== null) grecaptcha.reset(_recaptchaWidgetId);
      if(r.error){e.textContent=r.error;e.style.display='block';return;}
      closeModal('incidentModal');loadMapData();loadStats();loadSidebarActiveIncidents();
      showReportSuccessModal(r.reference_code);
    });
  };

  if(photoFile){
    const reader=new FileReader();
    reader.onload=ev=>doSubmit(ev.target.result);
    reader.readAsDataURL(photoFile);
  } else {
    doSubmit(null);
  }
}

function showReportSuccessModal(code) {
  qs('#reportRefCode').textContent = code || '—';
  openModal('reportSuccessModal');
}

function copyRefCode() {
  const code = qs('#reportRefCode').textContent;
  navigator.clipboard.writeText(code).then(() => {
    toast('Reference code copied!');
  }).catch(() => {
    toast('Could not copy — please write it down manually.');
  });
}

function checkReportStatus() {
  const code = qs('#csCode').value.trim().toUpperCase();
  const err = qs('#csErr');
  const result = qs('#csResult');
  err.style.display = 'none';
  result.style.display = 'none';
  if (!code) { err.textContent = 'Please enter your reference code.'; err.style.display = 'block'; return; }

  api(`check_report_status&code=${encodeURIComponent(code)}`).then(r => {
    if (r.error) { err.textContent = r.error; err.style.display = 'block'; return; }
    const rep = r.report;
    const sm = incStatusMeta(rep.status);
    const isPending = rep.approved != 1;
    result.innerHTML = `
      <div class="inc-pop" style="border:1px solid var(--border);border-radius:var(--r-lg);padding:14px">
        <div class="inc-pop-hd">
          <div class="inc-pop-icon">${incIcon(rep.category)}</div>
          <div>
            <div class="inc-pop-title">${incLabel(rep.category)}</div>
            <div class="inc-pop-sub">Filed ${fmtIncidentDate(rep.created_at)}</div>
          </div>
        </div>
        ${isPending
          ? `<div class="inc-pop-row" style="color:#b06010">⏳ Awaiting review by a Barangay Official</div>`
          : `<div class="inc-pop-status"><span class="inc-pop-pill" style="color:${sm.color};border-color:${sm.color}55;background:${sm.color}14">● ${sm.label}</span></div>`}
        ${rep.resolution_notes ? `<div class="inc-pop-quote">“${escH(rep.resolution_notes)}”</div>` : ''}
      </div>`;
    result.style.display = 'block';
  });
}


function openIncManage(id) {
  const u=currentUser();
  qs('#incManageBd').innerHTML='<div class="loading-state">Loading...</div>';
  openModal('incManageModal');
  api(`incidents`).then(incs=>{
    const i=incs.find(x=>x.id==id);
    if(!i){qs('#incManageBd').innerHTML='<div class="empty-state">Not found.</div>';return;}
    const canManage=isStaff(u);
    const sm = incStatusMeta(i.status);
    const sev = incUrgencyMeta(i.urgency);
    const subLabel = incSubtypeLabel(i.category, i.subtype);
    const reporter = i.reporter_name || i.reporter_fullname || 'Anonymous';
    const photoHtml = i.photo
      ? `<div style="margin-bottom:14px">
           <div style="font-size:.76rem;font-weight:700;color:var(--ink-mid);text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:-2px"><path d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"/><path d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"/></svg> Photo Proof</div>
           <img src="${i.photo}" style="width:100%;max-height:260px;object-fit:cover;border-radius:var(--r);border:1px solid var(--border);cursor:pointer" onclick="openPhotoLightbox('${i.photo}')" title="Click to view full size">
         </div>`
      : `<div style="font-size:.78rem;color:var(--ink-lt);margin-bottom:14px;padding:10px;background:var(--bg);border-radius:var(--r);border:1px dashed var(--border)">No photo proof attached</div>`;
    qs('#incManageBd').innerHTML=`
      ${photoHtml}
      <div class="inc-pop" style="margin-bottom:14px">
        <div class="inc-pop-hd">
          <div class="inc-pop-icon">${incIcon(i.category)}</div>
          <div>
            <div class="inc-pop-title">${incLabel(i.category)}${subLabel ? ' — ' + escH(subLabel) : ''}</div>
            <div class="inc-pop-sub">${i.address ? escH(i.address) : 'Brgy. Cabugao'}</div>
          </div>
        </div>
        <div class="inc-pop-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg> ${fmtIncidentDate(i.created_at)}</div>
        <div class="inc-pop-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg> Reported by <b>${escH(reporter)}</b></div>
        ${i.reporter_contact ? `<div class="inc-pop-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"/></svg> ${escH(i.reporter_contact)}</div>` : ''}
        ${i.reference_code ? `<div class="inc-pop-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"/></svg> Ref: <b style="font-family:monospace;letter-spacing:1px">${escH(i.reference_code)}</b></div>` : ''}
        ${i.description ? `<div class="inc-pop-quote">“${escH(i.description)}”</div>` : ''}
        <div class="inc-pop-status">
          ${i.approved == 1 ? `<span class="inc-pop-pill" style="color:${sm.color};border-color:${sm.color}55;background:${sm.color}14">● ${sm.label}</span>` : ''}
          <span class="inc-pop-pill" style="color:${sev.color};border-color:${sev.color}55;background:${sev.color}14">● ${sev.label}</span>
        </div>
      </div>
      ${canManage?`<hr>
      ${i.approved != 1 ? `<div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn-approve" style="flex:1;justify-content:center" onclick="approveIncident(${i.id}, this);setTimeout(()=>closeModal('incManageModal'),600)">Verify</button>
        <button class="btn-reject" style="flex:1;justify-content:center" onclick="closeModal('incManageModal');openRejectModal(${i.id})">Reject</button>
      </div>` : `
      <div class="form-group"><label>Status</label>
        <select id="imStatus" class="form-control">
          <option value="investigating" ${i.status==='investigating'?'selected':''}>Investigating</option>
          <option value="resolved" ${i.status==='resolved'?'selected':''}>Resolved</option>
        </select>
      </div>
      <div class="form-group"><label>Resolution Notes</label><textarea id="imNotes" class="form-control" rows="2">${i.resolution_notes||''}</textarea></div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" style="flex:1;justify-content:center" onclick="updateIncident(${i.id})">Update Incident</button>
      </div>`}
      `:`<div class="hint">Log in as Admin to manage this incident.</div>`}`;
  });
}

function updateIncident(id) {
  apiPost('incident_update',{id,status:qs('#imStatus').value,resolution_notes:qs('#imNotes').value}).then(r=>{
    if(r.success){closeModal('incManageModal');loadMapData();loadIncidentsPage();loadSidebarActiveIncidents();loadStats();toast('Incident updated.');}
  });
}

function previewOnMap(id) {
  showPage('map');
  // Hide report buttons during preview
  updateReportButtonVisibility(false);

  api('incidents').then(incs => {
    const i = incs.find(x => x.id == id);
    if (!i || !i.lat || !i.lng) { toast('No location pinned for this report.'); return; }

    setTimeout(() => {
      if (!map) return;
      // Remove all existing incident markers
      markers.incidents.forEach(m => map.removeLayer(m));
      markers.incidents = [];

      // Place only this pending incident as a distinct pulsing preview marker
      const mob = isMobileScreen();
      const pSize = mob ? 30 : 36;
      const ic = pinDivIcon('#e53935', pSize, incIcon(i.category), { pulse: true, fontSize: mob?15:18 });
      const m  = L.marker([+i.lat, +i.lng], {icon:ic}).addTo(map);
      m.bindPopup(renderIncidentPopup(i, true), {maxWidth:270, minWidth:240}).openPopup();
      markers.incidents.push(m);

      map.flyTo([+i.lat, +i.lng], 18);
      toast('Previewing pending incident location. Other markers hidden.');
    }, 200);
  });
}

function incIcon(cat){const icons={fire:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"/><path d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z"/></svg>',accident:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>',crime:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z"/></svg>',other:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>'};return icons[cat]||icons.other;}
function incLabel(cat){return{fire:'Fire',accident:'Accident',crime:'Crime/Security',other:'Other'}[cat]||cat;}

// ===================== INCIDENT POPUP CARD =====================
function fmtIncidentDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(String(dateStr).replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  const datePart = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function incStatusMeta(status) {
  const map = {
    open:          { label: 'REPORTED',      color: '#b06010' },
    investigating: { label: 'INVESTIGATING', color: '#2d5fa6' },
    resolved:      { label: 'RESOLVED',       color: '#2563eb' },
    closed:        { label: 'CLOSED',         color: '#777'    },
  };
  return map[status] || map.open;
}

// 12h countdown to removal from the map, starting once an incident is
// marked resolved — not from approval. An incident that's still open or
// investigating has no resolved_at yet, so this returns null for it: it
// stays on the map indefinitely until someone actually resolves it.
// "Investigating ⏱ 1h 33m ago" style text — combined hours+minutes, to
// match incVisibilityInfo()'s own "Xh Ym remaining" style. Different from
// the general-purpose timeAgo() helper in navigation.js, which only ever
// shows one unit at a time (e.g. "2 hours ago").
function incInvestigatingTimeAgo(investigatingAt) {
  if (!investigatingAt) return null;
  const since = new Date(String(investigatingAt).replace(' ', 'T')).getTime();
  if (isNaN(since)) return null;
  const totalMins = Math.floor(Math.max(0, Date.now() - since) / 60000);
  if (totalMins < 1) return 'now';
  const hrs = Math.floor(totalMins / 60);
  const mins = String(totalMins % 60).padStart(2, '0');
  return hrs < 1 ? `${mins}m ago` : `${hrs}h ${mins}m ago`;
}

function incVisibilityInfo(i) {
  // Requires the CURRENT status to actually be resolved/closed, not just
  // that resolved_at happens to have a value — resolved_at can be stale
  // (e.g. an incident resolved in the past, then reopened back to
  // investigating), and that shouldn't count toward a removal countdown
  // for an incident that isn't resolved anymore.
  if (!i.approved || i.approved != 1 || !i.resolved_at) return null;
  if (i.status !== 'resolved' && i.status !== 'closed') return null;
  const resolvedTime = new Date(String(i.resolved_at).replace(' ', 'T')).getTime();
  if (isNaN(resolvedTime)) return null;
  const totalMs = 12 * 60 * 60 * 1000;
  const remaining = totalMs - (Date.now() - resolvedTime);
  if (remaining <= 0) return { expired: true, pct: 0, text: 'Removed from map' };
  const pct = Math.max(2, Math.min(100, (remaining / totalMs) * 100));
  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  return { expired: false, pct, text: `${hrs}h ${mins}m remaining` };
}

function renderIncidentPopup(i, isOfficialOrAdmin) {
  const sm  = incStatusMeta(i.status);
  const sev = incUrgencyMeta(i.urgency);
  const subLabel = incSubtypeLabel(i.category, i.subtype);
  const vis = incVisibilityInfo(i);
  const investigatingAgo = i.status === 'investigating' ? incInvestigatingTimeAgo(i.investigating_at) : null;
  const isPending = i.approved != 1;
  const pendingBanner = isPending ? `<div class="inc-pop-pending">⏳ PENDING APPROVAL</div>` : '';
  const visBar = (!isPending && vis) ? `
    <div class="inc-pop-vis">
      <div class="inc-pop-vis-row"><span>REMOVAL FROM MAP</span><span>${vis.text}</span></div>
      <div class="inc-pop-vis-track"><div class="inc-pop-vis-fill" style="width:${vis.pct}%;background:${vis.expired?'#aaa':'var(--green)'}"></div></div>
    </div>` : '';
  const manageBtn = isOfficialOrAdmin
    ? `<button class="inc-pop-btn inc-pop-btn-manage" onclick="openIncManage(${i.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:-1px"><path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.992l1.005.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.296-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg> Manage</button>` : '';
  const desc = i.description || '';
  const reporter = i.reporter_name || i.reporter_fullname || 'Resident';
  const reporterRow = isOfficialOrAdmin
    ? `<div class="inc-pop-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg> Reported by <b>${escH(reporter)}</b></div>`
    : '';
  return `
    <div class="inc-pop">
      ${pendingBanner}
      <div class="inc-pop-hd">
        <div class="inc-pop-icon">${incIcon(i.category)}</div>
        <div>
          <div class="inc-pop-title">${incLabel(i.category)}${subLabel ? ' — ' + escH(subLabel) : ''}</div>
          <div class="inc-pop-sub">${i.address ? escH(i.address) : 'Brgy. Cabugao'}</div>
        </div>
      </div>
      <div class="inc-pop-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg> ${fmtIncidentDate(i.created_at)}</div>
      ${reporterRow}
      ${desc ? `<div class="inc-pop-quote">“${escH(desc.substring(0,140))}${desc.length>140?'…':''}”</div>` : ''}
      <div class="inc-pop-status">
        ${i.approved == 1 ? `<span class="inc-pop-pill" style="color:${sm.color};border-color:${sm.color}55;background:${sm.color}14">● ${sm.label}</span>` : ''}
        <span class="inc-pop-pill" style="color:${sev.color};border-color:${sev.color}55;background:${sev.color}14">● ${sev.label}</span>
      </div>
      ${investigatingAgo ? `<div class="inc-pop-row">⏱ Investigating — ${investigatingAgo}</div>` : ''}
      ${visBar}
      <div class="inc-pop-actions">${manageBtn}</div>
    </div>
  `;
}
