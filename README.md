# INSPIRE Cabugao — Project Structure

This document explains how the codebase is organized, for anyone (including
future-you) picking this project back up.

## Why this structure exists

Both the backend (`api/index.php`) and the frontend (`assets/js/app.js`)
started as single files and grew to ~1,100 and ~2,500 lines respectively as
features were added. That worked, but it created two concrete problems:

1. **Duplicated logic.** The same rule (e.g. "hide the Report Incident
   button for logged-in staff") ended up copy-pasted in four different
   places because there was no single obvious place to put it. Fixing the
   rule in one spot didn't fix it everywhere — the bug kept reappearing.
2. **No isolation between unrelated features.** A change to incident
   handling and a change to user management lived a few hundred lines apart
   in the same file, with nothing structurally stopping one from
   accidentally affecting the other.

Splitting both files by **domain** (not by technical layer) fixes both
problems without changing any behavior — every line of logic was moved
verbatim, not rewritten.

## Backend — `api/`

```
api/
├── index.php           thin router — maps ?action=X to the right handler file
├── handlers/
│   ├── auth.php         login, logout, profile, password recovery
│   ├── stats.php        dashboard counters, map data feed, search
│   ├── geography.php    Streets → Puroks → Houses → Members CRUD
│   ├── facilities.php   schools, health centers, etc.
│   ├── incidents.php    report → approve/reject → resolve lifecycle
│   ├── users.php        Super Admin: create/activate/delete accounts
│   ├── import.php       CSV bulk import
│   └── activity_log.php read access to the audit trail
└── lib/
    ├── bootstrap.php    headers, request body parsing, error handlers
    ├── recaptcha.php    Google reCAPTCHA server-side verification
    ├── mail.php         Gmail SMTP + mail() fallback for sending email
    └── logging.php      writes to the activity_logs audit trail
```

`api/index.php` does almost nothing itself — it loads the shared `lib/`
helpers, looks up which `handlers/*.php` file owns the requested `?action=`,
and `require`s exactly that one file. Only the code relevant to the current
request ever runs.

**Adding a new endpoint:** add one line to the `$routes` array in
`api/index.php`, then add the `case` to the relevant handler file (or
create a new handler file if it's a genuinely new domain).

## Frontend — `assets/js/modules/`

```
modules/
├── core.js            global state + generic helpers (qs, api, toast, escH…)
├── pinmaps.js          shared "click the map to drop a pin" widget
├── mapview.js           Leaflet init + rendering every marker layer
├── navigation.js        page switching, sidebar, search
├── population.js        households & residents (house/member CRUD)
├── facilities.js        Facilities page
├── incidents.js         report form, status lookup, monthly report, popups
├── admindash.js          Admin Dashboard shell + Pending Reports workflow
├── admingeo.js           Super Admin: streets/puroks/houses admin forms
├── adminusers.js         Super Admin: accounts + Activity Log viewer
├── bulkimport.js         CSV import
├── notifications.js      new-report polling, alert sound, mute toggle
├── auth.js               login/logout/profile/password reset
└── init.js               boots the app once the DOM is ready (loads LAST)
```

These are loaded as **plain `<script>` tags in `index.php`, in this exact
order** — there's no bundler, no build step, nothing to install. Every
function is still a normal global function, exactly like the single-file
version; only *where the code lives* changed. `core.js` must load first
(everything depends on it) and `init.js` must load last (it calls functions
defined in every other module).

**Adding a new feature:** put it in whichever module matches its domain, or
create a new module file and add one `<script>` tag for it in `index.php`.

## Centralized logic worth knowing about

`updateReportButtonVisibility()` in `core.js` is the single source of truth
for whether the floating Report Incident button, the mobile nav pill, and
the Check Status link are visible. If you ever need to change *when* that
button should show up, this is the only function that needs to change.

## Backup files

`api/index.php.original_backup` and `assets/js/app.js.original_backup` are
the pre-refactor monolithic versions, kept as a rollback safety net. They
are not loaded by the app and can be deleted once you've confirmed
everything works on your server.

## Files intentionally removed

`test.php` and `reset_password.php` were removed — both were diagnostic/
setup scripts left over from development that doubled as live security
risks (one reset the admin password to a hardcoded value with no login
check; the other pre-filled default credentials in a public form). Neither
is needed: the Super Admin account's password starts empty on purpose, and
the **first successful login with any password permanently sets it** — see
the comment above the seed data in `database.sql`.
