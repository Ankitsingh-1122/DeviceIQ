import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  HardDrive, BatteryCharging, ShieldCheck, Wrench, TrendingUp, Sparkles, Bell, FileText,
  CheckCircle2, Thermometer, Zap, Clock, Battery, Download, Info, Cpu, TrendingDown,
  AlertTriangle, CalendarClock, FileWarning, Moon, Laptop,
} from 'lucide-react';
import {
  Pill, SectionHeader, StatCard, BatteryGauge, EmptyState, ChartTooltip,
  COLOR_MAP, SOFT_MAP, btnPrimary, btnGhost,
} from '../components/shared.jsx';
import {
  useSystemSnapshot, useBatteryHistory, useWeeklyHealthTrend, useInsights,
  useNotifications, useStorageScan, useWarrantyAndRepairs, generateReport,
} from '../hooks/useLiveData.js';

const bytesToGB = (b) => (b || 0) / 1024 ** 3;

/* ============================== DASHBOARD ============================== */

export function DashboardView() {
  const { snapshot, loading, error } = useSystemSnapshot();
  const { history } = useBatteryHistory(24 * 7);
  const drainSeries = useMemo(() => {
    // real drain-per-day computed from stored samples
    const byDay = {};
    for (const h of history) {
      const day = h.timestamp?.slice(0, 10);
      if (!day) continue;
      if (!byDay[day]) byDay[day] = { min: h.percent, max: h.percent };
      byDay[day].min = Math.min(byDay[day].min, h.percent);
      byDay[day].max = Math.max(byDay[day].max, h.percent);
    }
    return Object.entries(byDay).slice(-7).map(([d, v]) => ({ d: d.slice(5), pct: Math.max(0, v.max - v.min) }));
  }, [history]);

  if (loading) return <EmptyState icon={Cpu} title="Reading live system data…" desc="Querying Windows via WMI for battery, CPU, and memory info." />;
  if (error) return <EmptyState icon={AlertTriangle} title="Couldn't read system data" desc={error} />;

  const { device, battery, cpu, memory } = snapshot;
  const health = battery?.hasBattery && battery.designCapacity
    ? (battery.maxCapacity / battery.designCapacity) * 100
    : null;
  const wear = health != null ? 100 - health : null;


  return (
    <div>
      <SectionHeader eyebrow="Overview" title={device.name} desc={`${device.manufacturer || ''} ${device.model || ''}`.trim() || 'Live data from this PC'}
        right={battery?.hasBattery ? <Pill color={battery.isCharging ? 'emerald' : 'blue'}>{battery.isCharging ? 'Charging' : 'On battery'}</Pill> : <Pill color="violet">Desktop — no battery</Pill>} />

      {!battery?.hasBattery ? (
        <EmptyState icon={Laptop} title="No battery detected" desc="This machine reports no battery (desktop PC or VM). Battery-specific panels are hidden; CPU/RAM/storage tracking still runs." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, marginBottom: 20 }}>
          <div className="card card-lift fade-up" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <BatteryGauge score={health ?? battery.percent} charging={battery.isCharging} level={battery.percent} />
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <Pill color={wear != null && wear < 15 ? 'emerald' : wear != null && wear < 30 ? 'amber' : 'red'}>
                {wear != null ? `${wear.toFixed(1)}% wear` : 'Health unavailable'}
              </Pill>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <StatCard label="Battery Cycles" value={battery.cycleCount ?? '—'} unit="cycles" icon={Battery} accent="blue" />
            <StatCard label="Current Capacity" value={battery.maxCapacity ? Math.round(battery.maxCapacity) : '—'} unit="mWh" icon={Cpu} accent="violet" sub={battery.designCapacity ? `Design: ${Math.round(battery.designCapacity)} mWh` : null} />
            <StatCard label="Battery Wear" value={wear != null ? wear.toFixed(1) : '—'} unit="%" icon={TrendingDown} accent="amber" />
            <StatCard label="CPU Temperature" value={cpu.temperature != null ? cpu.temperature.toFixed(0) : '—'} unit="°C" icon={Thermometer} accent="emerald" sub={cpu.temperature == null ? 'Sensor unavailable' : 'Live reading'} />
            <StatCard label="CPU Load" value={cpu.loadPercent} unit="%" icon={Zap} accent="blue" />
            <StatCard label="Time Remaining" value={battery.timeRemainingMin ? Math.round(battery.timeRemainingMin / 60) : '—'} unit="hrs" icon={Clock} accent="violet" />
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div className="card fade-up" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Daily battery drain</div>
            <Pill color="blue">From recorded history</Pill>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>Range between daily min/max charge level</div>
          {drainSeries.length === 0 ? (
            <EmptyState icon={TrendingDown} title="Not enough history yet" desc="DeviceIQ samples your battery every few minutes. Charts populate as data accumulates." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={drainSeries} margin={{ left: -20, top: 10 }}>
                <defs>
                  <linearGradient id="drainFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--blue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip unit="%" />} cursor={{ stroke: 'var(--border-strong)' }} />
                <Area type="monotone" dataKey="pct" stroke="var(--blue)" strokeWidth={2.5} fill="url(#drainFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <HealthTrendCard />
      </div>
    </div>
  );
}

function HealthTrendCard() {
  const trend = useWeeklyHealthTrend(6);
  const data = trend.filter((t) => t.health != null).map((t) => ({ w: t.week, health: Math.round(t.health * 10) / 10 }));
  return (
    <div className="card fade-up" style={{ padding: 24 }}>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Health trend</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>Weekly average, from stored samples</div>
      {data.length < 2 ? (
        <EmptyState icon={TrendingUp} title="Trend building" desc="Health trend needs at least two weeks of samples to plot." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ left: -20, top: 10 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="w" stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
            <Tooltip content={<ChartTooltip unit="%" />} cursor={{ stroke: 'var(--border-strong)' }} />
            <Line type="monotone" dataKey="health" stroke="var(--violet)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--violet)' }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ============================== STORAGE ============================== */

const CATEGORY_COLORS = {
  Photos: 'var(--blue)', Videos: 'var(--violet)', Documents: '#a78bfa', Audio: '#f0b86e',
  Archives: '#5b8def', Executables: 'var(--red)', Other: '#7d7e88',
};

export function StorageView() {
  const { scan, scanning, progress, runScan } = useStorageScan();

  const breakdown = scan?.breakdown ? Object.entries(scan.breakdown).map(([name, bytes]) => ({ name, value: bytesToGB(bytes), color: CATEGORY_COLORS[name] || '#888' })) : [];
  const total = scan?.total_bytes ?? scan?.drive?.totalBytes;
  const used = scan?.used_bytes ?? scan?.drive?.usedBytes;

  return (
    <div>
      <SectionHeader eyebrow="Storage" title="Storage Analyzer"
        desc={total ? `${bytesToGB(total).toFixed(0)} GB drive · ${bytesToGB(used).toFixed(1)} GB used` : 'Scan your user folders to see real usage'}
        right={<button style={btnPrimary} onClick={runScan} disabled={scanning}>{scanning ? (progress ? `Scanning ${progress.folder}…` : 'Scanning…') : 'Scan now'}</button>} />

      {!scan ? (
        <EmptyState icon={HardDrive} title="No scan yet" desc="Click “Scan now” to analyze your Downloads, Documents, Pictures, Videos, and Desktop folders for real usage, large files, and duplicates." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 20, marginBottom: 20 }}>
          <div className="card fade-up" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={68} outerRadius={100} paddingAngle={2} strokeWidth={0}>
                  {breakdown.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div className="glass" style={{ padding: '8px 12px', borderRadius: 10, fontSize: 12 }}>
                    <div style={{ fontWeight: 700 }}>{payload[0].name}</div>
                    <div className="num" style={{ color: 'var(--text-dim)' }}>{payload[0].value.toFixed(2)} GB</div>
                  </div>
                ) : null} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', width: '100%', marginTop: 4 }}>
              {breakdown.map((s) => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-dim)' }}>{s.name}</span>
                  <span className="num" style={{ marginLeft: 'auto', fontWeight: 600 }}>{s.value.toFixed(1)} GB</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card fade-up" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <FileWarning size={16} color="var(--amber)" />
                <div style={{ fontWeight: 600, fontSize: 14 }}>Duplicate files detected</div>
                <Pill color="amber">{bytesToGB(scan.duplicates.reduce((a, d) => a + d.totalReclaimableBytes, 0)).toFixed(2)} GB reclaimable</Pill>
              </div>
              {scan.duplicates.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>No duplicates found in scanned folders.</div> :
                scan.duplicates.slice(0, 6).map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-dim)' }}>{f.name} ({f.count} copies)</span>
                    <span className="num" style={{ fontWeight: 600 }}>{bytesToGB(f.totalReclaimableBytes).toFixed(2)} GB</span>
                  </div>
                ))}
            </div>
            <div className="card fade-up" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <HardDrive size={16} color="var(--blue)" />
                <div style={{ fontWeight: 600, fontSize: 14 }}>Largest files</div>
              </div>
              {scan.largeFiles.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>No files over 100MB found.</div> :
                scan.largeFiles.slice(0, 6).map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-dim)' }} title={f.path}>{f.name}</span>
                    <span className="num" style={{ fontWeight: 600 }}>{bytesToGB(f.sizeBytes).toFixed(2)} GB</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== CHARGING HABITS ============================== */

export function ChargingView() {
  const { history } = useBatteryHistory(24 * 14);

  const stats = useMemo(() => {
    if (history.length < 2) return null;
    const chargeTransitions = [];
    for (let i = 1; i < history.length; i++) {
      if (!history[i - 1].is_charging && history[i].is_charging) chargeTransitions.push({ start: i });
    }
    const overnightCount = history.filter((h) => {
      const hr = new Date(h.timestamp).getHours();
      return h.is_charging && (hr >= 22 || hr <= 6);
    }).length;
    const chargingSamples = history.filter((h) => h.is_charging);
    const dischargingSamples = history.filter((h) => !h.is_charging);
    const avgPlugIn = dischargingSamples.length ? dischargingSamples.reduce((a, h) => a + h.percent, 0) / dischargingSamples.length : null;
    const avgLevel = chargingSamples.length ? chargingSamples.reduce((a, h) => a + h.percent, 0) / chargingSamples.length : null;
    return { overnightCount, sampleCount: history.length, avgPlugIn, avgLevel, chargingSamples: chargingSamples.length };
  }, [history]);

  const weekly = useMemo(() => {
    const byDay = {};
    for (const h of history) {
      const day = h.timestamp?.slice(0, 10);
      if (!day) continue;
      if (!byDay[day]) byDay[day] = { charging: 0, total: 0 };
      byDay[day].total++;
      if (h.is_charging) byDay[day].charging++;
    }
    return Object.entries(byDay).slice(-7).map(([d, v]) => ({ d: d.slice(5), score: Math.round((1 - v.charging / v.total) * 100) }));
  }, [history]);

  return (
    <div>
      <SectionHeader eyebrow="Habits" title="Charging Habit Analyzer" desc="Computed from your actual recorded charge samples." />
      {!stats ? (
        <EmptyState icon={BatteryCharging} title="Collecting data" desc="Charging habit stats need a couple of days of background samples to become meaningful." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            <StatCard label="Avg. level while on battery" value={stats.avgPlugIn ? stats.avgPlugIn.toFixed(0) : '—'} unit="%" icon={BatteryCharging} accent="blue" />
            <StatCard label="Avg. level while charging" value={stats.avgLevel ? stats.avgLevel.toFixed(0) : '—'} unit="%" icon={Battery} accent="emerald" />
            <StatCard label="Overnight charging samples" value={stats.overnightCount} unit={`/${stats.sampleCount}`} icon={Moon} accent="amber" />
          </div>
          <div className="card fade-up" style={{ padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Daily charging score</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>Higher = more time spent unplugged (gentler on the battery)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weekly} margin={{ left: -20, top: 10 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface2)' }} />
                <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                  {weekly.map((e, i) => <Cell key={i} fill={e.score >= 75 ? 'var(--emerald)' : e.score >= 60 ? 'var(--amber)' : 'var(--red)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================== ANALYTICS ============================== */

export function AnalyticsView() {
  const { history } = useBatteryHistory(24 * 3);
  const tempSeries = history.filter((h) => h.temperature != null).map((h) => ({ t: h.timestamp.slice(11, 16), c: h.temperature }));

  return (
    <div>
      <SectionHeader eyebrow="Analytics" title="Battery Analytics" desc="Trends computed directly from stored samples — nothing simulated." />
      <div className="card fade-up" style={{ padding: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Temperature history</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>Last 72 hours (CPU sensor used as proxy where no battery sensor exists)</div>
        {tempSeries.length === 0 ? (
          <EmptyState icon={Thermometer} title="No temperature data" desc="This device did not report a usable temperature sensor for the tracked period." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={tempSeries} margin={{ left: -20, top: 10 }}>
              <defs>
                <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--red)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--red)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="t" stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip unit="°C" />} cursor={{ stroke: 'var(--border-strong)' }} />
              <Area type="monotone" dataKey="c" stroke="var(--red)" strokeWidth={2.5} fill="url(#tempFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* ============================== AI INSIGHTS ============================== */

export function InsightsView() {
  const { insights, loading } = useInsights();
  const levelColor = { good: 'emerald', warn: 'amber', bad: 'red', info: 'blue' };
  return (
    <div>
      <SectionHeader eyebrow="AI Insights" title="Your battery, explained" desc="Generated from your device's stored history — statistical, not scripted." />
      {loading ? (
        <EmptyState icon={Sparkles} title="Analyzing history…" desc="Running trend analysis over your stored battery samples." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {insights.map((ins, i) => {
            const color = levelColor[ins.level] || 'blue';
            return (
              <div key={ins.key || i} className="card card-lift fade-up" style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start', animationDelay: `${i * 40}ms` }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: SOFT_MAP[color], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={17} color={COLOR_MAP[color]} />
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text)' }}>{ins.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================== WARRANTY ============================== */

export function WarrantyView() {
  const { warranty, loading, addWarranty } = useWarrantyAndRepairs();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: '', purchase_date: '', expires_date: '', coverage_type: '' });

  const active = warranty[0];
  const daysLeft = active?.expires_date ? Math.ceil((new Date(active.expires_date) - Date.now()) / 86400000) : null;

  const submit = async (e) => {
    e.preventDefault();
    await addWarranty(form);
    setShowForm(false);
    setForm({ provider: '', purchase_date: '', expires_date: '', coverage_type: '' });
  };

  return (
    <div>
      <SectionHeader eyebrow="Warranty" title="Warranty Manager" desc="User-entered coverage records — there is no OS API for this data."
        right={daysLeft != null ? <Pill color={daysLeft < 30 ? 'amber' : 'emerald'}>{daysLeft > 0 ? `Expires in ${daysLeft} days` : 'Expired'}</Pill> : null} />

      <div className="card fade-up" style={{ padding: 24, marginBottom: 16 }}>
        {loading ? <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Loading…</div> : warranty.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No warranty on file" desc="Add your coverage details to track expiration and get reminders." />
        ) : (
          warranty.map((w) => (
            <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderTop: '1px solid var(--border)', fontSize: 13.5 }}>
              <span>{w.provider} · {w.coverage_type}</span>
              <span className="num" style={{ fontWeight: 600 }}>{w.purchase_date} → {w.expires_date}</span>
            </div>
          ))
        )}
      </div>

      {!showForm ? (
        <button style={btnPrimary} onClick={() => setShowForm(true)}>Add warranty record</button>
      ) : (
        <form onSubmit={submit} className="card fade-up" style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input required placeholder="Provider (e.g. AppleCare+)" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} style={inputStyle} />
          <input required placeholder="Coverage type" value={form.coverage_type} onChange={(e) => setForm({ ...form, coverage_type: e.target.value })} style={inputStyle} />
          <input required type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} style={inputStyle} />
          <input required type="date" value={form.expires_date} onChange={(e) => setForm({ ...form, expires_date: e.target.value })} style={inputStyle} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
            <button type="submit" style={btnPrimary}>Save</button>
            <button type="button" style={btnGhost} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ============================== REPAIR HISTORY ============================== */

export function RepairView() {
  const { repairs, loading, addRepair } = useWarrantyAndRepairs();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', part: '', cost: '', service_center: '', under_warranty: false, notes: '' });
  const totalCost = repairs.reduce((a, b) => a + (b.cost || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    await addRepair({ ...form, cost: parseFloat(form.cost) || 0, under_warranty: form.under_warranty ? 1 : 0 });
    setShowForm(false);
    setForm({ date: '', part: '', cost: '', service_center: '', under_warranty: false, notes: '' });
  };

  return (
    <div>
      <SectionHeader eyebrow="Service" title="Repair History" desc="Logged repairs, stored locally." right={<Pill color="blue">${totalCost.toFixed(2)} total spend</Pill>} />
      <div className="card fade-up" style={{ padding: 24, marginBottom: 16 }}>
        {loading ? <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Loading…</div> : repairs.length === 0 ? (
          <EmptyState icon={Wrench} title="No repairs logged" desc="Add a repair record to start tracking service history and cost." />
        ) : repairs.map((r, i) => (
          <div key={r.id} style={{ display: 'flex', gap: 16, padding: '16px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--blue-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Wrench size={16} color="var(--blue)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{r.part}</span>
                <span className="num" style={{ fontWeight: 700, fontSize: 14 }}>{r.cost > 0 ? `$${r.cost}` : 'Free'}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span>{r.date}</span><span>·</span><span>{r.service_center}</span>
                {!!r.under_warranty && <Pill color="emerald">Under warranty</Pill>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!showForm ? (
        <button style={btnPrimary} onClick={() => setShowForm(true)}>Log a repair</button>
      ) : (
        <form onSubmit={submit} className="card fade-up" style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
          <input required placeholder="Part / service" value={form.part} onChange={(e) => setForm({ ...form, part: e.target.value })} style={inputStyle} />
          <input required type="number" step="0.01" placeholder="Cost ($)" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} style={inputStyle} />
          <input placeholder="Service center" value={form.service_center} onChange={(e) => setForm({ ...form, service_center: e.target.value })} style={inputStyle} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form.under_warranty} onChange={(e) => setForm({ ...form, under_warranty: e.target.checked })} /> Under warranty
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
            <button type="submit" style={btnPrimary}>Save</button>
            <button type="button" style={btnGhost} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13.5 };

/* ============================== NOTIFICATIONS ============================== */

export function NotificationsView() {
  const items = useNotifications();
  const iconFor = { battery_low: Battery, overheat: Thermometer, storage_full: HardDrive, warranty_expiring: ShieldCheck, repair_reminder: Wrench };
  const colorFor = { critical: 'red', warn: 'amber', info: 'blue' };
  return (
    <div>
      <SectionHeader eyebrow="Alerts" title="Notifications" desc="Real alerts fired from live thresholds — persisted to the local database." />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="All clear" desc="No alerts have fired yet. DeviceIQ checks battery level, temperature, storage, and warranty status on every poll." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((n, i) => {
            const Icon = iconFor[n.type] || Bell;
            const color = colorFor[n.severity] || 'blue';
            return (
              <div key={n.id} className="card card-lift fade-up" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'center', animationDelay: `${i * 30}ms` }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: SOFT_MAP[color], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color={COLOR_MAP[color]} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{n.body}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0 }}>{n.created_at}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================== DEVICES ============================== */

export function DevicesView() {
  const { snapshot, loading } = useSystemSnapshot();
  if (loading || !snapshot) return <EmptyState icon={Laptop} title="Reading device info…" desc="" />;
  const { device, battery, memory, disks } = snapshot;
  return (
    <div>
      <SectionHeader eyebrow="This machine" title="Device Manager" desc="Windows only exposes hardware telemetry for the machine it's running on — multi-device fleets require a companion agent per device." />
      <div className="card card-lift fade-up" style={{ padding: 24, maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Laptop size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{device.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{device.manufacturer} {device.model}</div>
          </div>
        </div>
        {[
          ['CPU', device.cpu],
          ['RAM', `${device.ram_gb} GB`],
          ['OS', device.os_version],
          ['Serial number', device.serial_number || 'Not exposed by BIOS'],
          ['Battery', battery?.hasBattery ? `${battery.percent}% · ${battery.isCharging ? 'charging' : 'on battery'}` : 'No battery detected'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 13.5 }}>
            <span style={{ color: 'var(--text-dim)' }}>{k}</span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== REPORTS ============================== */

export function ReportsView() {
  const [generating, setGenerating] = useState(null);
  const [lastPath, setLastPath] = useState(null);
  const reports = [
    { id: 'battery', label: 'Battery Report', desc: 'Real health, cycles, and 30-day history from the database.', icon: Cpu, accent: 'blue' },
    { id: 'repair', label: 'Repair Report', desc: 'Every logged repair and total spend.', icon: Wrench, accent: 'violet' },
    { id: 'warranty', label: 'Warranty Report', desc: 'Coverage and expiration status.', icon: ShieldCheck, accent: 'emerald' },
    { id: 'storage', label: 'Storage Report', desc: 'Latest scan breakdown and reclaimable space.', icon: HardDrive, accent: 'amber' },
  ];
  const trigger = async (id) => {
    setGenerating(id);
    try {
      const path = await generateReport(id);
      setLastPath(path);
    } finally {
      setGenerating(null);
    }
  };
  return (
    <div>
      <SectionHeader eyebrow="Export" title="Reports" desc="Generates a real PDF from your local database and opens its folder." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {reports.map((r) => (
          <div key={r.id} className="card card-lift fade-up" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: SOFT_MAP[r.accent], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <r.icon size={18} color={COLOR_MAP[r.accent]} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{r.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{r.desc}</div>
              </div>
            </div>
            <button onClick={() => trigger(r.id)} style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: generating === r.id ? 0.7 : 1 }} disabled={generating === r.id}>
              {generating === r.id ? 'Generating…' : <><Download size={14} /> Generate PDF</>}
            </button>
          </div>
        ))}
      </div>
      {lastPath && (
        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={13} /> Saved to {lastPath}
        </div>
      )}
    </div>
  );
}
