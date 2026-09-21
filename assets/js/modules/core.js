// core.js — global state, generic DOM/fetch helpers, and small
// pure-data helpers (age groups, icon/label lookups) used everywhere
// else. Loads first; every other module depends on this one.

const API = 'api/index.php';

// ── Correct coordinates: Barangay Cabugao, Bato, Catanduanes ──
// Center: 13.5961, 124.2807 (PhilAtlas / PSA verified)
// Land area: 178.895 hectares; bounded by Cabugao Bay (south),
// Barangay Sipi (north), San Andres (east), Binanuahan (west)
const BRGY = {
  lat: 13.5961, lng: 124.2807, zoom: 17.5,
  minZoom: 17, maxZoom: 19,
  // Bounding box tightly wrapping the 178-ha barangay
  swLat: 13.5880, swLng: 124.2748,
  neLat: 13.6016, neLng: 124.2855,
  // Approximate boundary polygon (clockwise from NW)
  polygon: [
    [13.6004,124.2797],[13.6003,124.2810],[13.5998,124.2823],
    [13.5984,124.2838],[13.5973,124.2844],[13.5972,124.2843],
    [13.5967,124.2840],[13.5964,124.2839],[13.5960,124.2836],
    [13.5959,124.2838],[13.5958,124.2843],[13.5958,124.2844],
    [13.5957,124.2844],[13.5956,124.2844],[13.5955,124.2842],
    [13.5952,124.2842],[13.5951,124.2842],[13.5946,124.2849],
    [13.5928,124.2849],[13.5910,124.2844],[13.5901,124.2832],
    [13.5898,124.2813],[13.5905,124.2791],[13.5910,124.2775],
    [13.5920,124.2761],[13.5931,124.2759],[13.5942,124.2761],
    [13.5954,124.2772],[13.5964,124.2775],[13.5966,124.2767],
    [13.5968,124.2768],[13.5969,124.2764],[13.5979,124.2765],
    [13.5979,124.2771],[13.5983,124.2771],[13.5986,124.2773],
    [13.5996,124.2778],[13.6003,124.2786]
  ]
};

// ===================== STATS =====================
function loadStats() {
  api('stats').then(d=>{
    qs('#sPop').textContent=fmt(d.population);
    qs('#sHouses').textContent=fmt(d.houses);
    qs('#sStreets').textContent=fmt(d.streets);
    qs('#sPuroks').textContent=fmt(d.puroks);
    qs('#sFacilities').textContent=fmt(d.facilities);
    qs('#sIncidents').textContent=fmt(d.incidents);
    qs('#sMales').textContent=fmt(d.males);
    qs('#sFemales').textContent=fmt(d.females);
    const sr=qs('#sSeniors'); if(sr) sr.textContent=fmt(d.seniors||0);
    const pw=qs('#sPwd'); if(pw) pw.textContent=fmt(d.pwd||0);
  });
}

// ===================== AGE GROUP HELPER =====================
function calcAgeGroup(birthDateStr) {
  if (!birthDateStr) return 'adult';
  const today = new Date();
  const birth = new Date(birthDateStr);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  if (age <= 11) return 'child';
  if (age >= 60) return 'senior';
  return 'adult';
}

function calcAge(birthDateStr) {
  if (!birthDateStr) return '?';
  const today = new Date();
  const birth = new Date(birthDateStr);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ===================== MODALS =====================
function openModal(id){qs('#'+id).classList.add('show');}
function closeModal(id){qs('#'+id).classList.remove('show');}

// Styled replacement for the native confirm() dialog. Pass a message and a
// callback to run only if the user confirms — everything after the old
// `if (!confirm(...)) return;` line moves into that callback, since this
// doesn't block like the native dialog does.
let _confirmCallback = null;
function showConfirm(message, onConfirm, opts) {
  opts = opts || {};
  qs('#confirmMessage').textContent = message;
  const okBtn = qs('#confirmOkBtn');
  okBtn.textContent = opts.okLabel || 'Delete';
  const danger = opts.danger !== false; // most callers are destructive actions
  okBtn.style.background = danger ? 'var(--red)' : 'var(--green)';
  const iconWrap = qs('#confirmIconWrap');
  iconWrap.style.background = danger ? 'var(--red-pale)' : 'var(--green-pale)';
  iconWrap.style.color = danger ? 'var(--red)' : 'var(--green)';
  _confirmCallback = onConfirm;
  openModal('confirmModal');
}
function _runConfirmCallback() {
  closeModal('confirmModal');
  const cb = _confirmCallback;
  _confirmCallback = null;
  if (cb) cb();
}

// Styled replacement for prompt() — used specifically for the incident
// rejection reason, the only place in the app that collects free text as
// part of a confirmation. Callback always fires on "Reject Report" (even
// with an empty reason), matching the old prompt()'s "OK with blank input"
// behavior; closing/cancelling just doesn't call it at all.
let _rejectCallback = null;
function showRejectPrompt(onConfirm) {
  qs('#rejectReasonInput').value = '';
  _rejectCallback = onConfirm;
  openModal('rejectReasonModal');
}
function _runRejectCallback() {
  const reason = qs('#rejectReasonInput').value.trim();
  closeModal('rejectReasonModal');
  const cb = _rejectCallback;
  _rejectCallback = null;
  if (cb) cb(reason);
}

// Photo proof lightbox — base64 photos are data: URIs, which most browsers
// block from opening via window.open() in a new tab (shows a blank page).
// Showing it in an in-page overlay instead avoids that entirely.
function openPhotoLightbox(src) {
  qs('#photoLightboxImg').src = src;
  qs('#photoLightbox').classList.add('show');
}
function closePhotoLightbox() {
  qs('#photoLightbox').classList.remove('show');
  qs('#photoLightboxImg').src = '';
}
function e(event){event.stopPropagation();}
window.addEventListener('keydown',ev=>{if(ev.key==='Escape') qsa('.modal-overlay.show').forEach(m=>m.classList.remove('show'));});

// ===================== HELPERS =====================
function api(action){return fetch(`${API}?action=${action}`).then(r=>r.json()).catch(()=>({}));}
function apiPost(action,data){return fetch(`${API}?action=${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(r=>r.json()).catch(()=>({error:'Network error'}));}
function qs(s){return document.querySelector(s);}
function qsa(s){return document.querySelectorAll(s);}
function fmt(n){return parseInt(n||0).toLocaleString();}
function escH(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function resetPinUI(showId,emptyId){qs('#'+showId).style.display='none';qs('#'+emptyId).style.display='block';}

function toast(msg,dur=4000) {
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';
  clearTimeout(t._timer);t._timer=setTimeout(()=>t.style.opacity='0',dur);
}

// Single source of truth for whether the floating "Report Incident" button,
// the mobile bottom-nav pill, and the "Check Report Status" link are
// visible. Previously this exact same three-element toggle was duplicated
// in four different places (checkAuth, showPage, viewIncidentsOnMap,
// previewOnMap) — which is precisely how it kept silently reappearing from
// whichever code path didn't get updated. Now every one of those call
// sites just calls this function instead.
function updateReportButtonVisibility(visible) {
  const floatBtn = qs('#mapReportBtn');
  const navPill  = qs('.mob-nav-report-wrap');
  const csBtn    = qs('#checkStatusBtn');
  if (floatBtn) floatBtn.style.display = visible ? '' : 'none';
  if (navPill)  navPill.style.display  = visible ? '' : 'none';
  if (csBtn)    csBtn.style.display    = visible ? '' : 'none';
}
