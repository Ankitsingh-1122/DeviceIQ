const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');

const systemInfo = require('./services/systemInfo');
const storageAnalyzer = require('./services/storageAnalyzer');
const notificationsService = require('./services/notifications');
const dbRepo = require('./db/database');
const { registerIpcHandlers } = require('./ipc/handlers');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let tray;
let currentDeviceId = null;
let pollTimer = null;

// tracks in-memory charging session state so we can persist completed sessions
let sessionState = { active: false, startTime: null, startPercent: null, fastCharge: false };

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#09090B',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('close', (e) => {
    // minimize-to-tray instead of quitting, so background polling keeps running
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray-icon.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('DeviceIQ');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open DeviceIQ', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => mainWindow.show());
}

function trackChargingSession(battery) {
  if (!battery?.hasBattery) return;
  const hour = new Date().getHours();
  const isNight = hour >= 22 || hour <= 6;

  if (battery.isCharging && !sessionState.active) {
    sessionState = { active: true, startTime: new Date().toISOString(), startPercent: battery.percent, fastCharge: false };
  } else if (!battery.isCharging && sessionState.active) {
    dbRepo.db.prepare(`
      INSERT INTO charging_sessions (device_id, start_time, end_time, start_percent, end_percent, fast_charge, overnight)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(currentDeviceId, sessionState.startTime, new Date().toISOString(), sessionState.startPercent, battery.percent, sessionState.fastCharge ? 1 : 0, isNight ? 1 : 0);
    sessionState = { active: false, startTime: null, startPercent: null, fastCharge: false };
  }
}

async function pollOnce() {
  try {
    const battery = await systemInfo.getBatterySnapshot();
    const cpu = await systemInfo.getCpuLoad();

    if (battery.hasBattery) {
      dbRepo.insertBatterySample(currentDeviceId, {
        percent: battery.percent,
        is_charging: battery.isCharging ? 1 : 0,
        ac_connected: battery.acConnected ? 1 : 0,
        voltage: battery.voltage,
        design_capacity: battery.designCapacity,
        max_capacity: battery.maxCapacity,
        current_capacity: battery.currentCapacity,
        cycle_count: battery.cycleCount,
        temperature: cpu.temperature, // best available proxy where no battery sensor exists
        charge_rate_w: null,
        time_remaining_min: battery.timeRemainingMin,
      });
      trackChargingSession(battery);
    }

    const driveUsage = await storageAnalyzer.getDriveUsage();
    notificationsService.evaluate(currentDeviceId, { battery, driveUsage });
    notificationsService.checkWarrantyExpirations(currentDeviceId);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('battery:update', battery);
    }
  } catch (err) {
    log.error('[poll] failed', err);
  }
}

async function startPolling() {
  const settings = dbRepo.getSettings();
  const minutes = Math.max(1, parseInt(settings.scan_interval_minutes, 10) || 5);
  await pollOnce(); // immediate first sample
  pollTimer = setInterval(pollOnce, minutes * 60 * 1000);
}

app.whenReady().then(async () => {
  const identity = await systemInfo.getDeviceIdentity();
  currentDeviceId = identity.id;
  dbRepo.upsertDevice(identity);

  registerIpcHandlers({ getDeviceId: () => currentDeviceId });

  systemInfo.startCpuWorker(1000);

  createWindow();
  createTray();
  await startPolling();

  const settings = dbRepo.getSettings();
  if (settings.auto_startup === 'true') {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // app keeps running in tray; do not quit here
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (pollTimer) clearInterval(pollTimer);
});
