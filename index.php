<?php
require_once 'config.php';
enforceHttps();
// Same condition as the client-side toggle in checkAuth() — determined here
// too so the very first render is already correct, with no flash of the
// wrong view while the async auth check on the client catches up.
$showLoginLanding = isset($_GET['admin']) && !isOfficial();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>INSPIRE – Barangay Cabugao, Bato, Catanduanes</title>
<link rel="icon" type="image/jpeg" href="assets/img/logo.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="assets/css/style.css?v=262">
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
</head>
<body<?= $showLoginLanding ? ' class="login-landing-active"' : '' ?>>

<!-- HEADER -->
<header class="header">
  <div class="header-inner">
    <div class="logo-group">
      <div class="logo-icon">
        <img src="assets/img/logo.jpg" alt="INSPIRE logo">
      </div>
      <div class="logo-text">
        <span class="logo-title">INSPIRE</span>
        <span class="logo-sub">Brgy. Cabugao · Bato, Catanduanes</span>
      </div>
    </div>
    <div class="header-search">
      <input type="text" id="globalSearch" placeholder="Search households, residents, facilities..." autocomplete="off" oninput="doSearch(this.value)">
      <div class="search-results" id="searchResults"></div>
    </div>
    <!-- Mobile search toggle -->
    <button class="mob-search-btn" id="mobSearchBtn" onclick="toggleMobileSearch()" aria-label="Search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
    </button>
    <nav class="nav">
      <!-- Map is always visible to everyone -->
      <button class="nav-btn active" data-page="map" onclick="showPage('map')">Map</button>
      <!-- These tabs only show when logged in as admin/official —
           Population and Incidents specifically stay hidden from Super
           Admin, whose role is scoped to account management and activity
           monitoring; regular Admin still handles this day-to-day work. -->
      <button class="nav-btn admin-nav-tab not-superadmin-tab" data-page="population" onclick="showPage('population')" style="display:none">Population</button>
      <button class="nav-btn admin-nav-tab not-superadmin-tab" data-page="incidents" onclick="showPage('incidents')" style="display:none">Incidents</button>
      <button class="nav-btn admin-nav-tab" data-page="admin" id="adminTab" onclick="showPage('admin')" style="display:none">Admin</button>
      <div class="nav-user" id="navUser" style="display:none">
        <button class="alert-mute-btn not-superadmin-tab" id="alertMuteBtn" onclick="toggleAlertMute()" title="Mute incident alert sounds">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg>
        </button>
        <button class="user-avatar-btn" id="userAvatarBtn" onclick="openProfileModal()" title="View profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
        </button>
      </div>
    </nav>
  </div>
  <!-- Mobile search bar drops down inside header -->
  <div class="mobile-search-bar" id="mobileSearchBar">
    <input type="text" id="mobileSearchInput" placeholder="Search households, residents, facilities..."
      autocomplete="off" oninput="doSearch(this.value); syncMobileSearchResults(this.value)">
    <div class="mobile-search-results" id="mobileSearchResults"></div>
  </div>
</header>

<!-- STATS BAR (visible to everyone) -->
<div class="stats-bar">
  <div class="stat-item"><span class="stat-num" id="sPop">—</span><span class="stat-lbl">Population</span></div>
  <div class="stat-div"></div>
  <div class="stat-item"><span class="stat-num" id="sHouses">—</span><span class="stat-lbl">Households</span></div>
  <div class="stat-div"></div>
  <div class="stat-item"><span class="stat-num" id="sStreets">—</span><span class="stat-lbl">Streets</span></div>
  <div class="stat-div"></div>
  <div class="stat-item"><span class="stat-num" id="sPuroks">—</span><span class="stat-lbl">Puroks</span></div>
  <div class="stat-div"></div>
  <div class="stat-item"><span class="stat-num" id="sFacilities">—</span><span class="stat-lbl">Facilities</span></div>
  <div class="stat-div"></div>
  <div class="stat-item"><span class="stat-num" id="sIncidents" style="color:#c0392b">—</span><span class="stat-lbl">Active Incidents</span></div>
  <div class="stat-div"></div>
  <div class="stat-item"><span class="stat-num" id="sMales">—</span><span class="stat-lbl">Male</span></div>
  <div class="stat-div"></div>
  <div class="stat-item"><span class="stat-num" id="sFemales">—</span><span class="stat-lbl">Female</span></div>
  <div class="stat-div"></div>
  <div class="stat-item"><span class="stat-num" id="sSeniors" style="color:#5a1a9a">—</span><span class="stat-lbl">Senior Citizens</span></div>
  <div class="stat-div"></div>
  <div class="stat-item"><span class="stat-num" id="sPwd" style="color:#e65100">—</span><span class="stat-lbl">PWD</span></div>
</div>

<!-- MAP PAGE (default for all visitors) -->
<div class="page active" id="page-map">
  <div class="map-layout">
    <!-- Mobile sidebar overlay backdrop -->
    <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="closeMobileSidebar()"></div>
    <!-- Mobile sidebar toggle button (on map) -->
    <button class="mob-sidebar-btn" id="mobSidebarBtn" onclick="toggleMobileSidebar()" aria-label="Toggle sidebar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>
      <span>Layers</span>
    </button>
    <div class="map-sidebar" id="mapSidebar">
      <div class="sidebar-tabs">
        <button class="stab" onclick="sidebarTab('streets-tab')">Streets</button>
        <button class="stab" onclick="sidebarTab('facilities-list')">Facilities</button>
        <button class="stab active" onclick="sidebarTab('incidents-list')">Incidents</button>
      </div>
      <div class="sidebar-body hidden" id="sbStreets">
        <div class="sb-actions" id="addHouseBtn" style="display:none">
          <button class="btn-sm btn-primary" onclick="openAddHouseModal()">+ Add House</button>
        </div>
        <div id="streetList"><div class="loading-state">Loading...</div></div>
      </div>
      <div class="sidebar-body hidden" id="sbFacilities">
        <div class="sb-actions" id="addFacilityBtn" style="display:none">
          <button class="btn-sm btn-primary" onclick="openFacilityModal()">+ Add Facility</button>
        </div>
        <div class="fcat-filter">
          <select id="facCatFilter" class="form-control" onchange="loadSidebarFacilities()" style="font-size:.78rem;padding:5px 8px">
            <option value="">All Categories</option>
            <option value="government">Government</option>
            <option value="health">Health</option>
            <option value="education">Education</option>
            <option value="religious">Religious</option>
            <option value="commercial">Commercial</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="landmark">Landmark</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div id="facilityList"><div class="loading-state">Loading...</div></div>
      </div>
      <!-- Active Incidents sidebar panel -->
      <div class="sidebar-body" id="sbIncidents">
        <div class="street-hint">Active incidents — click to focus on map</div>
        <div id="activeIncidentList"><div class="loading-state">Loading...</div></div>
      </div>
      <!-- Hidden stubs so JS references don't break -->
      <div style="display:none">
        <div id="reportIncidentSidebarBtn"></div>
        <div id="officialIncidentNote"></div>
        <select id="incStatusFilter"></select>
        <div id="incidentList"></div>
      </div>
    </div>
    <div class="map-container">
      <div id="map"></div>
      <!-- Floating Report Incident button -->
      <button class="map-report-btn" id="mapReportBtn" onclick="openIncidentModal()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>
        Report Incident
      </button>
      <button class="check-status-link" id="checkStatusBtn" onclick="openModal('checkStatusModal')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px"><path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
        Check Report Status
      </button>
      <!-- Locate Me button -->
      <button class="locate-me-btn" id="locateMeBtn" onclick="locateMe()" title="Show my location">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="7"/>
          <circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none"/>
          <line x1="12" y1="2" x2="12" y2="5"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="5" y2="12"/>
          <line x1="19" y1="12" x2="22" y2="12"/>
        </svg>
      </button>
      <div class="map-legend">
        <div class="leg-title">Legend</div>
        <div class="leg-item"><span class="leg-dot" style="background:#1f5c32"></span>Street</div>
        <div class="leg-item"><span class="leg-dot" style="background:#e67e22"></span>House</div>
        <div class="leg-item"><span class="leg-dot" style="background:#7b3fa0"></span>Purok</div>
        <div class="leg-item"><span class="leg-dot" style="background:#1a4f8a"></span>Facility</div>
        <div class="leg-item"><span class="leg-dot" style="background:#c0392b"></span>Incident</div>
      </div>
    </div>
  </div>
</div>

<!-- POPULATION PAGE (admin/official only) -->
<div class="page" id="page-population">
  <div class="page-content">
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap">
      <div>
        <h2>Population Summary Report</h2>
        <p>Household &amp; resident records — Barangay Cabugao</p>
      </div>
      <div class="report-dropdown official-only-el" style="display:none">
        <button class="btn-primary" onclick="toggleReportDropdown(event)">
          Generate Report
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="report-dropdown-menu" id="reportDropdownMenu">
          <button onclick="closeReportDropdown();window.location.href='api/index.php?action=fh_hh_report'">Family &amp; Household Heads Report (DOC)</button>
          <button onclick="closeReportDropdown();downloadPwdReportCsv()">PWD Name List (CSV)</button>
        </div>
      </div>
    </div>
    <div id="popContent"><div class="loading-state">Loading...</div></div>
  </div>
</div>

<!-- FACILITIES PAGE (admin/official only) -->
<!-- INCIDENTS PAGE (admin only) -->
<div class="page" id="page-incidents">
  <div class="page-content">
    <div class="page-header">
      <h2>Resolved Incidents</h2>
      <p style="color:var(--ink-lt);font-size:.84rem;margin-top:2px">Archive of resolved incident reports — currently active incidents are on the Map tab</p>
    </div>
    <!-- List + (Filters above Map). The sidebar and the filter bar are
         both direct children of this row, so their top edges align —
         the filter bar sits only above the map, not above the sidebar,
         and the map's height yields to make room for it above. -->
    <div id="irSplit" style="display:flex;gap:12px;flex:1;min-height:0">
      <div id="irListPanel" style="width:260px;flex-shrink:0;background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;display:flex;flex-direction:column;min-height:0">
        <div id="irListItems" style="flex:1;overflow-y:auto"></div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0">
        <!-- Bare filter row — no card wrapper (no background/border/padding),
             so it takes minimal vertical space and the map card below gets
             a bit more height. -->
        <div id="irFilterBar" style="flex-shrink:0;display:flex;flex-wrap:wrap;gap:6px">
          <select id="irYear" class="form-control" onchange="loadIncidentReport()"></select>
          <select id="irMonth" class="form-control" onchange="loadIncidentReport()">
            <option value="">All Months</option>
            <option value="1">January</option><option value="2">February</option>
            <option value="3">March</option><option value="4">April</option>
            <option value="5">May</option><option value="6">June</option>
            <option value="7">July</option><option value="8">August</option>
            <option value="9">September</option><option value="10">October</option>
            <option value="11">November</option><option value="12">December</option>
          </select>
          <select id="irCat" class="form-control" onchange="updateIrSubtypeFilter();loadIncidentReport()">
            <option value="">All Types</option>
            <option value="fire">Fire</option>
            <option value="accident">Accident</option>
            <option value="crime">Crime</option>
            <option value="other">Other</option>
          </select>
          <!-- Always visible now (not hidden) — disabled instead when there's
               no specific type selected, since a subtype filter has nothing
               to narrow down against "All Types". -->
          <select id="irSubtype" class="form-control" disabled onchange="loadIncidentReport()">
            <option value="">All Subtypes</option>
          </select>
          <button class="btn-secondary" style="flex-shrink:0" onclick="resetIrFilters()">Reset</button>
        </div>
        <div class="ir-map-wrap" style="flex:1;border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;position:relative;min-height:0">
          <div id="irMap" style="width:100%;height:100%"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ADMIN PAGE -->
<div class="page" id="page-admin">
  <div class="page-content">
    <div class="page-header">
      <h2>Admin Dashboard</h2>
      <p id="adminWelcome">Welcome</p>
    </div>
    <div class="admin-tabs">
      <!-- Pending Reports, Facilities, Streets, and Puroks stay hidden
           from Super Admin — same reasoning as the top nav: Super Admin's
           role is scoped to account management and activity monitoring,
           while regular Admin handles this day-to-day work. -->
      <button class="adtab active not-superadmin-tab" onclick="adminTab('pending')">Pending Reports <span id="pendingBadge" class="pending-badge" style="display:none">0</span></button>
      <button class="adtab admin-only-tab not-superadmin-tab" onclick="adminTab('facilities')" id="facilitiesTab">Facilities</button>
      <button class="adtab admin-only-tab not-superadmin-tab" onclick="adminTab('streets')" id="streetsTab">Streets</button>
      <button class="adtab admin-only-tab not-superadmin-tab" onclick="adminTab('puroks')" id="puroksTab">Puroks</button>
      <button class="adtab superadmin-only-tab" onclick="adminTab('users')" id="usersTab" style="display:none">Users</button>
      <button class="adtab superadmin-only-tab" onclick="adminTab('activitylog')" id="activityLogTab" style="display:none">Activity Log</button>
    </div>

    <!-- PENDING INCIDENTS -->
    <div class="admin-panel active" id="ap-pending">
      <div class="admin-card">
        <div class="admin-card-hd"><h3>Pending Incident Reports — Awaiting Approval</h3></div>
        <div class="admin-card-bd" id="pendingList"><div class="loading-state">Loading...</div></div>
      </div>
    </div>

    <!-- FACILITIES -->
    <div class="admin-panel" id="ap-facilities">
      <div class="page-header-row" style="margin-bottom:16px">
        <div>
          <h3 style="font-family:'DM Sans',sans-serif;font-size:1.2rem;font-weight:700;color:var(--ink)">Facilities &amp; Landmarks</h3>
          <p style="color:var(--ink-lt);font-size:.84rem;margin-top:4px">Schools, health centers, government offices, and more</p>
        </div>
        <button class="btn-primary" id="addFacilityPageBtn" onclick="openFacilityModal()">+ Add Facility</button>
      </div>
      <div class="cat-pills" id="catPills">
        <button class="cat-pill active" onclick="filterFacilitiesPage('')">All</button>
        <button class="cat-pill cat-pill-government" onclick="filterFacilitiesPage('government')">Government</button>
        <button class="cat-pill cat-pill-health" onclick="filterFacilitiesPage('health')">Health</button>
        <button class="cat-pill cat-pill-education" onclick="filterFacilitiesPage('education')">Education</button>
        <button class="cat-pill cat-pill-religious" onclick="filterFacilitiesPage('religious')">Religious</button>
        <button class="cat-pill cat-pill-commercial" onclick="filterFacilitiesPage('commercial')">Commercial</button>
        <button class="cat-pill cat-pill-infrastructure" onclick="filterFacilitiesPage('infrastructure')">Infrastructure</button>
        <button class="cat-pill cat-pill-landmark" onclick="filterFacilitiesPage('landmark')">Landmark</button>
      </div>
      <div id="facilitiesGrid" style="margin-top:16px"><div class="loading-state">Loading...</div></div>
    </div>

    <!-- STREETS -->
    <div class="admin-panel" id="ap-streets">
      <div class="admin-card">
        <div class="admin-card-hd"><h3 id="streetFormTitle">Add New Street</h3></div>
        <div class="admin-card-bd">
          <div class="form-row">
            <div class="form-group"><label>Street Name *</label><input type="text" id="nsName" class="form-control" placeholder="e.g. San Roque Street"></div>
            <div class="form-group"><label>Description</label><input type="text" id="nsDesc" class="form-control" placeholder="Optional"></div>
          </div>
          <div class="form-group mt-2">
            <label>Pin Street Location on Map</label>
            <div class="pin-map-wrap">
              <div class="pin-map-label">Click on the map to mark this street's location</div>
              <div id="streetPinMap"></div>
              <div id="streetPinInfo" class="pin-info" style="display:none">
                Pinned at: <strong id="streetPinCoord"></strong>
                <button onclick="clearStreetPin()" class="btn-clr">✕ Clear</button>
              </div>
              <div id="streetPinEmpty" class="pin-empty">No pin placed yet</div>
            </div>
          </div>
          <input type="hidden" id="nsLat">
          <input type="hidden" id="nsLng">
          <div id="nsErr" class="err-msg" style="display:none"></div>
          <button class="btn-primary mt-2" id="nsSubmitBtn" onclick="addStreet()">Add Street</button>
          <a href="javascript:void(0)" id="nsCancelEdit" onclick="cancelEditStreet()" style="display:none;margin-left:10px;font-size:.82rem;color:var(--ink-lt)">Cancel edit</a>
        </div>
      </div>
      <div class="admin-card mt-2">
        <div class="admin-card-hd"><h3>Current Streets</h3></div>
        <div class="admin-card-bd" id="adminStreets"><div class="loading-state">Loading...</div></div>
      </div>
    </div>


    <!-- PUROKS -->
    <div class="admin-panel" id="ap-puroks">
      <div class="admin-card">
        <div class="admin-card-hd"><h3 id="purokFormTitle">Add New Purok</h3></div>
        <div class="admin-card-bd">
          <div class="form-row">
            <div class="form-group">
              <label>Parent Street *</label>
              <select id="purokStreet" class="form-control">
                <option value="">Select street...</option>
              </select>
            </div>
            <div class="form-group">
              <label>Purok Name *</label>
              <input type="text" id="purokName" class="form-control" placeholder="e.g. Purok 1 or Purok Sampaguita">
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <input type="text" id="purokDesc" class="form-control" placeholder="Optional">
          </div>
          <div class="form-group mt-2">
            <label>Pin Purok Location on Map</label>
            <div class="pin-map-wrap">
              <div class="pin-map-label">Click on the map to mark this purok's location</div>
              <div id="purokPinMap"></div>
              <div id="purokPinInfo" class="pin-info" style="display:none">
                Pinned at: <strong id="purokPinCoord"></strong>
                <button onclick="clearPurokPin()" class="btn-clr">✕ Clear</button>
              </div>
              <div id="purokPinEmpty" class="pin-empty">No pin placed yet</div>
            </div>
          </div>
          <input type="hidden" id="purokLat">
          <input type="hidden" id="purokLng">
          <div id="purokErr" class="err-msg" style="display:none"></div>
          <button class="btn-primary mt-2" id="purokSubmitBtn" onclick="addPurok()">Add Purok</button>
          <a href="javascript:void(0)" id="purokCancelEdit" onclick="cancelEditPurok()" style="display:none;margin-left:10px;font-size:.82rem;color:var(--ink-lt)">Cancel edit</a>
        </div>
      </div>
      <div class="admin-card mt-2">
        <div class="admin-card-hd"><h3>Current Puroks</h3></div>
        <div class="admin-card-bd" id="adminPurokList"><div class="loading-state">Loading...</div></div>
      </div>
    </div>

    <!-- USERS (Super Admin only) -->
    <div class="admin-panel" id="ap-users">
      <div class="admin-card">
        <div class="admin-card-hd"><h3>Add New Admin Account</h3></div>
        <div class="admin-card-bd">
          <p class="hint">New accounts are Barangay Officials with regular Admin access — they can approve incidents, update statuses, and add notes. A Gmail address is required for each account for password/account recovery purposes. Only you (Super Admin) can create accounts or deactivate them.</p>
          <div class="form-row">
            <div class="form-group"><label>Full Name *</label><input type="text" id="uaName" class="form-control" placeholder="e.g. Juan Dela Cruz"></div>
            <div class="form-group"><label>Username *</label><input type="text" id="uaUser" class="form-control" placeholder="e.g. jdelacruz"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Password *</label>
              <div class="pass-field-wrap">
                <input type="password" id="uaPass" class="form-control" placeholder="Min. 6 characters">
                <button type="button" class="pass-toggle-btn" title="Show password" onclick="togglePasswordVisibility('uaPass',this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg></button>
              </div>
            </div>
            <div class="form-group"><label>Gmail Address * <span class="hint" style="font-weight:400">(for account recovery)</span></label><input type="email" id="uaEmail" class="form-control" placeholder="e.g. jdelacruz@gmail.com"></div>
          </div>
          <div id="uaErr" class="err-msg" style="display:none"></div>
          <button class="btn-primary mt-2" onclick="addAdminAccount()">+ Create Admin Account</button>
        </div>
      </div>
      <div class="admin-card mt-2">
        <div class="admin-card-hd"><h3>All Accounts</h3></div>
        <div class="admin-card-bd" id="usersTable"><div class="loading-state">Loading...</div></div>
      </div>
    </div>

    <!-- ACTIVITY LOG (Super Admin only) -->
    <div class="admin-panel" id="ap-activitylog">
      <div class="admin-card">
        <div class="admin-card-hd"><h3>Database Backup</h3></div>
        <div class="admin-card-bd">
          <p class="hint mb-2">Downloads a complete, restorable copy of the database — every street, purok, house, resident, facility, incident, account, and log entry, as one <code>.sql</code> file. If anything ever goes wrong (hosting issue, accidental deletion, account suspension), this file can be re-imported via phpMyAdmin's Import tab to bring everything back exactly as it was. Keep recent copies somewhere safe — your own computer, Google Drive, etc. — not just on the server itself.</p>
          <button class="btn-primary" onclick="downloadBackup()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg> Download Backup Now</button>
        </div>
      </div>
      <div class="admin-card mt-2">
        <div class="admin-card-hd" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <h3>System Activity Log</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <select id="alUser" class="form-control" style="font-size:.82rem;padding:5px 8px;width:auto" onchange="loadActivityLog()">
              <option value="">All Accounts</option>
            </select>
            <select id="alAction" class="form-control" style="font-size:.82rem;padding:5px 8px;width:auto" onchange="loadActivityLog()">
              <option value="">All Actions</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="incident_report">Incident Reported</option>
              <option value="incident_approve">Incident Approved</option>
              <option value="incident_reject">Incident Rejected</option>
              <option value="incident_update">Incident Updated</option>
              <option value="incident_delete">Incident Deleted</option>
              <option value="house_add">House Added</option>
              <option value="house_edit">House Edited</option>
              <option value="house_delete">House Deleted</option>
              <option value="member_add">Resident Added</option>
              <option value="member_edit">Resident Edited</option>
              <option value="member_delete">Resident Deleted</option>
              <option value="street_add">Street Added</option>
              <option value="street_delete">Street Deleted</option>
              <option value="purok_add">Purok Added</option>
              <option value="purok_delete">Purok Deleted</option>
              <option value="facility_add">Facility Added</option>
              <option value="facility_edit">Facility Edited</option>
              <option value="facility_delete">Facility Deleted</option>
              <option value="user_create">Admin Created</option>
              <option value="user_toggle">Admin Activated/Deactivated</option>
              <option value="user_delete">Admin Deleted</option>
              <option value="bulk_import">Bulk Import</option>
              <option value="change_password">Password Changed</option>
              <option value="update_profile">Profile Updated</option>
            </select>
          </div>
        </div>
        <div class="admin-card-bd">
          <p class="hint mb-2">Every account-attributable action taken in the system, with the account, role, and timestamp recorded automatically — this is the system's record of who did what.</p>
          <div style="overflow-x:auto">
            <table id="alTable">
              <thead><tr><th>Date/Time</th><th>Account</th><th>Action</th><th>Details</th></tr></thead>
              <tbody id="alTableBody"><tr><td colspan="4" class="loading-state">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ==================== MODALS ==================== -->

<!-- LOGIN (admin/official only) -->
<div id="loginLanding">
  <div class="login-split">
    <div class="login-split-brand">
      <img src="assets/img/logo.jpg" alt="INSPIRE logo">
      <h1>INSPIRE</h1>
      <p>Barangay information and incident reporting system for Brgy. Cabugao, Bato, Catanduanes.</p>
    </div>
    <div class="login-split-form">
      <h3>Admin Login</h3>
      <div class="form-group"><label>Username</label><input type="text" id="lUser" class="form-control" placeholder="Enter username" autocomplete="username"></div>
      <div class="form-group"><label>Password</label>
        <div class="pass-field-wrap">
          <input type="password" id="lPass" class="form-control" placeholder="Enter password" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
          <button type="button" class="pass-toggle-btn" title="Show password" onclick="togglePasswordVisibility('lPass',this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg></button>
        </div>
      </div>
      <div id="loginErr" class="err-msg" style="display:none"></div>
      <button class="btn-primary full" style="margin-top:4px" onclick="doLogin()">Sign In</button>
      <p class="tc mt-2"><a href="javascript:void(0)" onclick="openModal('forgotPassModal')" style="font-size:.78rem;color:var(--green);font-weight:600;text-decoration:none">Forgot password?</a></p>
      <p class="hint mt-2 tc" style="font-size:.74rem">Access restricted to Administrators only</p>
      <p class="tc mt-3"><a href="javascript:void(0)" onclick="window.location.href=window.location.pathname" style="font-size:.82rem;color:var(--ink-lt);text-decoration:none">← Back to public map</a></p>
    </div>
  </div>
</div>

<!-- FORGOT PASSWORD — request reset link -->
<div class="modal-overlay" id="forgotPassModal" onclick="closeModal('forgotPassModal')">
  <div class="modal" onclick="e(event)" style="max-width:380px">
    <div class="modal-hd"><h3>Recover Account</h3><button class="modal-x" onclick="closeModal('forgotPassModal')">✕</button></div>
    <div class="modal-bd">
      <p class="hint mb-2">Enter the Gmail address linked to your admin account. We'll send a password reset link to that email.</p>
      <div class="form-group"><label>Gmail Address</label><input type="email" id="fpEmail" class="form-control" placeholder="Enter your Gmail address" onkeydown="if(event.key==='Enter')submitForgotPassword()"></div>
      <div id="fpErr" class="err-msg" style="display:none"></div>
      <div id="fpOk" style="display:none;background:#e8f5e9;color:#2e7d32;padding:10px 12px;border-radius:var(--r);font-size:.82rem;margin-bottom:10px">✅ If that account exists, a reset link has been sent to that Gmail address. Check your inbox (and spam folder).</div>
      <button class="btn-primary full" onclick="submitForgotPassword()">Send Reset Link</button>
      <p class="tc mt-2"><a href="javascript:void(0)" onclick="closeModal('forgotPassModal');openModal('useRecoveryModal')" style="font-size:.76rem;color:var(--ink-lt);text-decoration:none">Lost access to your Gmail too? Use a recovery code</a></p>
      <p class="tc mt-2"><a href="javascript:void(0)" onclick="closeModal('forgotPassModal')" style="font-size:.78rem;color:var(--ink-lt);text-decoration:none">← Back to login</a></p>
    </div>
  </div>
</div>

<!-- RESET PASSWORD — set new password from emailed link -->
<div class="modal-overlay" id="resetPassModal">
  <div class="modal" onclick="e(event)" style="max-width:380px">
    <div class="modal-hd"><h3>Set New Password</h3></div>
    <div class="modal-bd">
      <input type="hidden" id="rpToken">
      <div class="form-group"><label>New Password</label>
        <div class="pass-field-wrap">
          <input type="password" id="rpNewPass" class="form-control" placeholder="Min. 6 characters">
          <button type="button" class="pass-toggle-btn" title="Show password" onclick="togglePasswordVisibility('rpNewPass',this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg></button>
        </div>
      </div>
      <div class="form-group"><label>Confirm New Password</label>
        <div class="pass-field-wrap">
          <input type="password" id="rpConfirmPass" class="form-control" placeholder="Re-enter new password" onkeydown="if(event.key==='Enter')submitResetPassword()">
          <button type="button" class="pass-toggle-btn" title="Show password" onclick="togglePasswordVisibility('rpConfirmPass',this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg></button>
        </div>
      </div>
      <div id="rpErr" class="err-msg" style="display:none"></div>
      <div id="rpOk" style="display:none;background:#e8f5e9;color:#2e7d32;padding:10px 12px;border-radius:var(--r);font-size:.82rem;margin-bottom:10px">✅ Password updated! You can now log in.</div>
      <button class="btn-primary full" onclick="submitResetPassword()">Update Password</button>
      <p class="tc mt-2"><a href="javascript:void(0)" onclick="cancelPasswordReset()" style="font-size:.78rem;color:var(--ink-lt);text-decoration:none">Cancel</a></p>
    </div>
  </div>
</div>

<!-- PHOTO LIGHTBOX -->
<div class="photo-lightbox" id="photoLightbox" onclick="closePhotoLightbox()">
  <button class="photo-lightbox-close" onclick="closePhotoLightbox()">✕</button>
  <img id="photoLightboxImg" src="" alt="Photo proof" onclick="event.stopPropagation()">
</div>

<!-- PROFILE / CHANGE PASSWORD -->
<div class="modal-overlay" id="profileModal" onclick="closeModal('profileModal')">
  <div class="modal" onclick="e(event)" style="max-width:380px">
    <div class="modal-hd"><h3>My Profile</h3><button class="modal-x" onclick="closeModal('profileModal')">✕</button></div>
    <div class="modal-bd">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        <div style="width:46px;height:46px;border-radius:var(--r);background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0" id="profileAvatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px"><path d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg></div>
        <div>
          <div style="font-weight:700;font-size:.95rem;color:var(--ink)" id="profileName">—</div>
          <div style="font-size:.78rem;color:var(--ink-lt)" id="profileRole">—</div>
        </div>
      </div>
      <div style="font-size:.82rem;font-weight:700;color:var(--ink-mid);text-transform:uppercase;letter-spacing:.3px;margin-bottom:10px">Profile Info</div>
      <div class="form-group"><label>Full Name</label><input type="text" id="profEditName" class="form-control" placeholder="Your full name"></div>
      <div class="form-group"><label>Username</label><input type="text" id="profEditUser" class="form-control" disabled style="background:var(--bg);color:var(--ink-lt)"></div>
      <div class="form-group"><label>Gmail Address</label><input type="email" id="profEditEmail" class="form-control" placeholder="e.g. you@gmail.com"></div>
      <div id="profInfoErr" class="err-msg" style="display:none"></div>
      <button class="btn-secondary full mb-2" onclick="saveProfileInfo()">Save Profile Info</button>
      <hr style="margin:18px 0;border:none;border-top:1px solid var(--border)">

      <div style="font-size:.82rem;font-weight:700;color:var(--ink-mid);text-transform:uppercase;letter-spacing:.3px;margin-bottom:10px">Change Password</div>
      <div class="form-group"><label>Current Password</label>
        <div class="pass-field-wrap">
          <input type="password" id="pCurrentPass" class="form-control" placeholder="Enter current password" autocomplete="current-password">
          <button type="button" class="pass-toggle-btn" title="Show password" onclick="togglePasswordVisibility('pCurrentPass',this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg></button>
        </div>
      </div>
      <div class="form-group"><label>New Password</label>
        <div class="pass-field-wrap">
          <input type="password" id="pNewPass" class="form-control" placeholder="Enter new password" autocomplete="new-password">
          <button type="button" class="pass-toggle-btn" title="Show password" onclick="togglePasswordVisibility('pNewPass',this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg></button>
        </div>
      </div>
      <div class="form-group"><label>Confirm New Password</label>
        <div class="pass-field-wrap">
          <input type="password" id="pConfirmPass" class="form-control" placeholder="Re-enter new password" autocomplete="new-password" onkeydown="if(event.key==='Enter')submitPasswordChange()">
          <button type="button" class="pass-toggle-btn" title="Show password" onclick="togglePasswordVisibility('pConfirmPass',this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg></button>
        </div>
      </div>
      <div id="profileErr" class="err-msg" style="display:none"></div>
      <div id="profileOk" style="display:none;background:#e8f5e9;color:#2e7d32;padding:8px 12px;border-radius:var(--r);font-size:.82rem;margin-bottom:10px">✅ Password updated successfully.</div>
      <button class="btn-primary full" onclick="submitPasswordChange()">Update Password</button>

      <div id="profRecoverySection" style="display:none">
        <hr style="margin:18px 0;border:none;border-top:1px solid var(--border)">
        <div style="font-size:.82rem;font-weight:700;color:var(--ink-mid);text-transform:uppercase;letter-spacing:.3px;margin-bottom:10px">⚠ Account Recovery Code</div>
        <p class="hint mb-2">A "master key" for the one situation the normal password reset can't cover: losing access to <b>both</b> your password and your Gmail at the same time. Generate it once, write it down somewhere safe (paper, a password manager — not your email), and keep it private. It works exactly once; using it generates a new password and instantly invalidates the old code.</p>
        <div id="profRecoveryStatus" style="font-size:.82rem;margin-bottom:10px"></div>
        <button class="btn-secondary full" onclick="generateRecoveryCode()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z"/></svg> Generate New Recovery Code</button>
      </div>

      <hr style="margin:18px 0;border:none;border-top:1px solid var(--border)">
      <button class="btn-danger full" onclick="closeModal('profileModal');doLogout()">Logout</button>
    </div>
  </div>
</div>

<!-- RECOVERY CODE — shown once at generation time -->
<div class="modal-overlay" id="recoveryCodeModal">
  <div class="modal" onclick="e(event)" style="max-width:380px">
    <div class="modal-hd"><h3>⚠ Save This Now</h3></div>
    <div class="modal-bd" style="text-align:center">
      <p class="hint" style="margin-bottom:14px">This code will <b>never be shown again</b>. Write it down or save it somewhere safe — not in your email. Any previous recovery code is now invalid.</p>
      <div style="background:var(--bg);border:1.5px dashed var(--red);border-radius:var(--r-lg);padding:16px;margin-bottom:18px">
        <div id="recoveryCodeDisplay" style="font-family:monospace;font-size:1.3rem;font-weight:700;color:var(--ink);letter-spacing:1px;word-break:break-all">—</div>
      </div>
      <button class="btn-secondary full mb-2" onclick="copyRecoveryCode()">📋 Copy Code</button>
      <button class="btn-primary full" onclick="closeModal('recoveryCodeModal')">I've Saved It Securely</button>
    </div>
  </div>
</div>

<!-- USE RECOVERY CODE — break-glass login recovery -->
<div class="modal-overlay" id="useRecoveryModal">
  <div class="modal" onclick="e(event)" style="max-width:380px">
    <div class="modal-hd"><h3>Use Recovery Code</h3><button class="modal-x" onclick="closeModal('useRecoveryModal')">✕</button></div>
    <div class="modal-bd">
      <p class="hint mb-2">For when you can't log in <b>and</b> can't access the Gmail linked to your account. Enter your username, your recovery code, and the new password you want.</p>
      <div class="form-group"><label>Username</label><input type="text" id="rcUser" class="form-control" placeholder="Enter your username"></div>
      <div class="form-group"><label>Recovery Code</label><input type="text" id="rcCode" class="form-control" placeholder="XXXX-XXXX-XXXX-XXXX" style="font-family:monospace;text-transform:uppercase"></div>
      <div class="form-group"><label>New Password</label>
        <div class="pass-field-wrap">
          <input type="password" id="rcNewPass" class="form-control" placeholder="Min. 6 characters">
          <button type="button" class="pass-toggle-btn" title="Show password" onclick="togglePasswordVisibility('rcNewPass',this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg></button>
        </div>
      </div>
      <div id="rcErr" class="err-msg" style="display:none"></div>
      <div id="rcOk" style="display:none;background:#e8f5e9;color:#2e7d32;padding:10px 12px;border-radius:var(--r);font-size:.82rem;margin-bottom:10px">✅ Password reset! You can log in now.</div>
      <button class="btn-primary full" onclick="submitRecoveryCode()">Reset Password</button>
      <p class="tc mt-2"><a href="javascript:void(0)" onclick="closeModal('useRecoveryModal')" style="font-size:.78rem;color:var(--ink-lt);text-decoration:none">← Back to login</a></p>
    </div>
  </div>
</div>

<!-- HOUSE DETAIL -->
<div class="modal-overlay" id="houseModal" onclick="closeModal('houseModal')">
  <div class="modal" onclick="e(event)">
    <div class="modal-hd"><h3 id="houseMTitle">Household</h3><button class="modal-x" onclick="closeModal('houseModal')">✕</button></div>
    <div class="modal-bd" id="houseMBody">Loading...</div>
  </div>
</div>

<!-- ADD/EDIT MEMBER -->
<div class="modal-overlay" id="addMemberModal" onclick="closeModal('addMemberModal')">
  <div class="modal" onclick="e(event)">
    <div class="modal-hd"><h3 id="memberFormTitle">+ Add New Member</h3><button class="modal-x" onclick="cancelEditMember()">✕</button></div>
    <div class="modal-bd">
      <div class="form-row">
        <div class="form-group"><label>First Name *</label><input type="text" id="mFn" class="form-control" placeholder="Juan"></div>
        <div class="form-group"><label>Middle Name</label><input type="text" id="mMn" class="form-control" placeholder="Santos"></div>
      </div>
      <div class="form-group"><label>Last Name *</label><input type="text" id="mLn" class="form-control" placeholder="Dela Cruz"></div>
      <div class="form-row">
        <div class="form-group"><label>Gender *</label>
          <div class="radio-group">
            <label class="radio-opt"><input type="radio" name="mGen" value="male"> Male</label>
            <label class="radio-opt"><input type="radio" name="mGen" value="female"> Female</label>
          </div>
        </div>
        <div class="form-group">
          <label>Date of Birth *</label>
          <input type="date" id="mBirth" class="form-control" onchange="showAgePreview()">
          <div id="mAgePreview" style="font-size:.76rem;color:#2563eb;margin-top:4px;font-weight:600"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="radio-opt" style="gap:8px">
          <input type="checkbox" id="mPwd" style="width:15px;height:15px;accent-color:#2563eb">
          <span>Person with Disability (PWD)</span>
        </label>
      </div>
      <div class="form-group" id="mHouseholdHeadRow">
        <label class="radio-opt" style="gap:8px">
          <input type="checkbox" id="mHouseholdHead" style="width:15px;height:15px;accent-color:#2563eb">
          <span>Household Head <span style="font-weight:400;color:var(--ink-lt)">(one per house)</span></span>
        </label>
      </div>
      <div class="form-group">
        <label class="radio-opt" style="gap:8px">
          <input type="checkbox" id="mFamilyHead" style="width:15px;height:15px;accent-color:#2563eb">
          <span>Family Head <span style="font-weight:400;color:var(--ink-lt)">(a house can have more than one family)</span></span>
        </label>
      </div>
      <div id="mErr" class="err-msg" style="display:none"></div>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary" style="flex:1;justify-content:center" onclick="cancelEditMember()">Cancel</button>
        <button class="btn-primary" id="memberSubmitBtn" style="flex:1;justify-content:center" onclick="submitMember()">Add Member</button>
      </div>
    </div>
  </div>
</div>

<!-- ADD/EDIT HOUSE -->
<div class="modal-overlay" id="addHouseModal" onclick="closeModal('addHouseModal')">
  <div class="modal modal-wide" onclick="e(event)">
    <div class="modal-hd"><h3 id="addHouseTitle">Add House</h3><button class="modal-x" onclick="closeModal('addHouseModal')">✕</button></div>
    <div class="modal-bd">
      <div class="pin-map-wrap">
        <div class="pin-map-label">Click the map to pin house location</div>
        <div id="pinMap"></div>
        <div id="ahOob" class="pin-oob-warn">Location is outside Barangay Cabugao boundaries</div>
        <div id="pinInfo" class="pin-info" style="display:none"><strong id="pinCoord"></strong> <button onclick="clearPin()" class="btn-clr">✕ Clear</button></div>
        <div id="pinEmpty" class="pin-empty">No pin placed — click the map to set location</div>
      </div>
      <div class="form-row mt-2">
        <div class="form-group">
          <label>Latitude</label>
          <input type="text" inputmode="decimal" id="ahLatInput" class="form-control" placeholder="e.g. 13.596108">
        </div>
        <div class="form-group">
          <label>Longitude</label>
          <input type="text" inputmode="decimal" id="ahLngInput" class="form-control" placeholder="e.g. 124.281265">
        </div>
      </div>
      <button class="btn-secondary full" style="margin-top:2px" onclick="applyManualHouseCoords()">Set Pin from Coordinates</button>
      <div id="ahCoordErr" class="err-msg" style="display:none;margin-top:6px"></div>
      <div class="form-row mt-2">
        <div class="form-group">
          <label>Street *</label>
          <select id="ahStreet" class="form-control" onchange="onHouseStreetChange()">
            <option value="">Select street...</option>
          </select>
        </div>
        <div class="form-group">
          <label>Purok *</label>
          <select id="ahPurok" class="form-control">
            <option value="">Select purok...</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>House Number *</label><input type="text" id="ahNum" class="form-control" placeholder="e.g. 12 or Block 3 Lot 5" onblur="formatHouseNumber()"></div>
      <input type="hidden" id="ahLat"><input type="hidden" id="ahLng"><input type="hidden" id="ahId">
      <div id="ahErr" class="err-msg" style="display:none"></div>
      <button class="btn-primary full" onclick="submitHouse()">Save House</button>
    </div>
  </div>
</div>

<!-- ADD/EDIT FACILITY -->
<div class="modal-overlay" id="facilityModal" onclick="closeModal('facilityModal')">
  <div class="modal modal-wide" onclick="e(event)">
    <div class="modal-hd"><h3 id="facilityModalTitle">Add Facility</h3><button class="modal-x" onclick="closeModal('facilityModal')">✕</button></div>
    <div class="modal-bd">
      <div class="pin-map-wrap">
        <div class="pin-map-label">Click the map to pin facility location</div>
        <div id="facPinMap"></div>
        <div id="fOob" class="pin-oob-warn">Location is outside Barangay Cabugao boundaries</div>
        <div id="facPinInfo" class="pin-info" style="display:none"><strong id="facPinCoord"></strong> <button onclick="clearFacPin()" class="btn-clr">✕ Clear</button></div>
        <div id="facPinEmpty" class="pin-empty">No pin placed yet</div>
      </div>
      <div class="form-row mt-2">
        <div class="form-group"><label>Facility Name *</label><input type="text" id="fName" class="form-control"></div>
        <div class="form-group">
          <label>Category *</label>
          <select id="fCat" class="form-control">
            <option value="government">Government</option>
            <option value="health">Health</option>
            <option value="education">Education</option>
            <option value="religious">Religious</option>
            <option value="commercial">Commercial</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="landmark">Landmark</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Description</label><textarea id="fDesc" class="form-control" rows="2"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Address</label><input type="text" id="fAddr" class="form-control"></div>
        <div class="form-group"><label>Contact</label><input type="text" id="fContact" class="form-control"></div>
      </div>
      <div class="form-group"><label>Operating Hours</label><input type="text" id="fHours" class="form-control" placeholder="Mon–Fri 8AM–5PM"></div>
      <div class="form-group" id="facPhotoSection" style="display:none">
        <label>Photo <span style="font-weight:400;color:var(--ink-lt);text-transform:none;letter-spacing:0">(Super Admin only)</span></label>
        <label class="inc-upload-label" for="fPhoto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></svg>
          <span id="fPhotoLabel">Tap to attach a photo</span>
        </label>
        <input type="file" id="fPhoto" accept="image/*" style="display:none" onchange="handleFacPhoto(this)">
        <div id="fPhotoPreview" style="display:none;margin-top:8px">
          <img id="fPhotoImg" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
          <button type="button" onclick="removeFacPhoto()" style="margin-top:5px;font-size:.75rem;color:var(--red);background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;">✕ Remove photo</button>
        </div>
      </div>
      <input type="hidden" id="fRemovePhoto" value="">
      <input type="hidden" id="fLat"><input type="hidden" id="fLng"><input type="hidden" id="fId">
      <div id="fErr" class="err-msg" style="display:none"></div>
      <button class="btn-primary full" onclick="submitFacility()">Save Facility</button>
    </div>
  </div>
</div>

<!-- INCIDENT REPORT -->
<div class="modal-overlay" id="incidentModal" onclick="closeModal('incidentModal')">
  <div class="modal modal-wide" onclick="e(event)">
    <div class="modal-hd"><h3 id="incModalTitle">Report Incident</h3><button class="modal-x" onclick="closeModal('incidentModal')">✕</button></div>
    <div class="modal-bd">
      <!-- Honeypot — invisible to real users, bots tend to fill every field they find -->
      <div style="position:absolute;left:-9999px;top:-9999px;opacity:0;height:0;overflow:hidden" aria-hidden="true">
        <label for="iWebsite">Website</label>
        <input type="text" id="iWebsite" name="website" tabindex="-1" autocomplete="off">
      </div>
      <div class="pin-map-wrap">
        <div class="pin-map-label">Click the map to mark the incident location</div>
        <button class="use-location-btn" id="useLocationBtn" onclick="useMyLocation()" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg>
          Use My Current Location
        </button>
        <div id="incPinMap"></div>
        <div id="iOob" class="pin-oob-warn">Location is outside Barangay Cabugao boundaries</div>
        <div id="incPinInfo" class="pin-info" style="display:none"><strong id="incPinCoord"></strong> <button onclick="clearIncPin()" class="btn-clr">✕ Clear</button></div>
        <div id="incPinEmpty" class="pin-empty">Pin the location of the incident</div>
      </div>
      <div class="form-group mt-2">
        <label>Type *</label>
        <div class="select-icon-wrap">
          <span class="select-icon" id="iCatIcon"></span>
          <select id="iCat" class="form-control" onchange="updateIncTypeIcon();updateIncSubtype()">
            <option value="fire">Fire</option>
            <option value="accident">Accident</option>
            <option value="crime">Crime</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div class="form-group" id="iSubtypeGroup">
        <label>Subtype *</label>
        <select id="iSubtype" class="form-control"></select>
      </div>
      <div class="form-group">
        <label>Description *</label>
        <textarea id="iDesc" class="form-control" rows="4" placeholder="Describe what happened, where, and when..."></textarea>
      </div>
      <div class="form-group">
        <label>Urgency *</label>
        <select id="iSev" class="form-control">
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
          <option value="emergency">Emergency</option>
        </select>
      </div>
      <div class="form-group">
        <label>Photo / Proof *</label>
        <label class="inc-upload-label" for="iPhoto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></svg>
          <span id="iPhotoLabel">Tap to attach a photo</span>
        </label>
        <input type="file" id="iPhoto" accept="image/*" capture="environment" style="display:none" onchange="handleIncPhoto(this)">
        <div id="iPhotoPreview" style="display:none;margin-top:8px">
          <img id="iPhotoImg" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
          <button type="button" onclick="clearIncPhoto()" style="margin-top:5px;font-size:.75rem;color:var(--red);background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;">✕ Remove photo</button>
        </div>
      </div>
      <div class="form-group"><label>Your Name *</label><input type="text" id="iName" class="form-control" placeholder="Enter your name"></div>
      <div class="form-group"><label>Your Contact Number *</label><input type="tel" id="iContact" class="form-control" placeholder="09xxxxxxxxx" value="09" maxlength="11" oninput="formatContactNumber(this)"></div>
      <!-- Hidden fields still needed by submitIncident() -->
      <input type="hidden" id="iTitle" value="Incident Report">
      <input type="hidden" id="iAddr" value="">
      <input type="hidden" id="iLat"><input type="hidden" id="iLng"><input type="hidden" id="iId">
      <div id="iErr" class="err-msg" style="display:none"></div>
      <div class="form-group" style="display:flex;justify-content:center">
        <div id="recaptchaContainer"></div>
      </div>
      <div class="approval-note">Your report will appear on the map only after approval by a Barangay Official.</div>
      <label style="display:flex;align-items:flex-start;gap:8px;font-size:.78rem;color:var(--ink-mid);margin:10px 0;cursor:pointer">
        <input type="checkbox" id="iConsent" style="margin-top:3px;flex-shrink:0">
        <span>I understand the information I provide here (including my name, contact number, and any photo) will be used by Barangay Cabugao officials to respond to this report, and the report itself may appear on the public map once approved. <a href="javascript:void(0)" onclick="openModal('privacyModal')" style="color:var(--green);font-weight:600">Read the Privacy Notice</a></span>
      </label>
      <button class="btn-danger full" onclick="submitIncident()">Submit Report</button>
    </div>
  </div>
</div>

<!-- PRIVACY NOTICE -->
<div class="modal-overlay" id="privacyModal" onclick="closeModal('privacyModal')">
  <div class="modal modal-wide" onclick="e(event)">
    <div class="modal-hd"><h3>Privacy Notice</h3><button class="modal-x" onclick="closeModal('privacyModal')">✕</button></div>
    <div class="modal-bd" style="max-height:65vh;overflow-y:auto">
      <p class="hint mb-2" style="font-style:italic">This notice explains how INSPIRE — Barangay Cabugao's information system — collects and uses personal information, in line with the Philippine Data Privacy Act of 2012 (RA 10173).</p>

      <h4 style="margin:14px 0 6px;font-size:.92rem">What we collect</h4>
      <p style="font-size:.84rem;color:var(--ink-mid);margin-bottom:8px">Resident records (name, birth date, address, gender), household information, and — when you submit an incident report — your name, contact number, a description, location, and any photo you choose to attach. Some resident records also note PWD (Person With Disability) or Senior Citizen status, which the Data Privacy Act classifies as <b>sensitive personal information</b> requiring extra care.</p>

      <h4 style="margin:14px 0 6px;font-size:.92rem">Why we collect it</h4>
      <p style="font-size:.84rem;color:var(--ink-mid);margin-bottom:8px">To maintain accurate barangay population records, respond to and coordinate on reported incidents (fire, flood, accidents, etc.), and provide public information about barangay facilities — functions the Barangay is responsible for under local government law.</p>

      <h4 style="margin:14px 0 6px;font-size:.92rem">Who can see it</h4>
      <p style="font-size:.84rem;color:var(--ink-mid);margin-bottom:8px">Resident and household records are visible only to logged-in Admins and the Super Admin. Incident reports are visible to the public on the map only after an Admin approves them, and only for a limited time — approved reports stop showing publicly 12 hours after approval. Every account action in the system (who viewed, added, edited, or approved what) is recorded in an internal audit log accessible only to the Super Admin.</p>

      <h4 style="margin:14px 0 6px;font-size:.92rem">How long we keep it</h4>
      <p style="font-size:.84rem;color:var(--ink-mid);margin-bottom:8px">Resident records and incident reports are retained for as long as the INSPIRE system remains in active use by the Barangay.</p>

      <h4 style="margin:14px 0 6px;font-size:.92rem">Your rights</h4>
      <p style="font-size:.84rem;color:var(--ink-mid);margin-bottom:8px">Under RA 10173, you may ask to see what information we hold about you, request corrections, and object to or request deletion of your data, subject to the Barangay's recordkeeping obligations. You may also file a complaint with the National Privacy Commission (privacy.gov.ph) if you believe your data has been mishandled.</p>

      <h4 style="margin:14px 0 6px;font-size:.92rem">Questions or concerns</h4>
      <p style="font-size:.84rem;color:var(--ink-mid);margin-bottom:8px">For questions or concerns about your data, you may reach Barangay Cabugao through its official Facebook page: <a href="https://www.facebook.com/cabugaobato.lgu" target="_blank" rel="noopener" style="color:var(--green)">facebook.com/cabugaobato.lgu</a>.</p>

      <p class="hint" style="font-size:.72rem;margin-top:16px;border-top:1px solid var(--border);padding-top:10px">This notice has not been reviewed by a lawyer.</p>
    </div>
  </div>
</div>

<!-- REPORT SUBMITTED — show reference code -->
<div class="modal-overlay" id="reportSuccessModal" onclick="closeModal('reportSuccessModal')">
  <div class="modal" onclick="e(event)" style="max-width:380px">
    <div class="modal-bd" style="text-align:center;padding-top:28px">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--green-pale);color:var(--green);display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin:0 auto 14px">✅</div>
      <h3 style="font-family:'DM Sans',sans-serif;margin-bottom:6px">Report Submitted</h3>
      <p class="hint" style="margin-bottom:18px">Barangay officials have been notified. Save your reference code below to check your report's status anytime.</p>
      <div style="background:var(--bg);border:1.5px dashed var(--green-line);border-radius:var(--r-lg);padding:14px;margin-bottom:18px">
        <div style="font-size:.68rem;color:var(--ink-lt);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Reference Code</div>
        <div id="reportRefCode" style="font-family:monospace;font-size:1.4rem;font-weight:700;color:var(--green);letter-spacing:2px">—</div>
      </div>
      <button class="btn-secondary full" style="margin-bottom:8px" onclick="copyRefCode()">📋 Copy Code</button>
      <button class="btn-primary full" onclick="closeModal('reportSuccessModal')">Done</button>
    </div>
  </div>
</div>

<!-- GENERIC CONFIRM MODAL — replaces native confirm() everywhere in the app -->
<div class="modal-overlay" id="confirmModal" onclick="closeModal('confirmModal')">
  <div class="modal" onclick="e(event)" style="max-width:360px">
    <div class="modal-bd" style="text-align:center;padding-top:28px">
      <div id="confirmIconWrap" style="width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>
      </div>
      <p id="confirmMessage" style="font-size:.9rem;color:var(--ink);font-weight:500;margin-bottom:20px;line-height:1.5;white-space:pre-line"></p>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary" style="flex:1;justify-content:center" onclick="closeModal('confirmModal')">Cancel</button>
        <button class="btn-primary" id="confirmOkBtn" style="flex:1;justify-content:center" onclick="_runConfirmCallback()">Delete</button>
      </div>
    </div>
  </div>
</div>

<!-- REJECT INCIDENT WITH REASON -->
<div class="modal-overlay" id="rejectReasonModal" onclick="closeModal('rejectReasonModal')">
  <div class="modal" onclick="e(event)" style="max-width:380px">
    <div class="modal-hd"><h3>Reject Report</h3><button class="modal-x" onclick="closeModal('rejectReasonModal')">✕</button></div>
    <div class="modal-bd">
      <div class="form-group">
        <label>Reason for rejection (optional)</label>
        <textarea id="rejectReasonInput" class="form-control" rows="3" placeholder="e.g. Duplicate report, insufficient information..."></textarea>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary" style="flex:1;justify-content:center" onclick="closeModal('rejectReasonModal')">Cancel</button>
        <button class="btn-reject" style="flex:1;justify-content:center" onclick="_runRejectCallback()">Reject Report</button>
      </div>
    </div>
  </div>
</div>

<!-- CHECK REPORT STATUS -->
<div class="modal-overlay" id="checkStatusModal" onclick="closeModal('checkStatusModal')">
  <div class="modal" onclick="e(event)" style="max-width:400px">
    <div class="modal-hd"><h3>Check Report Status</h3><button class="modal-x" onclick="closeModal('checkStatusModal')">✕</button></div>
    <div class="modal-bd">
      <div class="form-group">
        <label>Reference Code</label>
        <input type="text" id="csCode" class="form-control" placeholder="e.g. RC4XJ9P2" style="text-transform:uppercase;font-family:monospace;letter-spacing:1px" onkeydown="if(event.key==='Enter')checkReportStatus()">
      </div>
      <button class="btn-primary full" onclick="checkReportStatus()">Check Status</button>
      <div id="csErr" class="err-msg mt-2" style="display:none"></div>
      <div id="csResult" style="display:none;margin-top:16px"></div>
    </div>
  </div>
</div>

<!-- INCIDENT MANAGE -->
<div class="modal-overlay" id="incManageModal" onclick="closeModal('incManageModal')">
  <div class="modal" onclick="e(event)" style="max-width:500px">
    <div class="modal-hd"><h3>Manage Incident</h3><button class="modal-x" onclick="closeModal('incManageModal')">✕</button></div>
    <div class="modal-bd" id="incManageBd">Loading...</div>
  </div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<!-- App logic split into focused modules (see assets/js/modules/) instead
     of one monolithic app.js. Plain <script> tags — no bundler needed —
     loaded in dependency order: core/shared helpers first, page-init last. -->
<script src="assets/js/modules/core.js?v=262"></script>
<script src="assets/js/modules/pinmaps.js?v=262"></script>
<script src="assets/js/modules/mapview.js?v=262"></script>
<script src="assets/js/modules/navigation.js?v=262"></script>
<script src="assets/js/modules/population.js?v=262"></script>
<script src="assets/js/modules/facilities.js?v=262"></script>
<script src="assets/js/modules/incidents.js?v=262"></script>
<script src="assets/js/modules/admindash.js?v=262"></script>
<script src="assets/js/modules/admingeo.js?v=262"></script>
<script src="assets/js/modules/adminusers.js?v=262"></script>
<script src="assets/js/modules/notifications.js?v=262"></script>
<script src="assets/js/modules/auth.js?v=262"></script>
<script src="assets/js/modules/init.js?v=262"></script>
<script>
// Override checkAuth to control admin-only nav tabs
const _origCheckAuth = typeof checkAuth === 'function' ? checkAuth : null;
</script>
<script>
// ── Mobile sidebar off-canvas ──
function toggleMobileSidebar() {
  var sidebar = document.getElementById('mapSidebar');
  var backdrop = document.getElementById('sidebarBackdrop');
  var isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
  } else {
    sidebar.classList.add('open');
    backdrop.classList.add('show');
  }
}
function closeMobileSidebar() {
  document.getElementById('mapSidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
}

// ── Mobile search (bar is already in the header) ──
function toggleMobileSearch() {
  var bar = document.getElementById('mobileSearchBar');
  var isOpen = bar.classList.contains('open');
  if (isOpen) {
    bar.classList.remove('open');
  } else {
    bar.classList.add('open');
    setTimeout(function() { document.getElementById('mobileSearchInput').focus(); }, 50);
  }
}

function syncMobileSearchResults(val) {
  var mRes = document.getElementById('mobileSearchResults');
  var dRes = document.getElementById('searchResults');
  if (!val || val.length < 2) { mRes.classList.remove('show'); return; }
  setTimeout(function() {
    mRes.innerHTML = dRes.innerHTML;
    if (dRes.classList.contains('show')) mRes.classList.add('show');
    else mRes.classList.remove('show');
  }, 100);
}

function handleIncPhoto(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('iPhotoImg').src = e.target.result;
    document.getElementById('iPhotoPreview').style.display = 'block';
    document.getElementById('iPhotoLabel').textContent = file.name;
  };
  reader.readAsDataURL(file);
}
function clearIncPhoto() {
  document.getElementById('iPhoto').value = '';
  document.getElementById('iPhotoPreview').style.display = 'none';
  document.getElementById('iPhotoLabel').textContent = 'Tap to attach a photo';
}
</script>

<!-- MOBILE BOTTOM NAV -->
<nav class="mobile-nav" id="mobileNav" style="display:none">
  <div class="mobile-nav-inner">
    <!-- Always-visible centered Report button -->
    <div class="mob-nav-report-wrap">
      <button class="mob-nav-report-pill" onclick="openIncidentModal()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>
        Report Incident
      </button>
    </div>
    <button class="mob-nav-btn admin-nav-tab" id="mnMap" onclick="showPage('map')" style="display:none">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"/></svg>
      Map
    </button>
    <button class="mob-nav-btn admin-nav-tab not-superadmin-tab" id="mnPop" onclick="showPage('population')" style="display:none">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>
      People
    </button>
    <button class="mob-nav-btn admin-nav-tab not-superadmin-tab" id="mnInc" onclick="showPage('incidents')" style="display:none">
      <span class="mob-nav-badge" id="mobIncBadge"></span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"/></svg>
      Incidents
    </button>
    <button class="mob-nav-btn admin-nav-tab" id="mnAdmin" onclick="showPage('admin')" style="display:none">
      <span class="mob-nav-badge" id="mobAdminBadge"></span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
      Admin
    </button>
  </div>
</nav>

</body>
</html>
