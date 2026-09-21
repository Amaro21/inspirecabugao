# Deployment Checklist — INSPIRE Cabugao

Follow these in order. A few steps have a specific order for a reason
(noted inline) — doing them out of order can lock you out or break the site.

## Phase 1 — Hosting account setup

- [ ] Sign up for hosting (Hostinger, GreenGeeks, or your chosen host)
- [ ] Note your domain or the temporary subdomain the host gives you
- [ ] Log into cPanel

## Phase 2 — Database

- [ ] In cPanel, open **MySQL Database Wizard**
- [ ] Create a new database (e.g. `inspire_cabugao`)
- [ ] Create a database user with a strong password, grant it **All Privileges** on that database
- [ ] Write down: database host (usually `localhost` on shared hosting), database name, username, password — you'll need these in Phase 4
- [ ] Open **phpMyAdmin**, select your new database, go to **Import**, choose `database.sql` from this project, click **Go**
- [ ] Confirm it worked: you should see 10 tables (streets, puroks, houses, members, users, facilities, incidents, import_logs, activity_logs, plus indexes)

## Phase 3 — Upload files

- [ ] Upload the entire `spotmap_updated/` folder contents to your web root (usually `public_html/`, or a subfolder if you want it at a path like `public_html/inspire/`)
- [ ] You can skip uploading `api/index.php.original_backup` and `assets/js/app.js.original_backup` — they're rollback safety nets from development, not needed live (but harmless if you do upload them)
- [ ] Confirm folder structure made it over intact: `api/handlers/`, `api/lib/`, `assets/js/modules/` should all exist as folders, not be missing
- [ ] The app creates an `uploads/incidents/` folder automatically the first time someone submits a photo with a report — no action needed on your part. If photos aren't showing up after a real test (Phase 8), check that your hosting account allows PHP to create folders in its own directory (`chmod 755` on the project root if not); this is the one thing that occasionally needs a manual nudge on more locked-down hosts.

## Phase 4 — Configure `config.php`

Open `config.php` on the server (via File Manager's code editor, or edit locally and re-upload) and fill in:

- [ ] `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` — from Phase 2
- [ ] **Leave `FORCE_HTTPS` as `false` for now** — you'll flip this in Phase 6, after confirming SSL actually works. Turning it on too early can cause a redirect loop if SSL isn't active yet.
- [ ] `RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` — if you set these up for `localhost` during development, go back to https://www.google.com/recaptcha/admin and **add your real domain** to that same key (you don't need a new key, just add the domain to the existing one's Domains list)
- [ ] `GMAIL_SMTP_USER` / `GMAIL_SMTP_APP_PASSWORD` — your Gmail address + the 16-character app password (see the comment block above these in `config.php` if you haven't set this up yet)

## Phase 5 — First login

- [ ] Visit your site with `?admin` in the URL once (e.g. `https://yourdomain.com/index.php?admin`) to reveal the Login button — it'll stay revealed on your browser from then on
- [ ] Log in with username `admin` and **whatever password you want to use going forward** — the account has no password set yet, so your first successful login permanently sets it (see the comment in `database.sql`'s seed data if you want the details)

## Phase 6 — SSL / HTTPS

- [ ] In cPanel, find **SSL/TLS Status** or **Let's Encrypt** (naming varies by host) and issue a free certificate for your domain — usually one click
- [ ] Wait a few minutes, then visit `https://yourdomain.com` directly and confirm it loads with a padlock icon, no certificate warnings
- [ ] **Only after that works:** go back into `config.php` and change `FORCE_HTTPS` to `true`
- [ ] Reload the site over plain `http://` and confirm it automatically redirects to `https://`

## Phase 7 — Security setup (do this before anyone else uses it)

- [ ] Log in as Super Admin → My Profile → **Generate New Recovery Code** → save the code somewhere that survives losing your phone/laptop/Gmail simultaneously (a printout in a physical folder is genuinely a good option, not old-fashioned)
- [ ] Go to Admin Dashboard → Activity Log tab → **Download Backup Now** → save this baseline backup somewhere off-server (your own computer, Google Drive)
- [ ] If you'll have other Officials, create their Admin accounts now via Admin Dashboard → Users tab

## Phase 8 — Functional test pass

- [ ] Submit a test incident report from the public map (with a photo) — confirm it appears in Pending Reports
- [ ] Approve it — confirm it shows on the live map
- [ ] **Test "Forgot Password"** — confirm the email actually arrives (check spam folder too). This is the one thing I genuinely can't verify in advance — some hosts block the outbound port this needs. If it doesn't arrive after a few minutes, that's the likely cause; the recovery code from Phase 7 is your fallback either way.
- [ ] Log in as a regular Admin account (not Super Admin) and confirm they can't see the Users tab or any Delete buttons
- [ ] Open the site on an actual phone and click through Report Incident, the map, and the bottom nav

## Phase 9 — Cleanup

- [ ] Delete the test incident report you created in Phase 8 (or leave it if it's useful as a real example — your call)
- [ ] Consider removing `database.sql` and `upgrade.sql` from the live server once imported — they're not needed at runtime, and leaving them in the web root means anyone who guesses the URL can download your schema. (Keep your own local copy for future migrations, just don't leave one sitting on the public server.)

## You're live.

Going forward: re-run the relevant section of `upgrade.sql` whenever I give you a database change, and re-upload changed files the same way you did in Phase 3. The Activity Log will show you exactly who did what from day one.
