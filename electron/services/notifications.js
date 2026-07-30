const { Notification } = require('electron');
const dbRepo = require('../db/database');
const log = require('electron-log');

const COOLDOWN_MINUTES = 60; // don't spam the same alert repeatedly

function fire(deviceId, type, title, body, severity = 'warn') {
  if (dbRepo.hasRecentNotification(deviceId, type, COOLDOWN_MINUTES)) return;
  dbRepo.insertNotification({ device_id: deviceId, type, title, body, severity });
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
  log.info(`[notify] ${type}: ${title} — ${body}`);
}

/**
 * Evaluates real, freshly-fetched data against user-configured thresholds
 * and fires OS notifications + persists them. Called on every poll tick.
 */
function evaluate(deviceId, { battery, driveUsage }) {
  const settings = dbRepo.getSettings();

  if (battery?.hasBattery && settings.notify_battery_low === 'true') {
    if (battery.percent !== null && battery.percent <= 20 && !battery.isCharging) {
      fire(deviceId, 'battery_low', 'Battery below 20%', `Currently at ${battery.percent}% and not charging.`, 'warn');
    }
  }

  if (settings.notify_overheat === 'true' && battery?.temperature !== null && battery?.temperature >= 40) {
    fire(deviceId, 'overheat', 'Battery overheating', `Temperature reached ${battery.temperature}°C.`, 'critical');
  }

  if (settings.notify_storage_full === 'true' && driveUsage) {
    const usedPct = (driveUsage.usedBytes / driveUsage.totalBytes) * 100;
    if (usedPct >= 90) {
      fire(deviceId, 'storage_full', 'Storage almost full', `${driveUsage.drive} is at ${usedPct.toFixed(0)}% capacity.`, 'warn');
    }
  }
}

function checkWarrantyExpirations(deviceId) {
  const warranties = dbRepo.getWarranty(deviceId);
  const now = Date.now();
  for (const w of warranties) {
    if (!w.expires_date) continue;
    const daysLeft = Math.ceil((new Date(w.expires_date).getTime() - now) / 86400000);
    if (daysLeft > 0 && daysLeft <= 30) {
      fire(deviceId, 'warranty_expiring', 'Warranty expiring soon', `${w.provider || 'Coverage'} ends in ${daysLeft} days.`, 'warn');
    }
  }
}

module.exports = { evaluate, checkWarrantyExpirations, fire };
