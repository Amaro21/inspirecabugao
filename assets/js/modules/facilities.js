// facilities.js — the Facilities page (schools, health centers, etc.):
// listing, filtering, and the add/edit/delete admin forms.

// ===================== FACILITIES PAGE =====================
let allFacilities = [];
function loadFacilitiesPage() {
  qs('#facilitiesGrid').innerHTML='<div class="loading-state">Loading...</div>';
  api('facilities').then(facs=>{
    allFacilities=facs;
    renderFacilities(facs);
  });
  // Show add button for officials
  const u=currentUser();
  if(isStaff(u)) qs('#addFacilityPageBtn').style.display='';
  else qs('#addFacilityPageBtn').style.display='none';
}

function filterFacilitiesPage(cat) {
  qsa('.cat-pill').forEach(b=>b.classList.remove('active'));
  event.target.classList.add('active');
  renderFacilities(cat?allFacilities.filter(f=>f.category===cat):allFacilities);
}

function renderFacilities(facs) {
  const u=currentUser(); const canEdit=isStaff(u);
  if(!facs.length){qs('#facilitiesGrid').innerHTML='<div class="empty-state">No facilities found.</div>';return;}
  qs('#facilitiesGrid').innerHTML=`<div class="fac-grid">${facs.map(f=>`
    <div class="fac-card" onclick="flyFacility(${f.lat},${f.lng});showPage('map')">
      <div class="fac-card-hd">
        <div class="fac-icon">${facIcon(f.category)}</div>
        <div><div class="fac-card-name">${f.name}</div><div class="fac-card-cat" style="color:${facCategoryColor(f.category)}">${facLabel(f.category)}</div></div>
      </div>
      <div class="fac-card-bd">
        ${f.photo?`<img src="${f.photo}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin-bottom:8px" alt="">`:''}
        ${f.description?`<p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg> ${f.description}</p>`:''}
        ${f.address?`<p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg> ${f.address}</p>`:''}
        ${f.contact?`<p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"/></svg> ${f.contact}</p>`:''}
        ${f.operating_hours?`<p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg> ${f.operating_hours}</p>`:''}
        ${canEdit?`<div style="margin-top:6px;display:flex;gap:6px" onclick="event.stopPropagation()">
          <button class="btn-edit" onclick="openEditFacility(${f.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"/></svg> Edit</button>
          ${isStaff(u)?`<button class="btn-del" onclick="deleteFacility(${f.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg> Delete</button>`:''}
        </div>`:''}
      </div>
    </div>`).join('')}</div>`;
}

function openFacilityModal(editId) {
  const u=currentUser();
  if(!isStaff(u)){redirectToAdminLogin();return;}
  qs('#facilityModalTitle').innerHTML=editId?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"/></svg> Edit Facility':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"/></svg> Add Facility';
  qs('#fId').value=editId||'';qs('#fName').value='';qs('#fCat').value='government';qs('#fDesc').value='';
  qs('#fAddr').value='';qs('#fContact').value='';qs('#fHours').value='';qs('#fLat').value='';qs('#fLng').value='';
  qs('#fErr').style.display='none';
  qs('#facPhotoSection').style.display = isOperationalStaff(u) ? '' : 'none';
  qs('#fPhoto').value=''; qs('#fPhotoPreview').style.display='none'; qs('#fPhotoLabel').textContent='Tap to attach a photo'; qs('#fRemovePhoto').value='';
  resetPinUI('facPinInfo','facPinEmpty');
  openModal('facilityModal');
  setTimeout(()=>initPinMap('facPinMap',(la,ln)=>{qs('#fLat').value=la;qs('#fLng').value=ln;qs('#facPinCoord').textContent=`${la}, ${ln}`;qs('#facPinInfo').style.display='flex';qs('#facPinEmpty').style.display='none';}),150);
}

function openEditFacility(id) {
  const f=allFacilities.find(x=>x.id==id);
  if(!f) return;
  openFacilityModal(id);
  setTimeout(()=>{
    qs('#fName').value=f.name;qs('#fCat').value=f.category;qs('#fDesc').value=f.description||'';
    qs('#fAddr').value=f.address||'';qs('#fContact').value=f.contact||'';qs('#fHours').value=f.operating_hours||'';
    qs('#fLat').value=f.lat||'';qs('#fLng').value=f.lng||'';
    if (f.photo && isOperationalStaff()) {
      qs('#fPhotoImg').src = f.photo;
      qs('#fPhotoPreview').style.display = 'block';
      qs('#fPhotoLabel').textContent = 'Change photo';
    }
    if(f.lat&&f.lng) placePinMap('facPinMap',f.lat,f.lng,(la,ln)=>{qs('#fLat').value=la;qs('#fLng').value=ln;qs('#facPinCoord').textContent=`${la}, ${ln}`;qs('#facPinInfo').style.display='flex';qs('#facPinEmpty').style.display='none';});
  },300);
}

function clearFacPin(){clearPinMap('facPinMap',()=>{resetPinUI('facPinInfo','facPinEmpty');qs('#fLat').value='';qs('#fLng').value=''});}

function handleFacPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  qs('#fRemovePhoto').value = ''; // selecting a new file supersedes any pending removal
  const reader = new FileReader();
  reader.onload = e => {
    qs('#fPhotoImg').src = e.target.result;
    qs('#fPhotoPreview').style.display = 'block';
    qs('#fPhotoLabel').textContent = file.name;
  };
  reader.readAsDataURL(file);
}
function removeFacPhoto() {
  qs('#fPhoto').value = '';
  qs('#fPhotoPreview').style.display = 'none';
  qs('#fPhotoLabel').textContent = 'Tap to attach a photo';
  // Only matters when editing a facility that already has a saved photo —
  // tells the backend to actually delete it, not just clear the form.
  qs('#fRemovePhoto').value = '1';
}

function submitFacility() {
  const name=qs('#fName').value.trim(),cat=qs('#fCat').value,id=qs('#fId').value;
  const e=qs('#fErr');
  if(!name||!cat){e.textContent='Name and category required.';e.style.display='block';return;}
  e.style.display='none';

  const doSubmit = (photoData) => {
    const data={name,category:cat,description:qs('#fDesc').value.trim(),address:qs('#fAddr').value.trim(),contact:qs('#fContact').value.trim(),operating_hours:qs('#fHours').value.trim(),lat:qs('#fLat').value||null,lng:qs('#fLng').value||null};
    if(id) data.id=id;
    if(photoData) data.photo=photoData;
    if(qs('#fRemovePhoto').value==='1') data.remove_photo=1;
    apiPost(id?'facility_edit':'facility_add',data).then(r=>{
      if(r.error){e.textContent=r.error;e.style.display='block';return;}
      closeModal('facilityModal');loadFacilitiesPage();loadMapData();loadStats();
      toast(id?'Facility updated!':'Facility added!');
    });
  };

  const photoFile = isOperationalStaff() && qs('#fPhoto') && qs('#fPhoto').files[0];
  if (photoFile) {
    const reader = new FileReader();
    reader.onload = ev => doSubmit(ev.target.result);
    reader.readAsDataURL(photoFile);
  } else {
    doSubmit(null);
  }
}

function deleteFacility(id) {
  showConfirm('Delete this facility?', () => {
    apiPost('facility_delete',{id}).then(r=>{if(r.success){loadFacilitiesPage();loadMapData();loadStats();toast('Facility deleted.');}});
  });
}

function facIcon(cat){const icons={government:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>',health:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 4.875 5.632 9.23 9 10.623C15.368 17.48 21 13.125 21 8.25Z"/></svg>',education:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"/></svg>',religious:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M12 3v18M5.25 8.25h13.5"/></svg>',commercial:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></svg>',infrastructure:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"/></svg>',landmark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"/></svg>',other:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/></svg>'};return icons[cat]||icons.other;}
function facLabel(cat){return{government:'Government',health:'Health Center',education:'School/Education',religious:'Religious',commercial:'Commercial',infrastructure:'Infrastructure',landmark:'Landmark',other:'Other'}[cat]||cat;}
function facCategoryColor(cat){return{government:'#2563eb',health:'#dc2626',education:'#ea580c',religious:'#7c3aed',commercial:'#16a34a',infrastructure:'#475569',landmark:'#d97706'}[cat]||'#6b7280';}
