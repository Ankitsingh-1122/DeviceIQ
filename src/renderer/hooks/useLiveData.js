import { useEffect, useState, useCallback } from 'react';

const api = typeof window !== 'undefined' ? window.electronAPI : null;

/** Full one-shot system snapshot: device identity, battery, cpu, memory, disks */
export function useSystemSnapshot() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!api) { setError('electronAPI unavailable — running outside Electron?'); setLoading(false); return; }
    try {
      const data = await api.system.getFullSnapshot();
      setSnapshot(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // live push updates from the main-process poller
  useEffect(() => {
    if (!api) return;
    const unsubscribe = api.battery.onUpdate((battery) => {
      setSnapshot((prev) => (prev ? { ...prev, battery } : prev));
    });
    return unsubscribe;
  }, []);

  return { snapshot, loading, error, refresh };
}

export function useBatteryHistory(sinceHours = 24 * 7) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!api) { setLoading(false); return; }
    api.battery.getHistory({ sinceHours }).then((rows) => {
      if (mounted) { setHistory(rows); setLoading(false); }
    });
    const unsubscribe = api.battery.onUpdate(() => {
      api.battery.getHistory({ sinceHours }).then((rows) => mounted && setHistory(rows));
    });
    return () => { mounted = false; unsubscribe && unsubscribe(); };
  }, [sinceHours]);

  return { history, loading };
}

export function useWeeklyHealthTrend(weeks = 6) {
  const [trend, setTrend] = useState([]);
  useEffect(() => {
    if (!api) return;
    api.battery.getWeeklyTrend({ weeks }).then(setTrend);
  }, [weeks]);
  return trend;
}

export function useInsights() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!api) { setLoading(false); return; }
    api.insights.generate({}).then((data) => { setInsights(data); setLoading(false); });
  }, []);
  return { insights, loading };
}

export function useNotifications() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!api) return;
    api.notifications.getRecent({ limit: 50 }).then(setItems);
    const unsubscribe = api.battery.onUpdate(() => {
      api.notifications.getRecent({ limit: 50 }).then(setItems);
    });
    return unsubscribe;
  }, []);
  return items;
}

export function useStorageScan() {
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!api) return;
    api.storage.getLatestScan().then(setScan);
    const unsubscribe = api.storage.onScanProgress((p) => setProgress(p));
    return unsubscribe;
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    setProgress(null);
    try {
      const result = await api.storage.scan();
      setScan(result);
      return result;
    } finally {
      setScanning(false);
    }
  }, []);

  return { scan, scanning, progress, runScan };
}

export function useWarrantyAndRepairs() {
  const [warranty, setWarranty] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!api) { setLoading(false); return; }
    const [w, r] = await Promise.all([api.warranty.list({}), api.repairs.list({})]);
    setWarranty(w); setRepairs(r); setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addWarranty = useCallback(async (record) => { await api.warranty.add(record); refresh(); }, [refresh]);
  const addRepair = useCallback(async (record) => { await api.repairs.add(record); refresh(); }, [refresh]);

  return { warranty, repairs, loading, addWarranty, addRepair };
}

export function useSettings() {
  const [settings, setSettings] = useState({});
  useEffect(() => { if (api) api.settings.get().then(setSettings); }, []);
  const update = useCallback(async (key, value) => {
    const next = await api.settings.set(key, value);
    setSettings(next);
  }, []);
  return { settings, update };
}

export function generateReport(type) {
  if (!api) return Promise.reject(new Error('electronAPI unavailable'));
  return api.reports.generate(type);
}

export const hasElectronAPI = !!api;
