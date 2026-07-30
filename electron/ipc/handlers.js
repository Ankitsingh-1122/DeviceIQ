const { ipcMain, shell } = require('electron');
const systemInfo = require('../services/systemInfo');
const storageAnalyzer = require('../services/storageAnalyzer');
const insightsService = require('../services/insights');
const reportsService = require('../services/reports');
const dbRepo = require('../db/database');

function registerIpcHandlers({ getDeviceId }) {
  ipcMain.handle('system:getFullSnapshot', async () => systemInfo.getFullSnapshot());
  ipcMain.handle('system:getBattery', async () => systemInfo.getBatterySnapshot());
  ipcMain.handle('system:getDisks', async () => systemInfo.getDisks());

  ipcMain.handle('battery:getHistory', async (_e, { deviceId, sinceHours } = {}) =>
    dbRepo.getBatteryHistory(deviceId || getDeviceId(), sinceHours || 24 * 7)
  );
  ipcMain.handle('battery:getLatest', async (_e, { deviceId } = {}) =>
    dbRepo.getLatestBatterySample(deviceId || getDeviceId())
  );
  ipcMain.handle('battery:getWeeklyTrend', async (_e, { deviceId, weeks } = {}) =>
    dbRepo.getWeeklyHealthTrend(deviceId || getDeviceId(), weeks || 6)
  );

  ipcMain.handle('storage:getDriveUsage', async () => storageAnalyzer.getDriveUsage());
  ipcMain.handle('storage:scan', async (event) => {
    const deviceId = getDeviceId();
    const result = await storageAnalyzer.scanUserStorage((progress) => {
      event.sender.send('storage:scanProgress', progress);
    });
    const drive = await storageAnalyzer.getDriveUsage();
    if (drive) {
      dbRepo.saveStorageScan(deviceId, {
        drive: drive.drive,
        totalBytes: drive.totalBytes,
        usedBytes: drive.usedBytes,
        freeBytes: drive.freeBytes,
        breakdown: result.breakdown,
        largeFiles: result.largeFiles,
        duplicates: result.duplicates,
      });
    }
    return { ...result, drive };
  });
  ipcMain.handle('storage:getLatestScan', async () => {
    const drive = await storageAnalyzer.getDriveUsage();
    if (!drive) return null;
    return dbRepo.getLatestStorageScan(getDeviceId(), drive.drive);
  });

  ipcMain.handle('insights:generate', async (_e, { deviceId } = {}) =>
    insightsService.generateInsights(deviceId || getDeviceId())
  );

  ipcMain.handle('notifications:getRecent', async (_e, { limit } = {}) => dbRepo.getRecentNotifications(limit));

  ipcMain.handle('settings:get', async () => dbRepo.getSettings());
  ipcMain.handle('settings:set', async (_e, { key, value }) => {
    dbRepo.setSetting(key, value);
    return dbRepo.getSettings();
  });

  ipcMain.handle('warranty:list', async (_e, { deviceId } = {}) => dbRepo.getWarranty(deviceId || getDeviceId()));
  ipcMain.handle('warranty:add', async (_e, record) => dbRepo.addWarranty(getDeviceId(), record));

  ipcMain.handle('repairs:list', async (_e, { deviceId } = {}) => dbRepo.getRepairs(deviceId || getDeviceId()));
  ipcMain.handle('repairs:add', async (_e, record) => dbRepo.addRepair(getDeviceId(), record));

  ipcMain.handle('reports:generate', async (_e, { type }) => {
    const deviceId = getDeviceId();
    let filePath;
    if (type === 'battery') filePath = await reportsService.generateBatteryReport(deviceId, await systemInfo.getDeviceIdentity());
    else if (type === 'storage') filePath = await reportsService.generateStorageReport(deviceId, dbRepo.getLatestStorageScan(deviceId, (await storageAnalyzer.getDriveUsage())?.drive));
    else if (type === 'warranty') filePath = await reportsService.generateWarrantyReport(deviceId);
    else if (type === 'repair') filePath = await reportsService.generateRepairReport(deviceId);
    else throw new Error(`Unknown report type: ${type}`);
    shell.showItemInFolder(filePath);
    return filePath;
  });
}

module.exports = { registerIpcHandlers };
