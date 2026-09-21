// auth.js — login, logout, session checks, profile editing, password
// change, the forgot/reset-password flow, and the hidden-by-default
// public Login button.

// ===================== AUTH =====================
let _user = null;
function currentUser(){return _user;}
// Any staff account — Super Admin or regular Admin (nav/dashboard access)
function isStaff(u){ u = u || _user; return !!(u && (u.role === 'admin' || u.role === 'super_admin')); }
// Super Admin only — delete/dismiss actions and account management
function isSuperAdminUser(u){ u = u || _user; return !!(u && u.role === 'super_admin'); }
// Regular Admin only, NOT Super Admin — for the map and other places that
// show detailed population/incident data. Super Admin's role has narrowed
// to account management and activity monitoring, so Super Admin sees the
// same map a member of the public would, even though they're still staff
// for nav/dashboard purposes (isStaff() above).
function isOperationalStaff(u){ u = u || _user; return !!(u && u.role === 'admin'); }

// ===================== PROFILE / CHANGE PASSWORD =====================
function openProfileModal() {
  const u = currentUser();
  if (!u) return;
  qs('#profileName').textContent = u.full_name || u.username;
  qs('#profileRole').textContent = u.role === 'super_admin' ? 'Super Admin' : 'Admin';
  qs('#profEditName').value = u.full_name || '';
  qs('#profEditUser').value = u.username || '';
  qs('#profEditEmail').value = u.email || '';
  qs('#profInfoErr').style.display = 'none';
  qs('#pCurrentPass').value = '';
  qs('#pNewPass').value = '';
  qs('#pConfirmPass').value = '';
  qs('#profileErr').style.display = 'none';
  qs('#profileOk').style.display = 'none';

  const recoverySection = qs('#profRecoverySection');
  if (recoverySection) {
    if (isSuperAdminUser(u)) {
      recoverySection.style.display = '';
      api('recovery_code_status').then(r => {
        const statusEl = qs('#profRecoveryStatus');
        if (!statusEl) return;
        statusEl.innerHTML = r.has_code
          ? '<span style="color:var(--green)">✅ A recovery code is currently set.</span>'
          : '<span style="color:#b06010">⚠ No recovery code generated yet — you have no break-glass option if you lose your password and Gmail access.</span>';
      });
    } else {
      recoverySection.style.display = 'none';
    }
  }
  openModal('profileModal');
}

function generateRecoveryCode() {
  showConfirm('Generate a new recovery code? Any previous code will stop working immediately.', () => {
    apiPost('generate_recovery_code', {}).then(r => {
      if (r.error) { toast('Error: ' + r.error); return; }
      qs('#recoveryCodeDisplay').textContent = r.code;
      openModal('recoveryCodeModal');
      const statusEl = qs('#profRecoveryStatus');
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)">✅ A recovery code is currently set.</span>';
    });
  }, { danger: false, okLabel: 'Generate' });
}

function copyRecoveryCode() {
  const code = qs('#recoveryCodeDisplay').textContent;
  navigator.clipboard.writeText(code).then(() => {
    toast('Recovery code copied!');
  }).catch(() => {
    toast('Could not copy — please write it down manually.');
  });
}

function submitRecoveryCode() {
  const username = qs('#rcUser').value.trim();
  const code = qs('#rcCode').value.trim();
  const newPass = qs('#rcNewPass').value;
  const err = qs('#rcErr');
  const ok = qs('#rcOk');
  err.style.display = 'none';
  ok.style.display = 'none';

  if (!username || !code || !newPass) {
    err.textContent = 'Username, recovery code, and new password are required.';
    err.style.display = 'block';
    return;
  }
  if (newPass.length < 6) {
    err.textContent = 'New password must be at least 6 characters.';
    err.style.display = 'block';
    return;
  }

  apiPost('recover_with_code', { username, code, new_password: newPass }).then(r => {
    if (r.error) { err.textContent = r.error; err.style.display = 'block'; return; }
    ok.style.display = 'block';
    setTimeout(() => {
      closeModal('useRecoveryModal');
      qs('#rcUser').value = ''; qs('#rcCode').value = ''; qs('#rcNewPass').value = '';
      toast('Password reset — you can log in with your new password now.');
    }, 1500);
  });
}

function saveProfileInfo() {
  const fullName = qs('#profEditName').value.trim();
  const email = qs('#profEditEmail').value.trim();
  const err = qs('#profInfoErr');
  err.style.display = 'none';

  if (!fullName) { err.textContent = 'Full name is required.'; err.style.display = 'block'; return; }
  if (email && !/^[^\s@]+@gmail\.com$/i.test(email)) {
    err.textContent = 'Please enter a valid Gmail address (must end in @gmail.com).';
    err.style.display = 'block';
    return;
  }

  apiPost('update_profile', { full_name: fullName, email }).then(r => {
    if (r.error) { err.textContent = r.error; err.style.display = 'block'; return; }
    _user = r.user;
    qs('#profileName').textContent = _user.full_name;
    toast('Profile updated.');
  });
}

function submitPasswordChange() {
  const current = qs('#pCurrentPass').value;
  const next    = qs('#pNewPass').value;
  const confirm = qs('#pConfirmPass').value;
  const err = qs('#profileErr');
  const ok  = qs('#profileOk');
  err.style.display = 'none';
  ok.style.display = 'none';

  if (!current) { err.textContent = 'Please enter your current password.'; err.style.display = 'block'; return; }
  if (!next || next.length < 6) { err.textContent = 'New password must be at least 6 characters.'; err.style.display = 'block'; return; }
  if (next !== confirm) { err.textContent = 'New password and confirmation do not match.'; err.style.display = 'block'; return; }

  apiPost('change_password', { current_password: current, new_password: next }).then(r => {
    if (r.error) { err.textContent = r.error; err.style.display = 'block'; return; }
    ok.style.display = 'block';
    qs('#pCurrentPass').value = '';
    qs('#pNewPass').value = '';
    qs('#pConfirmPass').value = '';
    toast('Password updated.');
    setTimeout(() => closeModal('profileModal'), 1200);
  });
}

// ===================== PASSWORD VISIBILITY TOGGLE =====================
const EYE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>';

function togglePasswordVisibility(inputId, btn) {
  const input = qs('#' + inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = EYE_OFF_ICON;
    btn.title = 'Hide password';
  } else {
    input.type = 'password';
    btn.innerHTML = EYE_ICON;
    btn.title = 'Show password';
  }
}


function submitForgotPassword() {
  const email = qs('#fpEmail').value.trim();
  const err = qs('#fpErr');
  const ok = qs('#fpOk');
  err.style.display = 'none';
  ok.style.display = 'none';

  if (!email) { err.textContent = 'Please enter your Gmail address.'; err.style.display = 'block'; return; }
  if (!/^[^\s@]+@gmail\.com$/i.test(email)) { err.textContent = 'Please enter a valid Gmail address.'; err.style.display = 'block'; return; }

  apiPost('forgot_password', { email }).then(r => {
    if (r.error) { err.textContent = r.error; err.style.display = 'block'; return; }
    ok.style.display = 'block';
    qs('#fpEmail').value = '';
  });
}

function checkForPasswordResetLink() {
  const token = new URLSearchParams(window.location.search).get('reset_token');
  if (!token) return;
  qs('#rpToken').value = token;
  qs('#rpNewPass').value = '';
  qs('#rpConfirmPass').value = '';
  qs('#rpErr').style.display = 'none';
  qs('#rpOk').style.display = 'none';
  openModal('resetPassModal');
}

function cancelPasswordReset() {
  closeModal('resetPassModal');
  // Strip the token out of the URL so refreshing doesn't reopen this modal
  const url = new URL(window.location.href);
  url.searchParams.delete('reset_token');
  window.history.replaceState({}, '', url.toString());
}

function submitResetPassword() {
  const token = qs('#rpToken').value;
  const next = qs('#rpNewPass').value;
  const confirm = qs('#rpConfirmPass').value;
  const err = qs('#rpErr');
  const ok = qs('#rpOk');
  err.style.display = 'none';
  ok.style.display = 'none';

  if (!next || next.length < 6) { err.textContent = 'New password must be at least 6 characters.'; err.style.display = 'block'; return; }
  if (next !== confirm) { err.textContent = 'New password and confirmation do not match.'; err.style.display = 'block'; return; }

  apiPost('reset_password_confirm', { token, new_password: next }).then(r => {
    if (r.error) { err.textContent = r.error; err.style.display = 'block'; return; }
    ok.style.display = 'block';
    setTimeout(() => {
      cancelPasswordReset();
      redirectToAdminLogin();
    }, 1500);
  });
}

// Hides the public Login button by default so casual visitors never see
// it. Staff reveal it by visiting with ?admin in the URL — this only
// affects the current page load, nothing is remembered, so the next
// visit without ?admin hides it again.
function hasStaffAccessFlag() {
  return new URLSearchParams(window.location.search).has('admin');
}

// Every "please log in" trigger in the app routes through the ?admin
// landing page now, rather than opening a modal — this is the one place
// that builds that URL.
function redirectToAdminLogin() {
  const url = new URL(window.location.href);
  url.searchParams.set('admin', '');
  window.location.href = url.toString();
}

function checkAuth() {
  api('me').then(d=>{
    _user=d.user||null;
    const loggedIn=!!_user;
    const isOff = isStaff(_user);
    const isSuper = isSuperAdminUser(_user);
    document.body.classList.toggle('login-landing-active', hasStaffAccessFlag() && !loggedIn);
    qs('#navUser').style.display=loggedIn?'flex':'none';
    // Show nav tabs ONLY for logged-in staff (admin/super_admin)
    qsa('.admin-nav-tab').forEach(b=>b.style.display=isOff?'':'none');
    // Generic hook for any other official-only UI element (buttons, etc.)
    // that isn't a nav tab specifically.
    qsa('.official-only-el').forEach(b=>b.style.display=isOff?'':'none');
    // Mobile nav bar: only show for staff — guests use the same floating
    // buttons as desktop (#mapReportBtn + #checkStatusBtn on the map).
    const mobileNav = qs('#mobileNav');
    const mobileNavShowing = isOff && window.innerWidth <= 700;
    // Mobile nav: only show on small screens for staff — never on desktop
    if (mobileNav) mobileNav.style.display = mobileNavShowing ? 'flex' : 'none';
    // Lets CSS shift things that would otherwise sit underneath the fixed
    // 64px nav bar (e.g. the map legend) — only needed when it's actually
    // showing, i.e. staff on a small screen.
    document.body.classList.toggle('mobile-nav-visible', mobileNavShowing);
    // Remove bottom padding reserved for the nav when guests are viewing
    qsa('.page-content').forEach(el => {
      el.style.paddingBottom = isOff ? '' : '16px';
    });
    // House number / resident name search is staff-only (see api/handlers/
    // stats.php) — reflect that in the placeholder so guests aren't hinted
    // at a search capability they don't actually have.
    const searchPlaceholder = isOff
      ? 'Search households, residents, facilities...'
      : 'Search streets, puroks, facilities...';
    const gs = qs('#globalSearch'); if (gs) gs.placeholder = searchPlaceholder;
    const ms = qs('#mobileSearchInput'); if (ms) ms.placeholder = searchPlaceholder;
    if(_user){
      const roleLabel = isSuper ? 'Super Admin' : 'Admin';
      const avatarBtn = qs('#userAvatarBtn');
      if (avatarBtn) avatarBtn.title = `${_user.full_name} (${roleLabel}) — View profile`;
      qsa('#addFacilityBtn').forEach(b=>b.style.display=isOff?'':'none');
      syncAlertMuteBtn();
    // Mobile nav admin tabs
    qsa('.mob-nav-btn.admin-nav-tab').forEach(b=>b.style.display=isOff?'flex':'none');
      qsa('.admin-only-tab').forEach(b=>b.style.display=isOff?'':'none');
      qsa('.superadmin-only-tab').forEach(b=>b.style.display=isSuper?'':'none');
      // Population and Incidents specifically stay hidden from Super Admin
      // even though they're staff — Super Admin's role is scoped to
      // account management and activity monitoring, not this day-to-day
      // work. Must run after both the desktop admin-nav-tab toggle above
      // and the mobile-specific one just above this — either of those
      // would otherwise re-show these same elements afterward, since they
      // only check general staff status, not this role-specific rule.
      // Covers desktop and mobile in one pass since both share this class.
      if (isSuper) qsa('.not-superadmin-tab').forEach(b=>b.style.display='none');
    }
    // Report Incident button: guests only (staff manage via dashboard)
    const showReport = !isOff;
    const sidebarBtn = qs('#reportIncidentSidebarBtn');
    const officialNote = qs('#officialIncidentNote');
    const pageBtn = qs('#reportIncidentPageBtn');
    if (sidebarBtn) sidebarBtn.style.display = showReport ? '' : 'none';
    if (officialNote) officialNote.style.display = isOff ? '' : 'none';
    if (pageBtn) pageBtn.style.display = showReport ? '' : 'none';
    updateReportButtonVisibility(showReport);
    // Locate Me button: public only — admins don't need it since they
    // use the pin-drop tool when adding houses/facilities instead.
    const locateBtn = qs('#locateMeBtn');
    if (locateBtn) locateBtn.style.display = showReport ? '' : 'none';

    // Start/stop incident notification polling based on staff login state
    if (isOff) startIncidentPolling();
    else stopIncidentPolling();

    // Re-render map markers now that we know the real auth state — loadMapData()
    // runs once synchronously during initMap() (before this async check resolves),
    // so popups built at that moment never had Manage buttons for a logged-in user.
    if (typeof map !== 'undefined' && map) loadMapData();
  });
}

function doLogin() {
  const u=qs('#lUser').value.trim(),p=qs('#lPass').value,e=qs('#loginErr');
  e.style.display='none';
  apiPost('login',{username:u,password:p}).then(r=>{
    if(r.error){e.textContent=r.error;e.style.display='block';return;}
    _user=r.user;
    checkAuth();
    // Reload map markers — officials see pending pins, residents see only approved
    loadMapData();
    loadStats();
    if(isStaff(r.user)){
      showPage('map');
      toast(`Welcome, ${r.user.full_name}!`);
    } else {
      showPage('map');
      toast(`Welcome, ${r.user.full_name}!`);
    }
    // The map's container starts hidden behind the login landing page, so
    // Leaflet never had a real size to measure until now. checkAuth() above
    // is async, so its own class removal may not have landed yet by the
    // time showPage('map')'s 100ms invalidateSize() fires — this longer
    // delay is a safety net to make sure it happens after the map is
    // actually visible.
    setTimeout(() => { if (map) map.invalidateSize(); }, 300);
  });
}

function doRegister() {
  const d={full_name:qs('#rName').value.trim(),username:qs('#rUser').value.trim(),password:qs('#rPass').value,contact:qs('#rContact').value.trim()};
  const e=qs('#regErr');e.style.display='none';
  if(!d.full_name||!d.username||!d.password){e.textContent='All required fields must be filled.';e.style.display='block';return;}
  apiPost('register',d).then(r=>{
    if(r.error){e.textContent=r.error;e.style.display='block';return;}
    qs('#rName').value='';qs('#rUser').value='';qs('#rPass').value='';qs('#rContact').value='';
    ltab('login');toast('Registered! Please log in.');
  });
}

function doLogout(){
  api('logout').then(()=>{
    _user=null;
    stopIncidentPolling();
    checkAuth();
    showPage('map');
    loadMapData(); // removes pending-only incident pins from view
    loadStats();
    toast('Logged out.');
  });
}

function ltab(t) {
  qsa('.ltab').forEach((b,i)=>b.classList.toggle('active',['login','register'][i]===t));
  qs('#lt-login').style.display=t==='login'?'':'none';
  qs('#lt-register').style.display=t==='register'?'':'none';
}

