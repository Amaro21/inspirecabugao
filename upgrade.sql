-- ============================================================
-- INSPIRE Upgrade Script (run if you have a previous version)
-- ============================================================
-- No USE statement here on purpose — select your database in phpMyAdmin
-- first, then Import this file. A hardcoded database name here would
-- break on hosts like InfinityFree that prefix every database name with
-- your account ID, which is exactly what just happened.

-- 1. Add approval columns to incidents table
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS approved TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN IF NOT EXISTS approved_by INT AFTER approved,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL AFTER approved_by,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT AFTER approved_at;

-- 2. Remove old sample streets (admin will add real ones via pin map)
DELETE FROM streets WHERE name IN (
  'Purok 1 - Sitio Centro',
  'Purok 2 - Sitio Ilaya',
  'Purok 3 - Sitio Ilaod',
  'Purok 4 - Sitio Talon',
  'Purok 5 - Sitio Tabigue'
);

SELECT CONCAT('Upgrade complete. Streets remaining: ', COUNT(*)) AS result FROM streets;

-- Add senior citizen to age_group enum (run if upgrading from previous version)
ALTER TABLE members MODIFY COLUMN age_group ENUM('adult','child','senior') NOT NULL;

-- Add photo proof column to incidents
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS photo LONGTEXT NULL AFTER rejection_reason;

SELECT 'Photo proof column added to incidents.' AS result;

-- v10-fix: Add puroks table and purok_id to streets
CREATE TABLE IF NOT EXISTS puroks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE streets ADD COLUMN IF NOT EXISTS purok_id INT DEFAULT NULL;
-- Safely add foreign key (drop first if it already exists)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'streets' 
    AND CONSTRAINT_NAME = 'fk_street_purok');
SET @sql = IF(@fk_exists > 0, 
    'SELECT 1', 
    'ALTER TABLE streets ADD CONSTRAINT fk_street_purok FOREIGN KEY (purok_id) REFERENCES puroks(id) ON DELETE SET NULL');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE puroks ADD COLUMN IF NOT EXISTS lat DECIMAL(10,8);
ALTER TABLE puroks ADD COLUMN IF NOT EXISTS lng DECIMAL(11,8);

-- Add purok_id to houses table
ALTER TABLE houses ADD COLUMN IF NOT EXISTS purok_id INT DEFAULT NULL;

-- Add birth_date (required), is_pwd to members
ALTER TABLE members MODIFY COLUMN birth_date DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_pwd TINYINT(1) NOT NULL DEFAULT 0;

-- ============================================================
-- v11: Restructure hierarchy to Streets -> Puroks -> Houses -> Members
-- (Previously: Puroks -> Streets -> Houses -> Members)
-- Safe to run on: a fresh v11+ database, a pre-v11 database, or a
-- database where this migration was already partially/fully applied.
-- ============================================================

-- Detect which legacy columns still exist before touching them
SET @has_streets_purok_id = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'streets' AND COLUMN_NAME = 'purok_id');
SET @has_houses_street_id = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'houses' AND COLUMN_NAME = 'street_id');

-- 1. Add street_id to puroks (nullable for backfill)
ALTER TABLE puroks ADD COLUMN IF NOT EXISTS street_id INT DEFAULT NULL;

-- 2. Backfill puroks.street_id from the OLD streets.purok_id relationship
--    (only runs if streets.purok_id still exists)
SET @sql_bp = IF(@has_streets_purok_id > 0,
    'UPDATE puroks p JOIN streets s ON s.purok_id = p.id SET p.street_id = s.id WHERE p.street_id IS NULL',
    'SELECT 1');
PREPARE stmt FROM @sql_bp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Any purok still without a street: attach to the first available street
UPDATE puroks
SET street_id = (SELECT id FROM streets ORDER BY id LIMIT 1)
WHERE street_id IS NULL AND (SELECT COUNT(*) FROM streets) > 0;

-- 4. If there are truly no streets yet, create a placeholder so the migration can proceed
INSERT INTO streets (name, description)
SELECT 'Unsorted Street', 'Auto-created during hierarchy migration'
WHERE (SELECT COUNT(*) FROM streets) = 0;

UPDATE puroks
SET street_id = (SELECT id FROM streets ORDER BY id LIMIT 1)
WHERE street_id IS NULL;

-- 5. Make puroks.street_id required + add its FK
ALTER TABLE puroks MODIFY COLUMN street_id INT NOT NULL;
SET @fk_exists_ps = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'puroks'
    AND CONSTRAINT_NAME = 'fk_purok_street');
SET @sql_ps = IF(@fk_exists_ps > 0,
    'SELECT 1',
    'ALTER TABLE puroks ADD CONSTRAINT fk_purok_street FOREIGN KEY (street_id) REFERENCES streets(id) ON DELETE CASCADE');
PREPARE stmt FROM @sql_ps;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Drop the OLD streets.purok_id column + its FK (streets no longer reference puroks)
SET @fk_exists_sp = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'streets'
    AND CONSTRAINT_NAME = 'fk_street_purok');
SET @sql_sp = IF(@fk_exists_sp > 0,
    'ALTER TABLE streets DROP FOREIGN KEY fk_street_purok',
    'SELECT 1');
PREPARE stmt FROM @sql_sp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE streets DROP COLUMN IF EXISTS purok_id;

-- 7. Backfill houses.purok_id from their old street_id, via any purok under that street
--    (only runs if houses.street_id still exists)
SET @sql_bh = IF(@has_houses_street_id > 0,
    'UPDATE houses h JOIN puroks p ON p.street_id = h.street_id SET h.purok_id = p.id WHERE h.purok_id IS NULL',
    'SELECT 1');
PREPARE stmt FROM @sql_bh;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. Any house whose street had no purok at all: create an "Unassigned" purok for that street
SET @sql_up = IF(@has_houses_street_id > 0,
    'INSERT INTO puroks (street_id, name, description) SELECT DISTINCT h.street_id, ''Unassigned'', ''Auto-created during hierarchy migration'' FROM houses h WHERE h.purok_id IS NULL AND h.street_id IS NOT NULL',
    'SELECT 1');
PREPARE stmt FROM @sql_up;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_bh2 = IF(@has_houses_street_id > 0,
    'UPDATE houses h JOIN puroks p ON p.street_id = h.street_id AND p.name = ''Unassigned'' SET h.purok_id = p.id WHERE h.purok_id IS NULL',
    'SELECT 1');
PREPARE stmt FROM @sql_bh2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 9. Drop the OLD houses.street_id column + its FK
SET @fk_name_hs = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'houses' AND COLUMN_NAME = 'street_id'
    AND REFERENCED_TABLE_NAME = 'streets' LIMIT 1);
SET @sql_hs = IF(@fk_name_hs IS NOT NULL,
    CONCAT('ALTER TABLE houses DROP FOREIGN KEY ', @fk_name_hs),
    'SELECT 1');
PREPARE stmt FROM @sql_hs;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE houses DROP COLUMN IF EXISTS street_id;

-- 10. Any house still missing a purok_id at this point (e.g. it never had a
--     street_id either) gets attached to the first available purok, so the
--     NOT NULL constraint below never fails on leftover orphan rows.
INSERT INTO puroks (street_id, name, description)
SELECT (SELECT id FROM streets ORDER BY id LIMIT 1), 'Unassigned', 'Auto-created during hierarchy migration'
WHERE (SELECT COUNT(*) FROM houses WHERE purok_id IS NULL) > 0
AND (SELECT COUNT(*) FROM puroks) = 0;

UPDATE houses
SET purok_id = (SELECT id FROM puroks ORDER BY id LIMIT 1)
WHERE purok_id IS NULL;

-- 11. Make houses.purok_id required + add its FK
ALTER TABLE houses MODIFY COLUMN purok_id INT NOT NULL;
SET @fk_exists_hp = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'houses'
    AND CONSTRAINT_NAME = 'fk_house_purok');
SET @sql_hp = IF(@fk_exists_hp > 0,
    'SELECT 1',
    'ALTER TABLE houses ADD CONSTRAINT fk_house_purok FOREIGN KEY (purok_id) REFERENCES puroks(id) ON DELETE CASCADE');
PREPARE stmt FROM @sql_hp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Hierarchy migrated: Streets -> Puroks -> Houses -> Members.' AS result;
-- Recalculate age_group for existing records with birth_date
UPDATE members SET age_group =
  CASE
    WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) <= 11 THEN 'child'
    WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) >= 60 THEN 'senior'
    ELSE 'adult'
  END
WHERE birth_date IS NOT NULL;

-- ============================================================
-- v12: Two-tier role system — Super Admin (Barangay Captain)
-- and Admin (Barangay Officials, multiple accounts allowed)
-- ============================================================

-- 1. Temporarily widen the enum so we can read/convert old values
ALTER TABLE users MODIFY COLUMN role
  ENUM('super_admin','admin','official','resident') NOT NULL DEFAULT 'admin';

-- 2. Promote the original admin account to Super Admin (Barangay Captain)
UPDATE users SET role = 'super_admin' WHERE username = 'admin' AND role <> 'super_admin';

-- 3. Any legacy 'official' or 'resident' accounts become regular Admin
--    (the barangay can deactivate any account it doesn't want via the Users tab)
UPDATE users SET role = 'admin' WHERE role IN ('official','resident');

-- 4. If for some reason no super_admin exists yet, promote the earliest account
UPDATE users SET role = 'super_admin'
WHERE id = (SELECT id FROM (SELECT id FROM users ORDER BY id LIMIT 1) t)
AND (SELECT COUNT(*) FROM users WHERE role = 'super_admin') = 0;

-- 5. Finalize the enum to just the two roles
ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','admin') NOT NULL DEFAULT 'admin';

SELECT 'Roles migrated: super_admin (Captain) + admin (Officials).' AS result;

-- ============================================================
-- v13: Password reset / account recovery support
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires DATETIME NULL;

SELECT 'Password reset columns added to users.' AS result;

-- ============================================================
-- v14: Public reference code for anonymous report status lookup
-- ============================================================
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reference_code VARCHAR(12) NULL;

-- Backfill any existing incidents that don't have a code yet
-- (loop-free approach: generate from id + random suffix to guarantee uniqueness)
UPDATE incidents
SET reference_code = CONCAT('RC', LPAD(id, 4, '0'), SUBSTRING(MD5(RAND()), 1, 4))
WHERE reference_code IS NULL;

-- Now safe to enforce uniqueness going forward
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'incidents' AND INDEX_NAME = 'reference_code');
SET @sql_idx = IF(@idx_exists > 0,
    'SELECT 1',
    'ALTER TABLE incidents ADD UNIQUE INDEX reference_code (reference_code)');
PREPARE stmt FROM @sql_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Reference code column added to incidents.' AS result;

-- ============================================================
-- v15: Full system activity log (non-repudiation audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    username VARCHAR(100) NULL,
    full_name VARCHAR(200) NULL,
    role VARCHAR(20) NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    target_type VARCHAR(50) NULL,
    target_id INT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SET @fk_exists_al = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'activity_logs'
    AND CONSTRAINT_NAME = 'fk_activitylog_user');
SET @sql_al = IF(@fk_exists_al > 0,
    'SELECT 1',
    'ALTER TABLE activity_logs ADD CONSTRAINT fk_activitylog_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
PREPARE stmt FROM @sql_al;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Activity log table ready — every action is now tied to an account.' AS result;

-- ============================================================
-- v16: Break-glass account recovery code (Super Admin only)
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_hash VARCHAR(255) NULL;

SELECT 'Recovery code column added to users.' AS result;

-- ============================================================
-- v17: Narrow incidents.category to fire/accident/crime/other only
-- ============================================================
-- Convert any EXISTING incidents using the removed categories to 'other'
-- BEFORE narrowing the column — doing it in the other order would let
-- MySQL silently coerce out-of-range values (often to an empty string),
-- quietly corrupting old reports instead of cleanly reclassifying them.
UPDATE incidents SET category = 'other' WHERE category IN ('flood', 'medical', 'infrastructure');

ALTER TABLE incidents MODIFY COLUMN category ENUM('fire','accident','crime','other') NOT NULL DEFAULT 'other';

SELECT 'Incident categories narrowed to fire/accident/crime/other.' AS result;

-- ============================================================
-- v18: Incident subtype + urgency (replacing free-form severity)
-- ============================================================
-- New field: a category-specific subtype (e.g. "Electrical Fire" under
-- Fire). Plain VARCHAR rather than an ENUM since the valid options differ
-- per category — the app enforces which values are valid for which
-- category, not the column itself. NULL for category='other', which has
-- no subtype list.
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS subtype VARCHAR(60) NULL AFTER category;

-- Re-map existing severity values to the new normal/urgent/emergency scale
-- BEFORE narrowing the column, same reasoning as the category migration
-- above — avoids MySQL silently coercing old values instead of mapping
-- them sensibly.
UPDATE incidents SET severity = 'normal' WHERE severity IN ('low', 'medium');
UPDATE incidents SET severity = 'urgent' WHERE severity = 'high';
UPDATE incidents SET severity = 'emergency' WHERE severity = 'critical';

ALTER TABLE incidents MODIFY COLUMN severity ENUM('normal','urgent','emergency') NOT NULL DEFAULT 'normal';

SELECT 'Incident subtype added; severity narrowed to normal/urgent/emergency.' AS result;

-- ============================================================
-- v19: Drop unused house_name column; rename incidents.severity
-- to urgency (values were already normal/urgent/emergency from
-- v18 — this just makes the column name match the terminology
-- used everywhere else in the app and UI).
-- ============================================================

-- house_name was never actually collected anywhere (not the manual
-- Add House form, not CSV import as of the last update) — always
-- empty/unused in practice, safe to drop outright.
ALTER TABLE houses DROP COLUMN house_name;

-- CHANGE (not DROP+ADD) preserves all existing data while renaming.
ALTER TABLE incidents CHANGE COLUMN severity urgency ENUM('normal','urgent','emergency') NOT NULL DEFAULT 'normal';

SELECT 'house_name dropped; severity renamed to urgency.' AS result;

-- ============================================================
-- v20: Add photo column to facilities. Upload is restricted to
-- Super Admin (enforced in api/handlers/facilities.php) — this
-- is a schema change only, no data migration needed.
-- ============================================================
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS photo VARCHAR(255) NULL AFTER operating_hours;

SELECT 'facilities.photo column added.' AS result;

-- ============================================================
-- v21: Add household head / family head designations to
-- members. One household (house) can contain more than one
-- family (e.g. an extended family living together), so
-- is_family_head can be set on more than one member per house
-- — but is_household_head is meant to be unique per house,
-- which the backend enforces in member_add/member_edit by
-- unsetting it on any other member in the same house whenever
-- it's set on one.
-- ============================================================
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_household_head TINYINT(1) NOT NULL DEFAULT 0 AFTER is_pwd;
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_family_head TINYINT(1) NOT NULL DEFAULT 0 AFTER is_household_head;

SELECT 'members.is_household_head and is_family_head columns added.' AS result;

-- ============================================================
-- v22: Add investigating_at, needed for the "Investigating ⏱
-- 1h 33m ago" display — tracks when status became
-- "investigating" specifically, the same way approved_at and
-- resolved_at already track those transitions.
-- ============================================================
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS investigating_at TIMESTAMP NULL AFTER assigned_to;

SELECT 'incidents.investigating_at column added.' AS result;
