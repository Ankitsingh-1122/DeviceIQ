import React, { useState, useEffect, useRef } from 'react';
import {
  Gauge, HardDrive, BatteryCharging, ShieldCheck, Wrench, TrendingUp, Sparkles,
  Bell, FileText, Search, Sun, Moon, ChevronRight, Battery, Laptop,
} from 'lucide-react';
import { CSS } from './components/shared.jsx';
import {
  DashboardView, StorageView, ChargingView, AnalyticsView, InsightsView,
  WarrantyView, RepairView, NotificationsView, DevicesView, ReportsView,
} from './views/index.jsx';
import { hasElectronAPI, useSettings } from './hooks/useLiveData.js';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'charging', label: 'Charging Habits', icon: BatteryCharging },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'insights', label: 'AI Insights', icon: Sparkles },
  { id: 'warranty', label: 'Warranty', icon: ShieldCheck },
  { id: 'repairs', label: 'Repair History', icon: Wrench },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'devices', label: 'Devices', icon: Laptop },
  { id: 'reports', label: 'Reports', icon: FileText },
];

function CommandPalette({ open, onClose, onNavigate }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  if (!open) return null;
  const filtered = NAV.filter((n) => n.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', justifyContent: 'center', paddingTop: '12vh' }}>
      <div onClick={(e) => e.stopPropagation()} className="glass scale-in" style={{ width: 520, maxWidth: '90vw', borderRadius: 18, height: 'fit-content', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <Search size={16} color="var(--text-faint)" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a section…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14 }} />
          <kbd style={{ fontSize: 11, color: 'var(--text-faint)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 8 }}>
          {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>No matches</div>}
          {filtered.map((n) => (
            <button key={n.id} onClick={() => { onNavigate(n.id); onClose(); }} className="nav-item" style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13.5, textAlign: 'left',
            }}>
              <n.icon size={15} color="var(--text-dim)" /> {n.label} <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'var(--text-faint)' }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { settings, update } = useSettings();
  const theme = settings.dark_mode === 'false' ? 'light' : 'dark';
  const [view, setView] = useState('dashboard');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeNav = NAV.find((n) => n.id === view);

  return (
    <div className={`biq ${theme === 'light' ? 'light' : ''}`} style={{ minHeight: '100vh' }}>
      <style>{CSS}</style>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={setView} />

      {!hasElectronAPI && (
        <div style={{ background: 'var(--red)', color: '#fff', padding: '8px 16px', fontSize: 12.5, textAlign: 'center' }}>
          Running outside Electron — no system access. Launch via <code>npm run dev</code> to see live data.
        </div>
      )}

      <div style={{ display: 'flex' }}>
        <div style={{
          width: sidebarOpen ? 232 : 76, flexShrink: 0, borderRight: '1px solid var(--border)',
          minHeight: '100vh', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column',
          transition: 'width .25s ease', background: 'var(--surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '22px 18px', overflow: 'hidden' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, var(--blue), var(--violet))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Battery size={18} color="#fff" />
            </div>
            {sidebarOpen && <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>DeviceIQ</span>}
          </div>

          <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
            {NAV.map((n) => {
              const active = n.id === view;
              return (
                <button key={n.id} onClick={() => setView(n.id)} className="nav-item" style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12,
                  background: active ? 'var(--surface2)' : 'transparent', border: 'none', cursor: 'pointer',
                  color: active ? 'var(--text)' : 'var(--text-dim)', fontSize: 13.5, fontWeight: active ? 600 : 500,
                  textAlign: 'left', width: '100%',
                }}>
                  <n.icon size={17} style={{ flexShrink: 0 }} color={active ? 'var(--blue)' : 'var(--text-dim)'} />
                  {sidebarOpen && <span style={{ whiteSpace: 'nowrap' }}>{n.label}</span>}
                </button>
              );
            })}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setSidebarOpen((o) => !o)} className="nav-item" style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12,
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 13, width: '100%',
            }}>
              <ChevronRight size={16} style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              {sidebarOpen && 'Collapse'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="glass" style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 28px', borderLeft: 'none', borderTop: 'none', borderRight: 'none' }}>
            <div style={{ fontSize: 13, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
              DeviceIQ <ChevronRight size={12} /> <span style={{ color: 'var(--text)' }}>{activeNav?.label}</span>
            </div>

            <button onClick={() => setPaletteOpen(true)} style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10,
              background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer', width: 240,
            }}>
              <Search size={14} /> Search or jump to…
              <kbd style={{ marginLeft: 'auto', fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px' }}>⌘K</kbd>
            </button>

            <button onClick={() => update('dark_mode', theme === 'dark' ? 'false' : 'true')} style={{
              width: 36, height: 36, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)',
            }}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button style={{
              width: 36, height: 36, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', position: 'relative',
            }} onClick={() => setView('notifications')}>
              <Bell size={16} />
            </button>
          </div>

          <div style={{ padding: '28px 32px 64px', maxWidth: 1280 }}>
            {view === 'dashboard' && <DashboardView />}
            {view === 'storage' && <StorageView />}
            {view === 'charging' && <ChargingView />}
            {view === 'analytics' && <AnalyticsView />}
            {view === 'insights' && <InsightsView />}
            {view === 'warranty' && <WarrantyView />}
            {view === 'repairs' && <RepairView />}
            {view === 'notifications' && <NotificationsView />}
            {view === 'devices' && <DevicesView />}
            {view === 'reports' && <ReportsView />}
          </div>
        </div>
      </div>
    </div>
  );
}
