# DeviceIQ — Phase 2 (Electron + Real Data)

This is the production backend wired to your existing UI. **No mocked data
remains in the Dashboard, Storage, Charging, Analytics, Insights, Warranty,
Repairs, Notifications, Devices, or Reports views** — each reads from either
live Windows APIs (via `systeminformation`, which wraps WMI) or from the
local SQLite database that DeviceIQ populates in the background.

## Run it

```bash
npm install
npm run dev        # starts Vite + Electron together
```

Package a Windows installer:

```bash
npm run build
```

## Architecture

```
Electron (main.js)
  ├─ services/systemInfo.js     → WMI via systeminformation (battery, cpu, ram, disks, device identity)
  ├─ services/storageAnalyzer.js→ real fs walk of Downloads/Documents/Pictures/Videos/Desktop
  ├─ services/notifications.js  → threshold checks → Electron Notification + SQLite
  ├─ services/insights.js       → linear-regression trend analysis over stored history
  ├─ services/reports.js        → pdfkit reports from live DB data
  ├─ db/database.js             → better-sqlite3, schema + repository functions
  └─ ipc/handlers.js            → ipcMain.handle bridge
        │  (contextBridge, sandboxed)
        ▼
preload.js → window.electronAPI
        │
        ▼
React frontend (src/renderer)
  ├─ hooks/useLiveData.js  → typed hooks over window.electronAPI
  ├─ views/index.jsx       → Dashboard/Storage/Charging/Analytics/Insights/Warranty/Repair/Notifications/Devices/Reports
  └─ App.jsx               → your original locked layout (sidebar, topbar, command palette) unchanged
```

A background poller in `main.js` samples the battery every N minutes
(configurable, default 5), writes to `battery_history`, tracks charging
sessions, evaluates notification thresholds, and pushes live updates to the
renderer over `battery:update`.

## Honest limitations (read before demoing)

- **Battery temperature**: Windows does not expose a stable WMI class for
  live battery temperature on most laptops. We use CPU temperature (via
  `si.cpuTemperature()`) as the closest available proxy and label it as such
  in the UI. We do **not** fabricate a battery temperature number.
- **Charge rate (W)**: not reliably exposed by `Win32_Battery`; the field
  exists in the schema for hardware where it is available, otherwise stored
  as `null`. The dashboard shows `—` rather than guessing.
- **Serial number / cycle count**: some manufacturers block these in BIOS/WMI;
  when unavailable the UI shows "Not exposed by BIOS" instead of a fake value.
- **Multi-device fleet** ("Pixel 9 Pro", "AirPods Pro", etc. from the original
  mock array): Windows can only report on the machine DeviceIQ runs on.
  Tracking a phone/watch/earbuds fleet needs a companion mobile agent and a
  sync backend — out of scope for a Windows desktop app and removed rather
  than faked. The Devices view now shows the real local machine.
- **Storage scan** walks your user profile folders (Downloads, Documents,
  Pictures, Videos, Desktop), not the entire drive — a full-drive walk from
  the UI thread would hang the app. Duplicate detection hashes same-size
  files with SHA-1, capped at 20,000 files per scan for responsiveness.
- **Warranty / repair history**: there is no OS or vendor API for this data
  on arbitrary hardware — these are real user-entered records persisted to
  SQLite (schema + CRUD forms included), not placeholders.

## Database

SQLite file lives at Electron's `userData` path (e.g.
`%APPDATA%/DeviceIQ/DeviceIQ.db`). Tables: `device`, `battery_history`,
`charging_sessions`, `warranty`, `repair_history`, `notifications`,
`settings`, `analytics_snapshots`, `storage_scans`.

## What's next (Phase 2, continued)

Not yet in this drop — say "continue" and I'll build these against the same
real-data architecture:
1. Settings view UI (scan interval, notification toggles, CSV/DB export, auto-startup toggle — backend for all of this already exists in `settings` table + IPC, just needs a form).
2. TypeScript conversion (currently JS + JSDoc-style clarity; strict TS pass).
3. Error boundaries + structured logging surfaced in-app.
4. smartctl integration for SMART disk health (currently basic fsSize only).
5. electron-updater wiring for auto-update.
