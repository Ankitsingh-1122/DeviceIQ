const si = require('systeminformation');
const log = require('electron-log');
let cachedCpuLoad = {
  loadPercent: 0,
  temperature: null,
};

let cpuWorker = null;

/**
 * All values here come directly from `systeminformation`, which on Windows
 * reads from WMI (Win32_Battery, Win32_PortableBattery, Win32_DiskDrive,
 * Win32_OperatingSystem, Win32_Processor, Win32_ComputerSystemProduct, etc).
 * Nothing here is hardcoded — if a field is unavailable on this machine,
 * we return null rather than a fake number.
 */

async function getDeviceIdentity() {
  const [system, osInfo, cpu, mem] = await Promise.all([
    si.system(),
    si.osInfo(),
    si.cpu(),
    si.mem(),
  ]);
  // system.uuid is a stable hardware UUID (SMBIOS) — used as our device primary key
  return {
    id: system.uuid || `${system.manufacturer}-${system.model}-${osInfo.hostname}`,
    name: osInfo.hostname || system.model || 'This PC',
    manufacturer: system.manufacturer || null,
    model: system.model || null,
    serial_number: system.serial && system.serial !== '-' ? system.serial : null,
    os_version: `${osInfo.distro} ${osInfo.release} (build ${osInfo.build || 'n/a'})`,
    cpu: `${cpu.manufacturer} ${cpu.brand}`,
    ram_gb: Math.round((mem.total / 1024 ** 3) * 10) / 10,
  };
}

async function getBatterySnapshot() {
  const b = await si.battery();
  // b.hasBattery is false on desktops — caller should handle that case
  if (!b.hasBattery) return { hasBattery: false };

  return {
    hasBattery: true,
    percent: b.percent ?? null,
    isCharging: !!b.isCharging,
    acConnected: !!b.acConnected,
    voltage: b.voltage ?? null,
    designCapacity: b.designedCapacity ?? null,
    maxCapacity: b.maxCapacity ?? null,
    currentCapacity: b.currentCapacity ?? null,
    cycleCount: b.cycleCount ?? null,
    // systeminformation does not expose live battery temperature on Windows
    // (no stable WMI class for it) — surfaced as null instead of fabricated.
    temperature: null,
    timeRemainingMin: b.timeRemaining ?? null,
    type: b.type || null,
    manufacturer: b.manufacturer || null,
    model: b.model || null,
  };
}


async function updateCpuCache() {
  const load = await si.currentLoad();
  const temp = await si.cpuTemperature().catch(() => ({ main: null }));

  cachedCpuLoad = {
    loadPercent: Math.round(load.currentLoad * 10) / 10,
    temperature: temp.main ?? null,
  };
}

function startCpuWorker(interval = 2000) {
  if (cpuWorker) return;

  updateCpuCache();

  cpuWorker = setInterval(updateCpuCache, interval);
}

async function getCpuLoad() {
  return cachedCpuLoad;
}

async function getMemoryUsage() {
  const mem = await si.mem();
  return {
    totalGb: Math.round((mem.total / 1024 ** 3) * 10) / 10,
    usedGb: Math.round((mem.active / 1024 ** 3) * 10) / 10,
    freeGb: Math.round((mem.available / 1024 ** 3) * 10) / 10,
    usedPercent: Math.round((mem.active / mem.total) * 1000) / 10,
  };
}

async function getDisks() {
  const [layout, fsSize] = await Promise.all([si.diskLayout(), si.fsSize()]);
  return { physicalDisks: layout, volumes: fsSize };
}

async function getFullSnapshot() {
  const [device, battery, cpu, memory, disks] = await Promise.all([
    getDeviceIdentity(),
    getBatterySnapshot(),
    getCpuLoad(),
    getMemoryUsage(),
    getDisks(),
  ]);
  return { device, battery, cpu, memory, disks, capturedAt: new Date().toISOString() };
}

module.exports = {
  getDeviceIdentity,
  getBatterySnapshot,
  getCpuLoad,
  getMemoryUsage,
  getDisks,
  getFullSnapshot,
  startCpuWorker,
};
