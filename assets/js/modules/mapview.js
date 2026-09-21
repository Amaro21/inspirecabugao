// mapview.js — the live public/admin map: Leaflet init, mobile zoom
// handling, and rendering every marker layer (streets, houses, puroks,
// facilities, incidents) from the /map_data API response.

// ===================== MAP INIT =====================
let map, tileStreet;
let markers = { streets:[], houses:[], facilities:[], incidents:[] };

// Shared teardrop pin icon — used for facilities, incidents, and puroks.
// size is both width and height (viewBox is a square 24x24, scaled up).
// innerHtml sits in the round top portion of the pin (an icon or short
// text). dashed/pulse are for the pending-incident variant: CSS border
// doesn't apply to an SVG shape, so the dashed outline is done as an SVG
// stroke-dasharray on the path itself instead; the pulse animation still
// applies normally to the outer wrapper div.
// Road icon for street pins — same Heroicons-style outline as facIcon()/
// incIcon(), just a single fixed icon since streets have no category to
// look up (unlike facilities/incidents).
function streetIcon(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M6 21 12 3l6 18"/><path d="M12 10.5v1.5M12 15v1.5"/></svg>';}

function pinDivIcon(color, size, innerHtml, { dashed = false, pulse = false, fontSize = null } = {}) {
  // Outer pin outline is white almost everywhere — the drop-shadow below
  // (on the whole SVG) provides enough definition against the map
  // background on its own, confirmed visually against several tile
  // colors, so a colored outline isn't needed for the shape to read
  // clearly. Exception: the dashed (pending-incident) variant keeps its
  // outline in the marker's own color — a white dash on a white fill is
  // barely distinguishable from a solid white border, which would erase
  // the whole point of dashing it (visually flagging "pending" at a
  // glance, distinct from an approved/resolved incident's solid border).
  const stroke = dashed
    ? `stroke="${color}" stroke-width="1.5" stroke-dasharray="3 2"`
    : `stroke="#fff" stroke-width="1.2"`;
  // The inner label div below needs z-index:201 (not just DOM order) to
  // render above the pin's SVG. Leaflet's own stylesheet has a built-in
  // rule — .leaflet-map-pane svg { z-index: 200 } — meant for its own
  // vector layers, but it matches any SVG anywhere in the map pane,
  // including ours. Without an explicit z-index higher than that, the
  // label — which has none of its own — stacks BELOW the SVG regardless
  // of coming later in the DOM, making it invisible even though it's
  // genuinely there.
  // border-radius:50% here matters even though this div isn't visually a
  // circle itself (the pin's own shape comes from the SVG below it) — the
  // pulse animation drives a box-shadow, and box-shadow follows whatever
  // border-radius the element has. Without this, the pulse "wave" renders
  // as a square (this div's actual bounding box) instead of a circle.
  // Point ends at y=20 instead of the classic full-length teardrop's y=24
  // (in the same viewBox coordinate space) — the circular head is
  // completely unchanged (r8.5, still 0-17), only the point below it is
  // shorter. The point is still genuinely sharp, not rounded/blunt: the
  // bezier control points pull the sides in toward the center as they
  // descend, rather than staying wide until the very last moment.
  // iconSize/viewBox are non-square (24 wide × 20 tall) to match, with no
  // wasted space below the point.
  const w = size, h = size * 20/24;
  // Pin body itself is white (see fill="#fff" below), with a colored
  // circle badge inside the head carrying the icon/text — matching the
  // Google Maps reference style. circleR=7.8. Label div's top/height are
  // computed from the circle's actual center (8.5) and radius so it
  // lines up exactly with it, not an approximate guess.
  const circleR = 7.8;
  const labelTop = ((8.5 - circleR) / 20) * 100;
  const labelHeight = ((circleR * 2) / 20) * 100;
  const html = `<div style="position:relative;width:${w}px;height:${h}px;${pulse?'border-radius:50%;animation:pulse 1.6s infinite':''}">
    <svg width="${w}" height="${h}" viewBox="0 0 24 20" style="position:absolute;top:0;left:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">
      <path d="M12 0C7.31 0 3.5 3.81 3.5 8.5C3.5 13.5 12 20 12 20S20.5 13.5 20.5 8.5C20.5 3.81 16.69 0 12 0Z" fill="#fff" ${stroke}/>
      <circle cx="12" cy="8.5" r="${circleR}" fill="${color}"/>
    </svg>
    <div style="position:absolute;top:${labelTop}%;left:0;width:100%;height:${labelHeight}%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;text-align:center;line-height:1;z-index:201;${fontSize?`font-size:${fontSize}px;`:''}pointer-events:none">${innerHtml}</div>
  </div>`;
  return L.divIcon({ className:'', html, iconSize:[w,h], iconAnchor:[w/2,h] });
}

// Finds the marker in a given layer closest to (lat,lng) and opens its
// popup — used after flyTo so sidebar clicks land on the same pin's info,
// not just an empty pan.
function flyToMarkerPopup(list, lat, lng) {
  setTimeout(() => {
    (list||[]).forEach(m => {
      const pos = m.getLatLng();
      if (Math.abs(pos.lat - +lat) < 0.0001 && Math.abs(pos.lng - +lng) < 0.0001) {
        m.openPopup();
      }
    });
  }, 600);
}

function initMap() {
  const bounds = L.latLngBounds(
    L.latLng(BRGY.swLat, BRGY.swLng),
    L.latLng(BRGY.neLat, BRGY.neLng)
  );

  // Always open fully zoomed out so the whole barangay is visible at once.
  const mobileView = window.innerWidth <= 700;
  const startZoom = BRGY.minZoom;
  // Pre-existing per-screen-size split for the minimum zoom users can pan
  // out to — currently a no-op in practice since BRGY.minZoom is also 17,
  // but left as-is since that wasn't part of what changed here.
  const minZoomLevel = mobileView ? 17 : BRGY.minZoom;

  map = L.map('map', {
    zoomControl:         true,
    zoomSnap:            0.5,  // lets zoom rest at .5 steps (e.g. 17.5), not just whole numbers
    zoomDelta:           0.5,  // +/- controls and keyboard zoom move in the same .5 steps
    minZoom:             minZoomLevel,
    maxZoom:             BRGY.maxZoom,
    maxBounds:           bounds,
    maxBoundsViscosity:  1.0   // hard boundary — snaps back instantly
  }).setView([BRGY.lat, BRGY.lng], startZoom); // always open centered on Cabugao

  tileStreet = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap', maxZoom:20 });
  tileStreet.addTo(map);

  // Barangay boundary polygon overlay
  L.polygon(BRGY.polygon, {
    color:'#1a6b3a', weight:3, opacity:0.95,
    fill:false, dashArray:'8 5'
  }).addTo(map);

  // Darken area OUTSIDE the barangay (mask effect)
  const world = [[90,-180],[90,180],[-90,180],[-90,-180]];
  L.polygon([world, BRGY.polygon], {
    color:'transparent', fillColor:'#000', fillOpacity:0.18,
    interactive:false
  }).addTo(map);

  loadMapData();
}

// Detects a small/mobile viewport so map markers and zoom can scale down to
// stay legible and uncluttered on a cramped screen.
function isMobileScreen() { return window.innerWidth <= 700; }

function loadMapData() {
  return api('map_data').then(d => {
    clearAllMarkers();
    const u = currentUser();
    const isOff = isOperationalStaff(u);
    const mob = isMobileScreen();
    // Streets
    (d.streets||[]).forEach(s => {
      if (!s.lat||!s.lng) return;
      const sSize = mob ? 26 : 32;
      const ic = pinDivIcon('#0f4a27', sSize, streetIcon());
      const m = L.marker([+s.lat,+s.lng],{icon:ic}).addTo(map);
      m.bindPopup(`
        <div class="popup-title">${s.name}</div>
        <div class="popup-section-hd">Population Overview</div>
        <div class="popup-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg> <strong>${s.house_count||0}</strong> households</div>
        <div class="popup-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg> <strong>${s.population||0}</strong> residents</div>
        <div class="popup-section-hd">Gender Profile</div>
        <div class="popup-meta">♂ <strong>${s.males||0}</strong> male</div>
        <div class="popup-meta">♀ <strong>${s.females||0}</strong> female</div>
        <div class="popup-section-hd">Priority / Vulnerable Groups</div>
        <div class="popup-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M15 12h.01"/><path d="M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/><path d="M9 12h.01"/></svg> <strong>${s.children||0}</strong> children</div>
        <div class="popup-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10.6 11h2.8"/><path d="M9 15.2c.9.7 2 1.1 3 1.1s2.1-.4 3-1.1"/></svg> <strong>${s.seniors||0}</strong> seniors</div>
        <div class="popup-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-5.87.94"/><path d="m5 8 3-3 5.5 3-2.21 3.1"/><path d="M4.24 14.48c-.19.58-.27 1.2-.23 1.84a5 5 0 0 0 5.31 4.67c.65-.04 1.25-.2 1.8-.46"/><path d="M13.76 17.52c.19-.58.27-1.2.23-1.84a5 5 0 0 0-5.31-4.67c-.65.04-1.25.2-1.8.46"/></svg> <strong>${s.pwd_count||0}</strong> PWD</div>
      `);
      markers.streets.push(m);
    });
    // Houses
    (d.houses||[]).forEach(h => {
      if (!h.lat||!h.lng) return;
      // Officials: labelled number marker + clickable popup
      // Visitors: plain dot, non-interactive (no number, no click)
      const ic = isOff
        ? L.divIcon({ className:'', html:`<div style="background:#f5a623;color:#333;border-radius:4px;padding:${mob?'1px 4px':'2px 5px'};font-size:${mob?7:9}px;font-weight:800;box-shadow:0 2px 4px rgba(0,0,0,.25);white-space:nowrap;border:1px solid #e09000">${h.house_number||'H'}</div>`, iconSize:null })
        : L.divIcon({ className:'', html:`<div style="width:${mob?8:10}px;height:${mob?8:10}px;background:#f5a623;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`, iconSize:[mob?8:10,mob?8:10], iconAnchor:[mob?4:5,mob?4:5] });
      const m = L.marker([+h.lat,+h.lng], {icon:ic, interactive:isOff}).addTo(map);
      if (isOff) {
        m.bindPopup(`<div class="popup-title">${h.house_number||'House'}</div><div class="popup-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg> ${h.street_name} · <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg> ${h.member_count} members</div><button class="popup-btn" onclick="openHouseModal(${h.id})">View / Add Members</button>`);
      }
      markers.houses.push(m);
    });
    // Facilities
    (d.facilities||[]).forEach(f => {
      if (!f.lat||!f.lng) return;
      const fSize = mob ? 26 : 32;
      const ic = pinDivIcon('#1565c0', fSize, facIcon(f.category), { fontSize: mob?10:12 });
      const m = L.marker([+f.lat,+f.lng],{icon:ic}).addTo(map);
      m.bindPopup(`<div class="popup-title">${f.name}</div><div class="popup-meta"><span style="color:${facCategoryColor(f.category)};font-weight:600">${facLabel(f.category)}</span></div>${f.photo?`<img src="${f.photo}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin:4px 0" alt="">`:''}${f.description?`<div class="popup-meta">${f.description}</div>`:''}${isOff?'<button class="popup-btn popup-btn-sec" onclick="showPage(\'facilities\')">View All Facilities</button>':''}`);
      markers.facilities.push(m);
    });
    // Incidents — officials see ALL (pending shown differently), residents see APPROVED only
    const isOfficialOrAdmin = isOff;
    (d.incidents||[]).forEach(i => {
      if (!i.lat||!i.lng) return;
      const isPending = i.approved != 1;
      // Residents/public: skip unapproved
      if (!isOfficialOrAdmin && isPending) return;
      // Both public and admin: once resolved, an incident stays on the map
      // for a 12h grace period, then stops being plotted at all.
      if (incVisibilityInfo(i)?.expired) return;

      const incSize = mob ? 24 : 30;
      const ic = isPending
        ? pinDivIcon('#e53935', incSize, incIcon(i.category), { dashed: true, pulse: true, fontSize: mob?12:15 })
        : pinDivIcon('#e53935', incSize, incIcon(i.category), { fontSize: mob?12:15 });
      const m = L.marker([+i.lat,+i.lng],{icon:ic}).addTo(map);
      m.bindPopup(renderIncidentPopup(i, isOfficialOrAdmin), {maxWidth:270, minWidth:240});
      markers.incidents.push(m);
    });

    // Puroks — render marker only if location is pinned
    (d.puroks||[]).forEach(p => {
      if (!p.lat||!p.lng) return;
      // Slightly larger than other pin types (34/28 vs the usual 32/26) —
      // puroks need to fit up to 5-character names like "4B-1" inside the
      // white circle badge, which icon-only pins don't need to worry about.
      const pSize = mob ? 28 : 34;
      const ic = pinDivIcon('#7b3fa0', pSize, p.name.replace(/Purok /i,'').substring(0,5), { fontSize: mob?5.5:6.5 });
      const m = L.marker([+p.lat,+p.lng], {icon:ic}).addTo(map);
      m.bindPopup(`
        <div class="popup-title">${p.name}</div>
        ${p.description?`<div class="popup-meta" style="margin-bottom:6px">${p.description}</div>`:''}
        <div class="popup-section-hd">Population Overview</div>
        <div class="popup-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg> <strong>${p.house_count||0}</strong> households</div>
        <div class="popup-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg> <strong>${p.population||0}</strong> residents</div>
        <div class="popup-section-hd">Gender Profile</div>
        <div class="popup-meta">♂ <strong>${p.males||0}</strong> male</div>
        <div class="popup-meta">♀ <strong>${p.females||0}</strong> female</div>
        <div class="popup-section-hd">Priority / Vulnerable Groups</div>
        <div class="popup-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M15 12h.01"/><path d="M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/><path d="M9 12h.01"/></svg> <strong>${p.children||0}</strong> children</div>
        <div class="popup-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10.6 11h2.8"/><path d="M9 15.2c.9.7 2 1.1 3 1.1s2.1-.4 3-1.1"/></svg> <strong>${p.seniors||0}</strong> seniors</div>
        <div class="popup-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:middle"><circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-5.87.94"/><path d="m5 8 3-3 5.5 3-2.21 3.1"/><path d="M4.24 14.48c-.19.58-.27 1.2-.23 1.84a5 5 0 0 0 5.31 4.67c.65-.04 1.25-.2 1.8-.46"/><path d="M13.76 17.52c.19-.58.27-1.2.23-1.84a5 5 0 0 0-5.31-4.67c-.65.04-1.25.2-1.8.46"/></svg> <strong>${p.pwd_count||0}</strong> PWD</div>
      `);
      markers.puroks.push(m);
    });

  });
}

function clearAllMarkers() {
  Object.values(markers).forEach(arr => { arr.forEach(m => map.removeLayer(m)); });
  markers = {streets:[],houses:[],facilities:[],incidents:[],puroks:[]};
}

// ===================== STREET HIGHLIGHT =====================
let selectedStreetId = null;

// Fetch road geometry from OpenStreetMap Overpass API and draw it
function flyStreet(id) {
  if (isMobileScreen()) closeMobileSidebar();
  selectedStreetId = id;
  qsa('.street-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.sid == id);
  });

  // Fly to street pin, or first house if no pin
  api('streets').then(streets => {
    const s = streets.find(x => x.id == id);
    if (s && s.lat && s.lng) {
      map.flyTo([+s.lat, +s.lng], 18);
      flyToMarkerPopup(markers.streets, s.lat, s.lng);
    }
  });
  api(`houses&street_id=${id}`).then(houses => {
    const h = houses.find(x => x.lat && x.lng);
    if (h) map.flyTo([+h.lat, +h.lng], 18);
  });
}

// ── Locate Me ─────────────────────────────────────────────
// Finds the user's GPS location and drops a pulsing "you are here"
// marker on the map, then pans to it.
let _locateMarker = null;
let _locateCircle = null;

function locateMe() {
  if (!navigator.geolocation) {
    toast('Your browser does not support location services.');
    return;
  }
  const btn = qs('#locateMeBtn');
  if (btn) btn.classList.add('locating');
  toast('Finding your location…');

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy; // metres

      if (btn) { btn.classList.remove('locating'); btn.classList.add('located'); }

      // Remove previous location marker if any
      if (_locateMarker) { map.removeLayer(_locateMarker); _locateMarker = null; }
      if (_locateCircle) { map.removeLayer(_locateCircle); _locateCircle = null; }

      // Pulsing "you are here" marker
      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:16px;height:16px">
          <div style="position:absolute;top:50%;left:50%;width:16px;height:16px;
            background:#1a4f8a;border-radius:50%;border:2px solid #fff;
            box-shadow:0 2px 6px rgba(0,0,0,.35);
            transform:translate(-50%,-50%);z-index:2"></div>
          <div style="position:absolute;top:50%;left:50%;width:16px;height:16px;
            background:#1a4f8a;border-radius:50%;opacity:.6;
            animation:locate-pulse 1.8s ease-out infinite;
            transform:translate(-50%,-50%);z-index:1"></div>
        </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      _locateMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
      _locateMarker.bindPopup(
        `<div class="popup-title">You are here</div>
         <div class="popup-meta">Accuracy: ±${Math.round(acc)} metres</div>`
      ).openPopup();

      // Accuracy circle
      if (acc < 500) {
        _locateCircle = L.circle([lat, lng], {
          radius: acc,
          color: '#1a4f8a',
          fillColor: '#1a4f8a',
          fillOpacity: 0.08,
          weight: 1,
          dashArray: '4 4',
        }).addTo(map);
      }

      map.flyTo([lat, lng], 18);
      toast('Location found!');

      // Reset button icon after 8s
      setTimeout(() => {
        if (btn) btn.classList.remove('located');
      }, 8000);
    },
    err => {
      if (btn) btn.classList.remove('locating');
      const msg = {
        1: 'Location access denied. Please allow location permission in your browser.',
        2: 'Location unavailable. Make sure GPS is enabled.',
        3: 'Location request timed out. Please try again.',
      }[err.code] || 'Could not get your location.';
      toast(msg);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
