// population.js — household (house) and resident (member) management:
// the house detail modal, member CRUD, and the add/edit house modal
// used from the public map sidebar.

// ===================== POPULATION PAGE =====================
function loadPopulationPage() {
  qs('#popContent').innerHTML='<div class="loading-state">Loading...</div>';
  const canAdd=isStaff(currentUser());
  api('streets').then(streets=>{
    if(!streets.length){qs('#popContent').innerHTML='<div class="empty-state">No data yet.</div>';return;}
    qs('#popContent').innerHTML=`<div class="pop-grid">${streets.map(s=>`
      <div class="pop-card">
        <div class="pop-card-hd"><h4>${s.name}</h4><p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg> ${s.house_count} households</p></div>
        <div class="pop-card-bd">
          <div class="pop-stat"><span>Total Population</span><span class="pop-stat-val pop-total">${s.population}</span></div>
          <div class="pop-stat"><span>Households</span><span class="pop-stat-val">${s.house_count}</span></div>
          <div class="section-lbl">Households</div>
          <div id="hm-${s.id}"><div class="hint" style="padding:6px">Click to load</div></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn-secondary" style="flex:1;font-size:.76rem;padding:5px;justify-content:center" onclick="loadHousesMini(${s.id})">Load Houses</button>
            ${canAdd?`<button class="btn-primary" style="flex:1;font-size:.76rem;padding:5px;justify-content:center" onclick="openAddHouseModal(${s.id})">+ Add House</button>`:''}
          </div>
        </div>
      </div>`).join('')}</div>`;
  });
}

function loadHousesMini(sid) {
  const c=qs(`#hm-${sid}`);
  c.innerHTML='<div class="loading-state" style="padding:8px">Loading...</div>';
  api(`houses&street_id=${sid}`).then(houses=>{
    if(!houses.length){c.innerHTML='<div class="hint" style="padding:6px">No houses yet.</div>';return;}
    c.innerHTML=houses.map(h=>`
      <div class="house-mini" onclick="openHouseModal(${h.id})">
        <span>${h.house_number?'#'+h.house_number:'House'}</span>
        <span class="hmcount"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg> ${h.member_count}</span>
      </div>`).join('');
  });
}

// ===================== HOUSE MODAL =====================
function openHouseModal(id) {
  editingMemberId = null;
  qs('#houseMTitle').textContent='Loading...';
  qs('#houseMBody').innerHTML='<div class="loading-state">Loading...</div>';
  openModal('houseModal');
  api(`house_detail&id=${id}`).then(h=>{
    const u=currentUser();
    const canEdit=isStaff(u);
    currentHouseMembers = h.members || [];
    const houseLabel = h.house_number ? `#${h.house_number}` : 'House';
    const purokLabel = h.purok_name ? ` · ${h.purok_name}` : '';
    qs('#houseMTitle').textContent=`${houseLabel} — ${h.street_name}${purokLabel}`;
    qs('#houseMBody').innerHTML=`
      <div class="house-stats-row">
        <div class="hstat"><div class="hstat-num">${h.member_count}</div><div class="hstat-lbl">Total</div></div>
        <div class="hstat"><div class="hstat-num">${h.males||0}</div><div class="hstat-lbl">Male</div></div>
        <div class="hstat"><div class="hstat-num">${h.females||0}</div><div class="hstat-lbl">Female</div></div>
        <div class="hstat"><div class="hstat-num">${h.seniors||0}</div><div class="hstat-lbl">Senior Citizen</div></div>
        <div class="hstat"><div class="hstat-num">${h.children||0}</div><div class="hstat-lbl">Children</div></div>
        <div class="hstat"><div class="hstat-num">${h.pwd_count||0}</div><div class="hstat-lbl">PWD</div></div>
      </div>
      ${canEdit?`<div style="display:flex;gap:6px;margin-bottom:10px">
        <button class="btn-edit" onclick="openEditHouseModal(${h.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"/></svg> Edit House</button>
        ${isStaff(u)?`<button class="btn-del" onclick="deleteHouse(${h.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg> Delete House</button>`:''}
      </div>`:''}
      <div class="section-lbl">Members (${h.member_count})</div>
      <div id="membersList">${renderMembers(h.members,h.id,canEdit)}</div>
      ${canEdit?`<button class="btn-primary full" style="margin-top:10px;justify-content:center" onclick="openAddMemberModal(${h.id})">+ Add New Member</button>`:''}`;
  });
}

function renderMembers(members,houseId,canEdit) {
  if(!members||!members.length) return '<div class="empty-state" style="padding:12px">No members yet.</div>';
  return members.map(m=>{
    const ag = m.birth_date ? calcAgeGroup(m.birth_date) : m.age_group;
    const age = m.birth_date ? calcAge(m.birth_date) : '?';
    const agLabel = ag==='senior'?'Senior Citizen':ag==='child'?'Child':'Adult';
    const pwdTag = m.is_pwd==1?'<span class="tag" style="background:#fff3e0;color:#e65100">PWD</span>':'';
    const householdHeadTag = m.is_household_head==1?'<span class="tag" style="background:#fef3c7;color:#92400e" title="Household Head">HH</span>':'';
    const familyHeadTag = m.is_family_head==1?'<span class="tag" style="background:#e0e7ff;color:#4338ca" title="Family Head">FH</span>':'';
    return `
    <div class="member-card" id="mc-${m.id}">
      <div style="flex:1">
        <div class="member-name">${m.last_name}, ${m.first_name}${m.middle_name?' '+m.middle_name.charAt(0)+'.':''}</div>
        <div class="member-tags">
          <span class="tag tag-${m.gender}">${m.gender}</span>
          <span class="tag tag-${ag}">${agLabel}</span>
          ${householdHeadTag}
          ${familyHeadTag}
          ${pwdTag}
          ${m.birth_date?`<span class="tag" style="background:#f0f0f0;color:#555">${age} yrs</span>`:''}
        </div>
      </div>
      ${canEdit?`<div class="edit-btns">
        <button class="btn-edit" onclick="openEditMember(${JSON.stringify(m).replace(/"/g,'&quot;')},${houseId})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"/></svg></button>
        <button class="btn-del" onclick="deleteMember(${m.id},${houseId})">✕</button>
      </div>`:''}
    </div>`;
  }).join('');
}

function showAgePreview() {
  const b=qs('#mBirth').value;
  const p=qs('#mAgePreview');
  if(!b){p.textContent='';return;}
  const age=calcAge(b);
  const label=calcAgeGroup(b);
  const icons={child:'Child',adult:'Adult',senior:'Senior Citizen'};
  p.textContent=`Age ${age} — ${icons[label]}`;
}

let editingMemberId = null;
let currentMemberHouseId = null;
let currentHouseMembers = []; // cached from the last house_detail fetch, so
                               // openAddMemberModal() can check for an
                               // existing household head without a
                               // separate request

function openAddMemberModal(houseId) {
  editingMemberId = null;
  currentMemberHouseId = houseId;
  qs('#mFn').value=''; qs('#mMn').value=''; qs('#mLn').value='';
  qsa('input[name="mGen"]').forEach(r=>r.checked=false);
  qs('#mBirth').value=''; qs('#mAgePreview').textContent='';
  qs('#mPwd').checked=false;
  qs('#mHouseholdHead').checked=false;
  qs('#mFamilyHead').checked=false;
  qs('#mErr').style.display='none';
  qs('#memberFormTitle').textContent='+ Add New Member';
  qs('#memberSubmitBtn').textContent='Add Member';
  // Household head is unique per house — if this house already has one,
  // a brand new member can't also be designated household head, so hide
  // the option rather than offer a checkbox that would just replace the
  // existing head as a side effect.
  const hasHouseholdHead = currentHouseMembers.some(m => m.is_household_head == 1);
  qs('#mHouseholdHeadRow').style.display = hasHouseholdHead ? 'none' : '';
  openModal('addMemberModal');
}

function submitMember() {
  const fn=qs('#mFn').value.trim(),mn=qs('#mMn').value.trim(),ln=qs('#mLn').value.trim();
  const gen=qs('input[name="mGen"]:checked')?.value;
  const birth=qs('#mBirth').value;
  const pwd=qs('#mPwd')?.checked?1:0;
  const householdHead=qs('#mHouseholdHead')?.checked?1:0;
  const familyHead=qs('#mFamilyHead')?.checked?1:0;
  const e=qs('#mErr');
  if(!fn||!ln){e.textContent='First and last name required.';e.style.display='block';return;}
  if(!gen){e.textContent='Select gender.';e.style.display='block';return;}
  if(!birth){e.textContent='Date of birth is required.';e.style.display='block';return;}
  e.style.display='none';
  const isEditing = editingMemberId !== null;
  const houseId = currentMemberHouseId;
  const payload = {house_id:houseId,first_name:fn,middle_name:mn,last_name:ln,gender:gen,birth_date:birth,is_pwd:pwd,is_household_head:householdHead,is_family_head:familyHead};
  if (isEditing) payload.id = editingMemberId;
  apiPost(isEditing ? 'member_edit' : 'member_add', payload).then(r=>{
    if(r.error){e.textContent=r.error;e.style.display='block';return;}
    editingMemberId=null;
    closeModal('addMemberModal');
    openHouseModal(houseId);loadStats();
  });
}

function openEditMember(m, houseId) {
  editingMemberId = m.id;
  currentMemberHouseId = houseId;
  qs('#mFn').value = m.first_name || '';
  qs('#mMn').value = m.middle_name || '';
  qs('#mLn').value = m.last_name || '';
  qsa('input[name="mGen"]').forEach(r => r.checked = (r.value === m.gender));
  qs('#mBirth').value = m.birth_date || '';
  showAgePreview();
  qs('#mPwd').checked = m.is_pwd == 1;
  qs('#mHouseholdHead').checked = m.is_household_head == 1;
  qs('#mFamilyHead').checked = m.is_family_head == 1;
  qs('#mErr').style.display = 'none';
  // Always visible when editing, regardless of whatever state the row was
  // left in by a previous Add — the person being edited might be the
  // current household head themselves, or the admin may want to reassign
  // the designation to them (the backend already handles unsetting the
  // previous head correctly in that case).
  qs('#mHouseholdHeadRow').style.display = '';
  qs('#memberFormTitle').textContent = `Edit Member — ${m.first_name} ${m.last_name}`;
  qs('#memberSubmitBtn').textContent = 'Update Member';
  openModal('addMemberModal');
}

function cancelEditMember() {
  editingMemberId = null;
  closeModal('addMemberModal');
}

function deleteMember(id,houseId) {
  showConfirm('Remove this member?', () => {
    apiPost('member_delete',{id}).then(r=>{ if(r.success){openHouseModal(houseId);loadStats();}});
  });
}

function deleteHouse(id) {
  showConfirm('Delete this house and ALL its members? This cannot be undone.', () => {
    apiPost('house_delete',{id}).then(r=>{if(r.success){closeModal('houseModal');loadMapData();loadStats();loadStreetSidebar();toast('House deleted.');}});
  });
}

// ===================== ADD/EDIT HOUSE =====================
let editingHouseId = null;

// Shared onPlace callback for the house pin map — reused by the map-click
// flow (initPinMap/placePinMap below) and by manually entering
// coordinates (applyManualHouseCoords), so both paths update the same
// hidden fields/UI state identically.
function housePinPlaced(la, ln) {
  qs('#ahLat').value=la; qs('#ahLng').value=ln;
  qs('#ahLatInput').value=la; qs('#ahLngInput').value=ln;
  qs('#pinCoord').textContent=`${la}, ${ln}`;
  qs('#pinInfo').style.display='flex'; qs('#pinEmpty').style.display='none';
}

function openAddHouseModal(streetId) {
  const u=currentUser();
  if(!isStaff(u)){redirectToAdminLogin();return;}
  editingHouseId=null;
  qs('#addHouseTitle').textContent='Add New House';
  qs('#ahNum').value='';qs('#ahLat').value='';qs('#ahLng').value='';qs('#ahId').value='';
  qs('#ahLatInput').value='';qs('#ahLngInput').value='';qs('#ahCoordErr').style.display='none';
  qs('#ahErr').style.display='none';
  resetPinUI('pinInfo','pinEmpty');
  // Load streets, pre-selecting one if this was opened from a specific street's card
  api('streets').then(streets=>{
    qs('#ahStreet').innerHTML='<option value="">Select street...</option>'+
      streets.map(s=>`<option value="${s.id}" ${streetId&&s.id==streetId?'selected':''}>${s.name}</option>`).join('');
    if (streetId) loadPuroksForStreet(streetId, 'ahPurok');
    else qs('#ahPurok').innerHTML='<option value="">Select a street first...</option>';
  });
  openModal('addHouseModal');
  setTimeout(()=>initPinMap('pinMap',housePinPlaced),150);
}

function openEditHouseModal(id) {
  api(`house_detail&id=${id}`).then(h=>{
    editingHouseId=id;
    qs('#addHouseTitle').textContent='Edit House';
    qs('#ahId').value=id;
    qs('#ahNum').value=h.house_number||'';
    qs('#ahLat').value=h.lat||'';
    qs('#ahLng').value=h.lng||'';
    qs('#ahLatInput').value=h.lat||'';
    qs('#ahLngInput').value=h.lng||'';
    qs('#ahCoordErr').style.display='none';
    qs('#ahErr').style.display='none';
    // Load streets then pre-select the current one
    api('streets').then(streets=>{
      qs('#ahStreet').innerHTML='<option value="">Select street...</option>'+
        streets.map(s=>`<option value="${s.id}" ${s.id==h.street_id?'selected':''}>${s.name}</option>`).join('');
    });
    // Load puroks scoped to this house's street, pre-selecting the current purok
    loadPuroksForStreet(h.street_id, 'ahPurok', h.purok_id);
    openModal('addHouseModal');
    setTimeout(()=>{
      initPinMap('pinMap',housePinPlaced);
      if(h.lat&&h.lng) placePinMap('pinMap',h.lat,h.lng,housePinPlaced);
    },150);
    closeModal('houseModal');
  });
}

function clearPin() {
  clearPinMap('pinMap',()=>{resetPinUI('pinInfo','pinEmpty');qs('#ahLat').value='';qs('#ahLng').value='';qs('#ahLatInput').value='';qs('#ahLngInput').value='';});
}

// Manual lat/lng entry — an alternative to clicking the map. Reuses the
// exact same placePinMap()/housePinPlaced() path a map click would use,
// so typing coordinates in produces an identical result (hidden fields,
// visible pin, OOB warning if applicable) to clicking that same spot.
function applyManualHouseCoords() {
  const lat = qs('#ahLatInput').value.trim();
  const lng = qs('#ahLngInput').value.trim();
  const err = qs('#ahCoordErr');
  const lat_n = parseFloat(lat), lng_n = parseFloat(lng);
  if (!lat || !lng || isNaN(lat_n) || isNaN(lng_n) || lat_n < -90 || lat_n > 90 || lng_n < -180 || lng_n > 180) {
    err.textContent = 'Enter a valid latitude (-90 to 90) and longitude (-180 to 180).';
    err.style.display = 'block';
    return;
  }
  err.style.display = 'none';
  const laStr = lat_n.toFixed(6), lnStr = lng_n.toFixed(6);
  placePinMap('pinMap', laStr, lnStr, housePinPlaced);
  // Typed coordinates could be well outside whatever's currently on
  // screen — pan there so the placed pin is actually visible.
  if (pinMaps['pinMap']) pinMaps['pinMap'].setView([laStr, lnStr], 17);
}

// Pads a purely-numeric house number to 4 digits (12 -> 0012). Left
// untouched if it isn't a plain number, e.g. "Block 3 Lot 5".
function padHouseNumber(num) {
  return /^\d+$/.test(num) ? num.padStart(4, '0') : num;
}

function formatHouseNumber() {
  const f = qs('#ahNum');
  f.value = padHouseNumber(f.value.trim());
}

function submitHouse() {
  const sid=qs('#ahStreet').value,num=padHouseNumber(qs('#ahNum').value.trim());
  const lat=qs('#ahLat').value,lng=qs('#ahLng').value,id=qs('#ahId').value;
  const e=qs('#ahErr');
  const pid=qs('#ahPurok').value;
  if(!sid){e.textContent='Please select a street.';e.style.display='block';return;}
  if(!pid){e.textContent='Please select a purok.';e.style.display='block';return;}
  if(!num){e.textContent='House number is required.';e.style.display='block';return;}
  e.style.display='none';
  const action=editingHouseId?'house_edit':'house_add';
  const data={purok_id:pid,house_number:num,lat:lat||null,lng:lng||null};
  if(editingHouseId) data.id=editingHouseId;
  apiPost(action,data).then(r=>{
    if(r.error){e.textContent=r.error;e.style.display='block';return;}
    closeModal('addHouseModal');
    loadMapData();loadStats();loadStreetSidebar();
    if(lat&&lng) map.flyTo([+lat,+lng],18);
    toast(editingHouseId?'House updated!':'House added! Click the marker to add members.');
    editingHouseId=null;
  });
}


// Generate Report dropdown (Population page header)
function toggleReportDropdown(event) {
  event.stopPropagation(); // keeps this click from also hitting the
                            // document-level listener below, which would
                            // immediately close what this just opened
  qs('#reportDropdownMenu').classList.toggle('open');
}
function closeReportDropdown() {
  const m = qs('#reportDropdownMenu');
  if (m) m.classList.remove('open');
}
// Closes the dropdown on any click outside it — the option buttons inside
// already call closeReportDropdown() explicitly themselves, so this firing
// too on those clicks is redundant but harmless.
document.addEventListener('click', closeReportDropdown);

// PWD Name List — downloads a CSV of every resident flagged PWD, with
// their address. Reuses the same pwd_report endpoint as before; this
// just builds a CSV string client-side and triggers a download instead
// of rendering a modal.
function downloadPwdReportCsv() {
  api('pwd_report').then(d => {
    if (d.error) { toast(d.error); return; }
    if (!d.residents.length) { toast('No PWD residents on record.'); return; }
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['#', 'Name', 'Age', 'Gender', 'Address'];
    const lines = [header.map(esc).join(',')];
    d.residents.forEach((r, idx) => {
      const name = [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ');
      const age = r.birth_date ? calcAge(r.birth_date) : '';
      const addr = `${r.street_name}, Purok ${r.purok_name}${r.house_number ? ' #'+r.house_number : ''}`;
      lines.push([idx+1, name, age, r.gender, addr].map(esc).join(','));
    });
    const blob = new Blob([lines.join('\r\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const dateSlug = d.generated_at.replace(/[, ]+/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `PWD_Name_List_${dateSlug}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
