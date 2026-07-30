const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  system: {
    getFullSnapshot: () => ipcRenderer.invoke('system:getFullSnapshot'),
    getBattery: () => ipcRenderer.invoke('system:getBattery'),
    getDisks: () => ipcRenderer.invoke('system:getDisks'),
  },
  battery: {
    getHistory: (params) => ipcRenderer.invoke('battery:getHistory', params),
    getLatest: (params) => ipcRenderer.invoke('battery:getLatest', params),
    getWeeklyTrend: (params) => ipcRenderer.invoke('battery:getWeeklyTrend', params),
    onUpdate: (callback) => {
      const listener = (_e, data) => callback(data);
      ipcRenderer.on('battery:update', listener);
      return () => ipcRenderer.removeListener('battery:update', listener);
    },
  },
  storage: {
    getDriveUsage: () => ipcRenderer.invoke('storage:getDriveUsage'),
    scan: () => ipcRenderer.invoke('storage:scan'),
    getLatestScan: () => ipcRenderer.invoke('storage:getLatestScan'),
    onScanProgress: (callback) => {
      const listener = (_e, data) => callback(data);
      ipcRenderer.on('storage:scanProgress', listener);
      return () => ipcRenderer.removeListener('storage:scanProgress', listener);
    },
  },
  insights: {
    generate: (params) => ipcRenderer.invoke('insights:generate', params),
  },
  notifications: {
    getRecent: (params) => ipcRenderer.invoke('notifications:getRecent', params),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
  },
  warranty: {
    list: (params) => ipcRenderer.invoke('warranty:list', params),
    add: (record) => ipcRenderer.invoke('warranty:add', record),
  },
  repairs: {
    list: (params) => ipcRenderer.invoke('repairs:list', params),
    add: (record) => ipcRenderer.invoke('repairs:add', record),
  },
  reports: {
    generate: (type) => ipcRenderer.invoke('reports:generate', { type }),
  },
});
