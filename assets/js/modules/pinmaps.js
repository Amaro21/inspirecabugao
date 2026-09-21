// pinmaps.js — shared "click the map to drop a pin" widget used by the
// incident report form and every admin add/edit form (house, facility,
// street, purok). One generic implementation, several call sites.

// ===================== PIN MAPS =====================
let pinMaps = {};
let pinMarkers = {};

function initPinMap(id, onPlace) {
  const pinBounds = L.latLngBounds(
    L.latLng(BRGY.swLat, BRGY.swLng),
    L.latLng(BRGY.neLat, BRGY.neLng)
  );
  if (pinMaps[id]) {
    pinMaps[id].invalidateSize();
    pinMaps[id].setView([BRGY.lat, BRGY.lng], 17);
    return;
  }
  const m = L.map(id, {
    zoomControl:true, minZoom:14, maxZoom:19,
    maxBounds: pinBounds, maxBoundsViscosity:1.0
  }).setView([BRGY.lat, BRGY.lng], 17);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(m);

  // Boundary polygon removed intentionally

  m.on('click',e=>{ const la=e.latlng.lat.toFixed(6),ln=e.latlng.lng.toFixed(6); placePinMap(id,la,ln,onPlace); });
  pinMaps[id]=m;
  setTimeout(()=>m.invalidateSize(),200);
}

function isInsideBrgy(lat, lng) {
  return (+lat >= BRGY.swLat && +lat <= BRGY.neLat && +lng >= BRGY.swLng && +lng <= BRGY.neLng);
}

// OOB warning div IDs per map
const OOB_IDS = { pinMap:'ahOob', facPinMap:'fOob', incPinMap:'iOob' };

function placePinMap(mapId, lat, lng, onPlace) {
  const pinIc = L.divIcon({className:'',html:`<div style="text-align:center"><div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">📍</div></div>`,iconSize:[30,36],iconAnchor:[15,34]});
  if (pinMarkers[mapId]) pinMaps[mapId].removeLayer(pinMarkers[mapId]);
  pinMarkers[mapId] = L.marker([+lat,+lng],{icon:pinIc,draggable:true}).addTo(pinMaps[mapId]);

  // Show/hide OOB warning
  const oobEl = document.getElementById(OOB_IDS[mapId]);
  if (oobEl) oobEl.classList.toggle('show', !isInsideBrgy(lat, lng));

  pinMarkers[mapId].on('dragend',function(){
    const p=pinMarkers[mapId].getLatLng();
    const la=p.lat.toFixed(6), ln=p.lng.toFixed(6);
    if (oobEl) oobEl.classList.toggle('show', !isInsideBrgy(la, ln));
    onPlace(la, ln);
  });
  onPlace(lat,lng);
}

function clearPinMap(mapId, onClear) {
  if (pinMarkers[mapId]) { pinMaps[mapId].removeLayer(pinMarkers[mapId]); delete pinMarkers[mapId]; }
  onClear();
}

