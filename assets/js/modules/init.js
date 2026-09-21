// init.js — boots the app once the DOM is ready. Loads LAST, after every
// other module has registered its functions.

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded',()=>{
  initMap();
  loadStats();
  checkAuth();
  loadStreetSidebar();
  loadSidebarActiveIncidents(); // load immediately — it's the default sidebar tab
  checkForPasswordResetLink();

  // Shown on every page, and "Active Incidents" can go stale purely from
  // the 12h visibility window ticking over, or from actions taken in
  // another tab — so keep it current rather than only refreshing it
  // reactively after local actions.
  setInterval(loadStats, 30000);

  // Leaflet measures its container's size once, when initMap() runs. If web
  // fonts are still loading at that exact moment, the header/stats-bar text
  // can reflow slightly once they apply, changing how tall #page-map's flex
  // slot actually is — without Leaflet ever finding out. Re-check once fonts
  // settle, and again on any later window resize.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (map) map.invalidateSize(); });
  }
  window.addEventListener('resize', () => { if (map) map.invalidateSize(); });
});
