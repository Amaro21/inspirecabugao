// admin-geography.js — Super Admin/Admin forms for the Streets -> Puroks
// -> Houses hierarchy: add/delete streets, add/delete puroks, add house
// (with the cascading street->purok dropdown), and their pin-map widgets.

function loadAdminStreets() {
  const u = currentUser();
  const canEdit = isStaff(u);
  const canDelete = isStaff(u);
  api('streets').then(streets=>{
    if (!streets.length) {
      qs('#adminStreets').innerHTML='<div class="hint">No streets yet. Add one above.</div>';
      return;
    }
    qs('#adminStreets').innerHTML = streets.map(s=>`
      <div class="admin-street-item">
        <span>
          <strong>${s.name}</strong>
          <span class="badge" style="background:var(--green-pale);color:var(--green);margin-left:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg> ${s.house_count} &nbsp;<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg> ${s.population}</span>
        </span>
        <span>
          ${canEdit ? `<button class="btn-edit" data-id="${s.id}" data-name="${escH(s.name)}" data-desc="${escH(s.description||'')}" data-lat="${s.lat||''}" data-lng="${s.lng||''}" onclick="openEditStreet(this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"/></svg> Edit</button>` : ''}
          ${canDelete ? `<button class="btn-del" data-id="${s.id}" data-name="${escH(s.name)}" onclick="deleteStreet(this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg> Delete</button>` : ''}
        </span>
      </div>`).join('');
  });
}

function deleteStreet(btn) {
  const id   = btn.dataset.id;
  const name = btn.dataset.name;
  showConfirm(`Delete "${name}" and ALL its houses & members? This cannot be undone.`, () => {
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    apiPost('street_delete', {id: parseInt(id)}).then(r => {
      if (r.success) {
        loadAdminStreets();
        loadStreetSidebar();
        loadMapData();
        loadStats();
        toast('Street deleted.');
      } else {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg> Delete';
        toast('Error: ' + (r.error || 'Could not delete street.'));
      }
    });
  });
}

// Street pin map state
let streetPinMap = null;
let streetPinMarker = null;

function initStreetPinMap() {
  if (streetPinMap) { streetPinMap.invalidateSize(); return; }
  const bounds = L.latLngBounds(L.latLng(BRGY.swLat, BRGY.swLng), L.latLng(BRGY.neLat, BRGY.neLng));
  streetPinMap = L.map('streetPinMap', { zoomControl:true, minZoom:14, maxZoom:19, maxBounds:bounds, maxBoundsViscosity:1.0 })
    .setView([BRGY.lat, BRGY.lng], BRGY.zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(streetPinMap);

  // Show barangay boundary on street pin map
  // Boundary polygon removed

  streetPinMap.on('click', function(e) {
    placeStreetPin(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
  });
  setTimeout(() => streetPinMap.invalidateSize(), 200);
}

function placeStreetPin(lat, lng) {
  const ic = L.divIcon({ className:'', html:`<div style="text-align:center"><div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">📍</div><div style="background:#0f4a27;color:#fff;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;margin-top:-4px;white-space:nowrap">Street Pin</div></div>`, iconSize:[64,44], iconAnchor:[20,38] });
  if (streetPinMarker) streetPinMap.removeLayer(streetPinMarker);
  streetPinMarker = L.marker([+lat, +lng], { icon:ic, draggable:true }).addTo(streetPinMap);
  streetPinMarker.on('dragend', function() {
    const p = streetPinMarker.getLatLng();
    placeStreetPin(p.lat.toFixed(6), p.lng.toFixed(6));
  });
  qs('#nsLat').value = lat;
  qs('#nsLng').value = lng;
  qs('#streetPinCoord').textContent = `${lat}, ${lng}`;
  qs('#streetPinInfo').style.display = 'flex';
  qs('#streetPinEmpty').style.display = 'none';
}

function clearStreetPin() {
  if (streetPinMarker && streetPinMap) { streetPinMap.removeLayer(streetPinMarker); streetPinMarker = null; }
  qs('#nsLat').value = '';
  qs('#nsLng').value = '';
  qs('#streetPinInfo').style.display = 'none';
  qs('#streetPinEmpty').style.display = 'block';
}

let editingStreetId = null;

function openEditStreet(btn) {
  editingStreetId = parseInt(btn.dataset.id);
  qs('#nsName').value = btn.dataset.name;
  qs('#nsDesc').value = btn.dataset.desc || '';
  qs('#streetFormTitle').textContent = `Edit Street — ${btn.dataset.name}`;
  qs('#nsSubmitBtn').textContent = 'Update Street';
  qs('#nsCancelEdit').style.display = '';
  initStreetPinMap();
  if (btn.dataset.lat && btn.dataset.lng) {
    placeStreetPin(btn.dataset.lat, btn.dataset.lng);
    setTimeout(() => streetPinMap && streetPinMap.setView([+btn.dataset.lat, +btn.dataset.lng], 17), 250);
  } else {
    clearStreetPin();
  }
  qs('#nsName').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEditStreet() {
  editingStreetId = null;
  qs('#nsName').value = '';
  qs('#nsDesc').value = '';
  qs('#streetFormTitle').textContent = 'Add New Street';
  qs('#nsSubmitBtn').textContent = 'Add Street';
  qs('#nsCancelEdit').style.display = 'none';
  clearStreetPin();
}

function addStreet() {
  const name = qs('#nsName').value.trim();
  const lat  = qs('#nsLat').value;
  const lng  = qs('#nsLng').value;
  const e    = qs('#nsErr');
  if (!name) { e.textContent = 'Street name is required.'; e.style.display='block'; return; }
  e.style.display = 'none';

  const payload = { name, description: qs('#nsDesc').value.trim(), lat: lat||null, lng: lng||null };
  const isEditing = editingStreetId !== null;
  if (isEditing) payload.id = editingStreetId;

  apiPost(isEditing ? 'street_edit' : 'street_add', payload).then(r => {
    if (r.error) { e.textContent = r.error; e.style.display='block'; return; }
    if (isEditing) cancelEditStreet();
    else { qs('#nsName').value = ''; qs('#nsDesc').value = ''; clearStreetPin(); }
    loadAdminStreets(); loadStreetSidebar(); loadMapData(); loadStats();
    toast(isEditing ? 'Street updated!' : 'Street added!');
  });
}



// ===================== PUROK PIN MAP =====================
let purokPinMap = null;
let purokPinMarker = null;

function initPurokPinMap() {
  if (purokPinMap) { purokPinMap.invalidateSize(); return; }
  const bounds = L.latLngBounds(L.latLng(BRGY.swLat, BRGY.swLng), L.latLng(BRGY.neLat, BRGY.neLng));
  purokPinMap = L.map('purokPinMap', { zoomControl:true, minZoom:14, maxZoom:19, maxBounds:bounds, maxBoundsViscosity:1.0 })
    .setView([BRGY.lat, BRGY.lng], BRGY.zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(purokPinMap);

  // Boundary polygon removed

  purokPinMap.on('click', function(e) {
    placePurokPin(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
  });
  setTimeout(() => purokPinMap.invalidateSize(), 200);
}

function placePurokPin(lat, lng) {
  const ic = L.divIcon({ className:'', html:`<div style="text-align:center"><div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">📍</div><div style="background:#0f4a27;color:#fff;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;margin-top:-4px;white-space:nowrap">Purok Pin</div></div>`, iconSize:[64,44], iconAnchor:[20,38] });
  if (purokPinMarker) purokPinMap.removeLayer(purokPinMarker);
  purokPinMarker = L.marker([+lat, +lng], { icon:ic, draggable:true }).addTo(purokPinMap);
  purokPinMarker.on('dragend', function() {
    const p = purokPinMarker.getLatLng();
    placePurokPin(p.lat.toFixed(6), p.lng.toFixed(6));
  });
  qs('#purokLat').value = lat;
  qs('#purokLng').value = lng;
  qs('#purokPinCoord').textContent = `${lat}, ${lng}`;
  qs('#purokPinInfo').style.display = 'flex';
  qs('#purokPinEmpty').style.display = 'none';
}

function clearPurokPin() {
  if (purokPinMarker && purokPinMap) { purokPinMap.removeLayer(purokPinMarker); purokPinMarker = null; }
  qs('#purokLat').value = '';
  qs('#purokLng').value = '';
  qs('#purokPinInfo').style.display = 'none';
  qs('#purokPinEmpty').style.display = 'block';
}

// ===================== PUROKS =====================
function loadAdminPuroks() {
  const list = qs('#adminPurokList');
  if (!list) return;
  list.innerHTML = '<div class="loading-state">Loading...</div>';
  loadAllStreets('purokStreet');
  api('puroks').then(puroks => {
    if (!puroks.length) {
      list.innerHTML = '<p class="hint" style="padding:8px">No puroks yet. Add one above.</p>';
      return;
    }
    const u = currentUser();
    const canEdit = isStaff(u);
    const canDelete = isStaff(u);
    list.innerHTML = puroks.map(p => `
      <div class="admin-street-item">
        <div>
          <strong>${p.name}</strong>
          <span style="color:var(--ink-lt);font-size:.78rem;margin-left:6px">on ${p.street_name}</span>
          ${p.description ? `<span style="color:var(--ink-lt);font-size:.78rem;margin-left:6px">— ${p.description}</span>` : ''}
          <div style="margin-top:3px;font-size:.74rem;color:var(--ink-lt)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg> ${p.house_count} houses &nbsp;·&nbsp; <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg> ${p.population} residents
          </div>
        </div>
        <div>
          ${canEdit ? `<button class="btn-edit" data-id="${p.id}" data-name="${escH(p.name)}" data-desc="${escH(p.description||'')}" data-lat="${p.lat||''}" data-lng="${p.lng||''}" data-street-id="${p.street_id}" onclick="openEditPurok(this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"/></svg> Edit</button>` : ''}
          ${canDelete ? `<button class="btn-del" data-id="${p.id}" data-name="${escH(p.name)}" onclick="deletePurok(this)">Delete</button>` : ''}
        </div>
      </div>`).join('');
  });
}

let editingPurokId = null;

function openEditPurok(btn) {
  editingPurokId = parseInt(btn.dataset.id);
  qs('#purokStreet').value = btn.dataset.streetId;
  qs('#purokName').value = btn.dataset.name;
  qs('#purokDesc').value = btn.dataset.desc || '';
  qs('#purokFormTitle').textContent = `Edit Purok — ${btn.dataset.name}`;
  qs('#purokSubmitBtn').textContent = 'Update Purok';
  qs('#purokCancelEdit').style.display = '';
  initPurokPinMap();
  if (btn.dataset.lat && btn.dataset.lng) {
    placePurokPin(btn.dataset.lat, btn.dataset.lng);
    setTimeout(() => purokPinMap && purokPinMap.setView([+btn.dataset.lat, +btn.dataset.lng], 17), 250);
  } else {
    clearPurokPin();
  }
  qs('#purokName').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEditPurok() {
  editingPurokId = null;
  qs('#purokStreet').value = '';
  qs('#purokName').value = '';
  qs('#purokDesc').value = '';
  qs('#purokFormTitle').textContent = 'Add New Purok';
  qs('#purokSubmitBtn').textContent = 'Add Purok';
  qs('#purokCancelEdit').style.display = 'none';
  clearPurokPin();
}

function addPurok() {
  const sid  = qs('#purokStreet').value;
  const name = qs('#purokName').value.trim();
  const desc = qs('#purokDesc').value.trim();
  const lat  = qs('#purokLat').value;
  const lng  = qs('#purokLng').value;
  const e = qs('#purokErr');
  if (!sid) { e.textContent = 'Please select a parent street.'; e.style.display = 'block'; return; }
  if (!name) { e.textContent = 'Purok name is required.'; e.style.display = 'block'; return; }
  e.style.display = 'none';

  const payload = { street_id: sid, name, description: desc, lat: lat||null, lng: lng||null };
  const isEditing = editingPurokId !== null;
  if (isEditing) payload.id = editingPurokId;

  apiPost(isEditing ? 'purok_edit' : 'purok_add', payload).then(r => {
    if (r.error) { e.textContent = r.error; e.style.display = 'block'; return; }
    if (isEditing) {
      cancelEditPurok();
    } else {
      qs('#purokStreet').value = ''; qs('#purokName').value = ''; qs('#purokDesc').value = '';
      clearPurokPin();
    }
    loadAdminPuroks();
    toast(isEditing ? 'Purok updated!' : 'Purok added!');
  });
}

function deletePurok(btn) {
  const id = btn.dataset.id;
  const name = btn.dataset.name;
  showConfirm(`Delete Purok "${name}" and ALL its houses & members? This cannot be undone.`, () => {
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    apiPost('purok_delete', { id: parseInt(id) }).then(r => {
      if (r.success) {
        loadAdminPuroks();
        loadStreetSidebar();
        loadMapData();
        loadStats();
        toast('Purok deleted.');
      } else {
        btn.disabled = false;
        btn.textContent = 'Delete';
        toast('Error: ' + (r.error || 'Could not delete.'));
      }
    });
  });
}


// ===================== HOUSE FORM LOADERS =====================
function loadAllStreets(streetSelId) {
  api('streets').then(streets => {
    const sel = qs('#' + streetSelId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select street...</option>' +
      streets.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  });
}

function loadAllPuroks(purokSelId) {
  api('puroks').then(puroks => {
    const sel = qs('#' + purokSelId);
    if (!sel) return;
    if (!puroks.length) {
      sel.innerHTML = '<option value="">No puroks yet — add one in Admin</option>';
      return;
    }
    sel.innerHTML = '<option value="">Select purok...</option>' +
      puroks.map(p => `<option value="${p.id}" data-street="${p.street_id}">${p.name}</option>`).join('');
  });
}

// Loads puroks belonging to a specific street into a <select>, optionally pre-selecting one
function loadPuroksForStreet(streetId, purokSelId, preselectId) {
  const sel = qs('#' + purokSelId);
  if (!sel) return;
  if (!streetId) {
    sel.innerHTML = '<option value="">Select a street first...</option>';
    return;
  }
  sel.innerHTML = '<option value="">Loading...</option>';
  api('puroks').then(puroks => {
    const filtered = puroks.filter(p => String(p.street_id) === String(streetId));
    if (!filtered.length) {
      sel.innerHTML = '<option value="">No puroks for this street — add one in Admin</option>';
      return;
    }
    sel.innerHTML = '<option value="">Select purok...</option>' +
      filtered.map(p => `<option value="${p.id}" ${preselectId && p.id==preselectId?'selected':''}>${p.name}</option>`).join('');
  });
}

function onHouseStreetChange() {
  const sid = qs('#ahStreet').value;
  loadPuroksForStreet(sid, 'ahPurok');
}


