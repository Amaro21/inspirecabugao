// notifications.js — real-time-ish polling for new pending incident
// reports while a staff account is logged in: the alert sound, the
// toast/badge notifications, and the mute toggle.

// ===================== ADMIN INCIDENT NOTIFICATIONS =====================
let _knownPendingIds = new Set();
let _pollTimer = null;
let _notifFirstRun = true;
let _alertsMuted = (localStorage.getItem('inspire_alerts_muted') === '1');

function toggleAlertMute() {
  _alertsMuted = !_alertsMuted;
  localStorage.setItem('inspire_alerts_muted', _alertsMuted ? '1' : '0');
  syncAlertMuteBtn();
  if (!_alertsMuted) playAlertSound(); // quick confirmation beep when unmuting
  toast(_alertsMuted ? 'Incident alert sounds muted' : 'Incident alert sounds on');
}

function syncAlertMuteBtn() {
  const btn = qs('#alertMuteBtn');
  if (!btn) return;
  btn.classList.toggle('muted', _alertsMuted);
  btn.title = _alertsMuted ? 'Unmute incident alert sounds' : 'Mute incident alert sounds';
  btn.innerHTML = _alertsMuted
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg>`;
}

// Alarm-style alert tone — a quick alternating high/low square-wave
// "siren chirp" (closer to a smoke detector / klaxon than a UI chime),
// since the previous gentler triangle-wave tone wasn't urgent enough for
// reports that may be genuine emergencies.
//
// Uses one shared, lazily-created AudioContext rather than a fresh one
// per call — this can now fire every second for as long as a report sits
// unaddressed, and repeatedly creating/discarding audio contexts at that
// rate risks hitting browser resource limits over a long admin session.
let _sharedAudioCtx = null;
let _audioUnlocked = false;

// Browsers block audio autoplay until the user interacts with the page.
// After a page refresh, even if there are pending reports, the alarm
// won't sound until the first click/tap. This listener unlocks the
// AudioContext the moment the user touches anything — so the alarm fires
// immediately on the next sound attempt rather than waiting for a
// deliberate navigation action.
function _unlockAudio() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  // Create the AudioContext NOW if it hasn't been created yet, so it
  // starts in a resumed state from a user-gesture context.
  if (!_sharedAudioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) _sharedAudioCtx = new Ctx();
  }
  if (_sharedAudioCtx && _sharedAudioCtx.state === 'suspended') {
    _sharedAudioCtx.resume();
  }
  document.removeEventListener('click', _unlockAudio);
  document.removeEventListener('touchstart', _unlockAudio);
  document.removeEventListener('keydown', _unlockAudio);
}
document.addEventListener('click', _unlockAudio);
document.addEventListener('touchstart', _unlockAudio);
document.addEventListener('keydown', _unlockAudio);

function playAlertSound(urgent) {
  if (_alertsMuted) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!_sharedAudioCtx) _sharedAudioCtx = new Ctx();
    const ctx = _sharedAudioCtx;
    // If the AudioContext is suspended (browser autoplay policy), resume it
    // and replay this sound once it's active — don't silently discard it.
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playAlertSound(urgent));
      return;
    }
    const now = ctx.currentTime;
    const pattern = urgent ? [1100, 700, 1100, 700, 1100, 700] : [1100, 700, 1100, 700];
    pattern.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.32, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.085);
      osc.start(start);
      osc.stop(start + 0.09);
    });
  } catch (e) { /* audio not supported, fail silently */ }
}
// Backward-compatible alias
function playNotifSound() { playAlertSound(true); }

function showIncidentNotif(incs) {
  playAlertBursts(3); // 3 bursts like a phone notification
  // Animate the pending badge
  const badge = qs('#pendingBadge');
  if (badge) { badge.classList.add('badge-pulse'); setTimeout(()=>badge.classList.remove('badge-pulse'), 1600); }
  // Animate the nav Incidents tab badge dot if present
  const navDot = qs('#navIncidentsDot');
  if (navDot) navDot.style.display = 'block';

  incs.forEach(i => {
    showNotifToast(`🚨 New ${incLabel(i.category)} report from ${i.reporter_name || 'Anonymous'}`, i.id);
  });

  // Flash the browser tab title briefly
  const originalTitle = document.title;
  let flashes = 0;
  const flashTimer = setInterval(() => {
    document.title = flashes % 2 === 0 ? `🔴 New Incident Report!` : originalTitle;
    flashes++;
    if (flashes >= 6) { clearInterval(flashTimer); document.title = originalTitle; }
  }, 700);
}

function showNotifToast(msg, incidentId) {
  const el = document.createElement('div');
  el.className = 'incident-notif-toast';
  el.innerHTML = `
    <div class="incident-notif-icon">🔔</div>
    <div class="incident-notif-body">
      <div class="incident-notif-msg">${msg}</div>
      <div class="incident-notif-action">Tap to review</div>
    </div>
    <button class="incident-notif-close" onclick="event.stopPropagation();this.closest('.incident-notif-toast').remove()">✕</button>
  `;
  el.onclick = () => { showPage('admin'); adminTabSilent('pending'); el.remove(); };
  let wrap = qs('#incidentNotifWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'incidentNotifWrap';
    document.body.appendChild(wrap);
  }
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('show'); }, 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(()=>el.remove(), 300); }, 8000);
}

function adminTabSilent(tab) {
  qsa('.adtab').forEach(b=>b.classList.remove('active'));
  qsa('.admin-panel').forEach(p=>p.classList.remove('active'));
  qsa('.adtab').forEach(b => { if (b.textContent.includes('Pending')) b.classList.add('active'); });
  const panel = qs(`#ap-${tab}`);
  if (panel) panel.classList.add('active');
  if (tab === 'pending') loadPendingIncidents();
}

function pollForNewIncidents() {
  if (!isStaff(_user)) return;
  api('incidents_pending').then(incs => {
    const currentIds = new Set(incs.map(i => i.id));
    if (_notifFirstRun) {
      // First run after login — just record state, don't notify for existing backlog
      _knownPendingIds = currentIds;
      _notifFirstRun = false;
      return;
    }
    const newOnes = incs.filter(i => !_knownPendingIds.has(i.id));
    if (newOnes.length) {
      showIncidentNotif(newOnes);
      // Drop the new pin(s) onto the map right away — works whether the admin
      // is currently looking at the Map page or another tab, since markers
      // are added to the Leaflet instance regardless of which page is visible.
      loadMapData();
      // Same idea for the sidebar's Pending Review section — this used to
      // be skipped entirely here, so a brand-new submission would show up
      // on the map instantly but leave the sidebar stale until its own
      // independent 30s poll happened to catch up.
      loadSidebarActiveIncidents();
    }
    _knownPendingIds = currentIds;

    // Keep badge + list fresh if pending tab is currently open
    const badge = qs('#pendingBadge');
    if (badge) { badge.textContent = incs.length; badge.style.display = incs.length ? 'inline-block' : 'none'; }
    const pendingPanelActive = qs('#ap-pending') && qs('#ap-pending').classList.contains('active');
    if (pendingPanelActive) loadPendingIncidents();
  }).catch(()=>{});
}

// The alert SOUND repeats every second for as long as any pending report
// exists — deliberately decoupled from the network poll above (which still
// only checks the server every 2s). Repeating the sound doesn't need a
// network round-trip each time, just the last-known pending count, so this
// runs as its own lightweight local timer instead of tying sound frequency
// to request frequency.
let _alertSoundTimer = null;
// Plays the alert sound 3 times in quick succession — like a phone
// text message notification — when a new incident report arrives.
// Stops after 3 bursts; doesn't loop continuously.
function playAlertBursts(count = 3) {
  if (_alertsMuted || count <= 0) return;
  playAlertSound(true);
  if (count > 1) setTimeout(() => playAlertBursts(count - 1), 900);
}

function startContinuousAlertSound() { /* no-op — replaced by 3-burst approach */ }
function stopContinuousAlertSound() { /* no-op */ }

function startIncidentPolling() {
  stopIncidentPolling();
  _notifFirstRun = true;
  pollForNewIncidents(); // establish baseline immediately
  _pollTimer = setInterval(pollForNewIncidents, 2000); // check every 2s — near-instant detection
  startContinuousAlertSound();
}

function stopIncidentPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  stopContinuousAlertSound();
  _knownPendingIds = new Set();
}

