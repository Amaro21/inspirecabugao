-- ============================================================
-- INSPIRE: Interactive Spotmap Platform
-- Barangay Cabugao, Bato, Catanduanes
-- Database Schema
-- ============================================================
--
-- This file does NOT create or select a database on purpose. Almost
-- every host (InfinityFree, Hostinger, Z.com, cPanel hosts in general)
-- requires you to create the database through their own control panel
-- first, and most also enforce a specific naming convention (e.g.
-- InfinityFree prefixes every database with your account ID, like
-- `if0_12345_inspire_cabugao`) that a hardcoded name in this file
-- couldn't match anyway. Just select your already-created database in
-- phpMyAdmin first, then Import this file — it'll run inside whichever
-- database you have selected, regardless of what it's actually named.

-- -------------------- USERS --------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role ENUM('super_admin','admin') NOT NULL DEFAULT 'admin',
    email VARCHAR(200),
    contact VARCHAR(50),
    is_active TINYINT(1) DEFAULT 1,
    reset_token VARCHAR(64) NULL,
    reset_expires DATETIME NULL,
    recovery_code_hash VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -------------------- STREETS (top of geographic hierarchy) --------------------
CREATE TABLE IF NOT EXISTS streets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -------------------- PUROKS (belong to a street) --------------------
CREATE TABLE IF NOT EXISTS puroks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    street_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (street_id) REFERENCES streets(id) ON DELETE CASCADE
);

-- -------------------- HOUSES (belong to a purok) --------------------
CREATE TABLE IF NOT EXISTS houses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purok_id INT NOT NULL,
    house_number VARCHAR(50),
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (purok_id) REFERENCES puroks(id) ON DELETE CASCADE
);

-- -------------------- MEMBERS --------------------
CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    house_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    gender ENUM('male','female') NOT NULL,
    age_group ENUM('adult','child','senior') NOT NULL,
    birth_date DATE NOT NULL,
    is_pwd TINYINT(1) NOT NULL DEFAULT 0,
    is_household_head TINYINT(1) NOT NULL DEFAULT 0,
    is_family_head TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE
);

-- -------------------- FACILITIES --------------------
CREATE TABLE IF NOT EXISTS facilities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category ENUM('government','health','education','religious','commercial','infrastructure','landmark','other') NOT NULL DEFAULT 'other',
    description TEXT,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    address VARCHAR(300),
    contact VARCHAR(100),
    operating_hours VARCHAR(200),
    photo VARCHAR(255),
    added_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

-- -------------------- INCIDENTS --------------------
CREATE TABLE IF NOT EXISTS incidents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    category ENUM('fire','accident','crime','other') NOT NULL DEFAULT 'other',
    subtype VARCHAR(60) NULL,
    description TEXT NOT NULL,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    address VARCHAR(300),
    urgency ENUM('normal','urgent','emergency') NOT NULL DEFAULT 'normal',
    status ENUM('open','investigating','resolved','closed') NOT NULL DEFAULT 'open',
    approved TINYINT(1) NOT NULL DEFAULT 0,  -- 0=pending, 1=approved by official
    approved_by INT,
    approved_at TIMESTAMP NULL,
    photo LONGTEXT NULL,  -- base64 encoded photo proof
    rejection_reason TEXT,
    reported_by INT,
    reporter_name VARCHAR(200),
    reporter_contact VARCHAR(100),
    reference_code VARCHAR(12) UNIQUE,  -- public lookup code shown to the reporter, no login needed
    assigned_to INT,
    investigating_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- -------------------- IMPORT LOGS --------------------
CREATE TABLE IF NOT EXISTS import_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    filename VARCHAR(255),
    rows_imported INT DEFAULT 0,
    rows_failed INT DEFAULT 0,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- -------------------- ACTIVITY LOGS (full audit trail) --------------------
-- Identity fields (username/full_name/role) are snapshotted at the time of
-- the action, not just joined live from users — so the log still clearly
-- shows who did what even if that account is later deleted or renamed.
-- This is the system's non-repudiation record: every account-attributable
-- action taken anywhere in the system is written here.
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default Super Admin (Barangay Captain). Its password starts EMPTY on
-- purpose — the system treats an empty hash as "not yet set", so the very
-- first successful login to this account (username: admin, any password
-- you choose) permanently sets that password going forward. There is no
-- default password to look up or change later — just log in once with
-- whatever password you want the account to have.
-- Additional Admin accounts (Barangay Officials) are created by the Super Admin
-- via the Admin Dashboard → Users tab.
INSERT IGNORE INTO users (username, password, full_name, role)
VALUES
  ('admin', '', 'Barangay Captain', 'super_admin');

-- Streets must be added by the Admin via the Admin panel (pin on map).
-- No sample streets — admin adds real streets of Barangay Cabugao manually.

-- Sample facilities (correct GPS coordinates)
INSERT IGNORE INTO facilities (name, category, description, lat, lng) VALUES
  ('Barangay Hall Cabugao',       'government',      'Main barangay hall and administrative center',       13.5960, 124.2807),
  ('Cabugao Health Center',       'health',          'Primary health care facility serving the barangay',  13.5968, 124.2800),
  ('Cabugao Elementary School',   'education',       'Public elementary school in Barangay Cabugao',       13.5952, 124.2815),
  ('Cabugao Chapel',              'religious',       'Local Catholic chapel',                              13.5963, 124.2810),
  ('Multi-Purpose Hall',          'government',      'Community multi-purpose hall for barangay events',   13.5956, 124.2803),
  ('Cabugao Water Station',       'infrastructure',  'Barangay water distribution point',                  13.5945, 124.2795);

-- ── Run this if upgrading an existing database ──────────────
-- ALTER TABLE incidents ADD COLUMN approved TINYINT(1) NOT NULL DEFAULT 0 AFTER status;
-- ALTER TABLE incidents ADD COLUMN approved_by INT AFTER approved;
-- ALTER TABLE incidents ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by;
-- ALTER TABLE incidents ADD COLUMN rejection_reason TEXT AFTER approved_at;
