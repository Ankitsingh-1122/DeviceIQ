const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { app } = require('electron');
const log = require('electron-log');

const DB_DIR = app.getPath('userData');
const DB_PATH = path.join(DB_DIR, 'DeviceIQ.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ---------------------------------------------------------------------- */
/* SCHEMA                                                                  */
/* ---------------------------------------------------------------------- */

db.exec(`
CREATE TABLE IF NOT EXISTS device (
  id TEXT PRIMARY KEY,          -- stable machine id (from systeminformation uuid)
  name TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  os_version TEXT,
  cpu TEXT,
  ram_gb REAL,
  purchase_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS battery_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  percent REAL,
  is_charging INTEGER,
  ac_connected INTEGER,
  voltage REAL,
  design_capacity REAL,
  max_capacity REAL,
  current_capacity REAL,
  cycle_count INTEGER,
  temperature REAL,
  charge_rate_w REAL,
  time_remaining_min INTEGER,
  timestamp TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_battery_history_device_time ON battery_history(device_id, timestamp);

CREATE TABLE IF NOT EXISTS charging_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  start_time TEXT,
  end_time TEXT,
  start_percent REAL,
  end_percent REAL,
  fast_charge INTEGER DEFAULT 0,
  overnight INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS warranty (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  provider TEXT,
  purchase_date TEXT,
  expires_date TEXT,
  coverage_type TEXT,
  invoice_path TEXT
);

CREATE TABLE IF NOT EXISTS repair_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  date TEXT,
  part TEXT,
  cost REAL DEFAULT 0,
  service_center TEXT,
  under_warranty INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT REFERENCES device(id) ON DELETE CASCADE,
  type TEXT,           -- battery_low | overheat | storage_full | warranty_expiring | repair_reminder
  title TEXT,
  body TEXT,
  severity TEXT,        -- info | warn | critical
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  metric TEXT,          -- e.g. health_weekly, storage_total
  value REAL,
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS storage_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  drive TEXT,
  total_bytes INTEGER,
  used_bytes INTEGER,
  free_bytes INTEGER,
  breakdown_json TEXT,   -- {Photos: bytes, Videos: bytes, ...}
  large_files_json TEXT,
  duplicates_json TEXT,
  scanned_at TEXT DEFAULT (datetime('now'))
);
`);

const DEFAULT_SETTINGS = {
  auto_startup: 'true',
  dark_mode: 'true',
  scan_interval_minutes: '5',
  notify_battery_low: 'true',
  notify_overheat: 'true',
  notify_storage_full: 'true',
  language: 'en',
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

log.info(`[db] SQLite ready at ${DB_PATH}`);

/* ---------------------------------------------------------------------- */
/* REPOSITORY FUNCTIONS                                                    */
/* ---------------------------------------------------------------------- */

function upsertDevice(device) {
  db.prepare(`
    INSERT INTO device (id, name, manufacturer, model, serial_number, os_version, cpu, ram_gb)
    VALUES (@id, @name, @manufacturer, @model, @serial_number, @os_version, @cpu, @ram_gb)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, manufacturer=excluded.manufacturer, model=excluded.model,
      serial_number=excluded.serial_number, os_version=excluded.os_version,
      cpu=excluded.cpu, ram_gb=excluded.ram_gb
  `).run(device);
  return device;
}

function insertBatterySample(deviceId, sample) {
  return db.prepare(`
    INSERT INTO battery_history
      (device_id, percent, is_charging, ac_connected, voltage, design_capacity, max_capacity,
       current_capacity, cycle_count, temperature, charge_rate_w, time_remaining_min)
    VALUES (@device_id, @percent, @is_charging, @ac_connected, @voltage, @design_capacity, @max_capacity,
       @current_capacity, @cycle_count, @temperature, @charge_rate_w, @time_remaining_min)
  `).run({ device_id: deviceId, ...sample });
}

function getBatteryHistory(deviceId, sinceHours = 24 * 7) {
  return db.prepare(`
    SELECT * FROM battery_history
    WHERE device_id = ? AND timestamp >= datetime('now', ?)
    ORDER BY timestamp ASC
  `).all(deviceId, `-${sinceHours} hours`);
}

function getLatestBatterySample(deviceId) {
  return db.prepare(`
    SELECT * FROM battery_history WHERE device_id = ? ORDER BY timestamp DESC LIMIT 1
  `).get(deviceId);
}

function getWeeklyHealthTrend(deviceId, weeks = 6) {
  return db.prepare(`
    SELECT strftime('%Y-%W', timestamp) AS week,
           AVG(max_capacity * 100.0 / NULLIF(design_capacity,0)) AS health
    FROM battery_history
    WHERE device_id = ? AND timestamp >= datetime('now', ?)
    GROUP BY week ORDER BY week ASC
  `).all(deviceId, `-${weeks * 7} days`);
}

function insertNotification(n) {
  return db.prepare(`
    INSERT INTO notifications (device_id, type, title, body, severity)
    VALUES (@device_id, @type, @title, @body, @severity)
  `).run(n);
}

function getRecentNotifications(limit = 50) {
  return db.prepare(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?`).all(limit);
}

function hasRecentNotification(deviceId, type, withinMinutes) {
  return !!db.prepare(`
    SELECT 1 FROM notifications
    WHERE device_id = ? AND type = ? AND created_at >= datetime('now', ?)
    LIMIT 1
  `).get(deviceId, type, `-${withinMinutes} minutes`);
}

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

function saveStorageScan(deviceId, scan) {
  return db.prepare(`
    INSERT INTO storage_scans (device_id, drive, total_bytes, used_bytes, free_bytes, breakdown_json, large_files_json, duplicates_json)
    VALUES (@device_id, @drive, @total_bytes, @used_bytes, @free_bytes, @breakdown_json, @large_files_json, @duplicates_json)
  `).run({
    device_id: deviceId,
    drive: scan.drive,
    total_bytes: scan.totalBytes,
    used_bytes: scan.usedBytes,
    free_bytes: scan.freeBytes,
    breakdown_json: JSON.stringify(scan.breakdown),
    large_files_json: JSON.stringify(scan.largeFiles),
    duplicates_json: JSON.stringify(scan.duplicates),
  });
}

function getLatestStorageScan(deviceId, drive) {
  const row = db.prepare(`
    SELECT * FROM storage_scans WHERE device_id = ? AND drive = ? ORDER BY scanned_at DESC LIMIT 1
  `).get(deviceId, drive);
  if (!row) return null;
  return {
    ...row,
    breakdown: JSON.parse(row.breakdown_json || '{}'),
    largeFiles: JSON.parse(row.large_files_json || '[]'),
    duplicates: JSON.parse(row.duplicates_json || '[]'),
  };
}

/* warranty / repairs are user-entered records (there is no OS API for this data) */
function addWarranty(deviceId, w) {
  return db.prepare(`
    INSERT INTO warranty (device_id, provider, purchase_date, expires_date, coverage_type, invoice_path)
    VALUES (@device_id, @provider, @purchase_date, @expires_date, @coverage_type, @invoice_path)
  `).run({ device_id: deviceId, ...w });
}
function getWarranty(deviceId) {
  return db.prepare(`SELECT * FROM warranty WHERE device_id = ? ORDER BY expires_date ASC`).all(deviceId);
}
function addRepair(deviceId, r) {
  return db.prepare(`
    INSERT INTO repair_history (device_id, date, part, cost, service_center, under_warranty, notes)
    VALUES (@device_id, @date, @part, @cost, @service_center, @under_warranty, @notes)
  `).run({ device_id: deviceId, ...r });
}
function getRepairs(deviceId) {
  return db.prepare(`SELECT * FROM repair_history WHERE device_id = ? ORDER BY date DESC`).all(deviceId);
}

module.exports = {
  db,
  upsertDevice,
  insertBatterySample,
  getBatteryHistory,
  getLatestBatterySample,
  getWeeklyHealthTrend,
  insertNotification,
  getRecentNotifications,
  hasRecentNotification,
  getSettings,
  setSetting,
  saveStorageScan,
  getLatestStorageScan,
  addWarranty,
  getWarranty,
  addRepair,
  getRepairs,
};
