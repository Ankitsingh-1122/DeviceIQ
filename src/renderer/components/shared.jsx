import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';

export const COLOR_MAP = { blue: 'var(--blue)', violet: 'var(--violet)', emerald: 'var(--emerald)', amber: 'var(--amber)', red: 'var(--red)' };
export const SOFT_MAP = { blue: 'var(--blue-soft)', violet: 'var(--violet-soft)', emerald: 'var(--emerald-soft)', amber: 'var(--amber-soft)', red: 'var(--red-soft)' };

export const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12,
  background: 'linear-gradient(135deg, var(--blue), var(--violet))', color: '#fff', border: 'none',
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
};
export const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12,
  background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)',
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
};

export function Pill({ children, color = 'blue' }) {
  return (
    <span className="num" style={{
      fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
      background: SOFT_MAP[color], color: COLOR_MAP[color], display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>{children}</span>
  );
}

export function SectionHeader({ eyebrow, title, desc, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
      <div>
        {eyebrow && <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }}>{eyebrow}</div>}
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{title}</h1>
        {desc && <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '6px 0 0' }}>{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function StatCard({ label, value, unit, sub, icon: Icon, accent = 'blue', trend }) {
  return (
    <div className="card card-lift fade-up" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: SOFT_MAP[accent], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} color={COLOR_MAP[accent]} />
        </div>
        {trend != null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: trend > 0 ? 'var(--emerald)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 2 }}>
            {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="num" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}<span style={{ fontSize: 14, color: 'var(--text-dim)', fontWeight: 500, marginLeft: 3 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function BatteryGauge({ score = 0, charging = false, level = null }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(score), 150); return () => clearTimeout(t); }, [score]);
  const r = 78, c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, animated)) / 100) * c;
  const color = score >= 80 ? 'var(--emerald)' : score >= 60 ? 'var(--amber)' : 'var(--red)';
  return (
    <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glow" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle, ${color}22, transparent 70%)` }} />
      <svg width={200} height={200} viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
        <circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.19,1,.22,1)' }} />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="num" style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em' }}>{score != null ? Math.round(score) : '—'}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.04em' }}>HEALTH SCORE</div>
        {charging && (
          <div className="pulse-dot" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, color: 'var(--emerald)', fontWeight: 600 }}>
            <Zap size={12} fill="var(--emerald)" /> Charging{level != null ? ` · ${level}%` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="card" style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon size={22} color="var(--text-faint)" />
      </div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 320, margin: '0 auto' }}>{desc}</div>
    </div>
  );
}

export function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="glass" style={{ padding: '8px 12px', borderRadius: 10, fontSize: 12 }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>{label}</div>
      <div className="num" style={{ fontWeight: 700 }}>{payload[0].value}{unit}</div>
    </div>
  );
}

export const CSS = `
  .biq { --bg:#09090B; --surface:#111214; --surface2:#17181c; --surface3:#1e2025;
    --border: rgba(255,255,255,0.07); --border-strong: rgba(255,255,255,0.14);
    --text:#F5F5F7; --text-dim:#9a9ba5; --text-faint:#63646d;
    --blue:#4C8DFF; --blue-soft: rgba(76,141,255,0.14);
    --violet:#8B6BF2; --violet-soft: rgba(139,107,242,0.14);
    --emerald:#34D399; --emerald-soft: rgba(52,211,153,0.14);
    --amber:#F5A623; --amber-soft: rgba(245,166,35,0.14);
    --red:#F5654C; --red-soft: rgba(245,101,76,0.14);
    background: var(--bg); color: var(--text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    min-height: 100%; position: relative; overflow-x: hidden;
  }
  .biq.light { --bg:#F4F4F6; --surface:#FFFFFF; --surface2:#F7F7F9; --surface3:#EFEFF3;
    --border: rgba(9,9,11,0.08); --border-strong: rgba(9,9,11,0.14);
    --text:#0B0B0D; --text-dim:#5b5c66; --text-faint:#96979f;
  }
  .biq * { box-sizing: border-box; }
  .biq ::-webkit-scrollbar { width: 8px; height: 8px; }
  .biq ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 8px; }
  .biq ::-webkit-scrollbar-track { background: transparent; }
  .glass { background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border); }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
    transition: border-color .25s ease, transform .25s ease, box-shadow .25s ease; }
  .card:hover { border-color: var(--border-strong); }
  .card-lift:hover { transform: translateY(-2px); box-shadow: 0 12px 32px -12px rgba(0,0,0,0.5); }
  .grad-text { background: linear-gradient(135deg, var(--blue), var(--violet));
    -webkit-background-clip: text; background-clip: text; color: transparent; }
  .num { font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .fade-up { animation: fadeUp .5s cubic-bezier(.19,1,.22,1) both; }
  @keyframes fadeUp { from { opacity:0; transform: translateY(10px);} to { opacity:1; transform: translateY(0);} }
  .pulse-dot { animation: pulseDot 2s ease-in-out infinite; }
  @keyframes pulseDot { 0%,100% { opacity:1; } 50% { opacity:.35; } }
  .nav-item { transition: background .2s ease, color .2s ease; }
  .nav-item:hover { background: var(--surface2); }
  .scale-in { animation: scaleIn .18s ease both; }
  @keyframes scaleIn { from { opacity:0; transform: scale(.97);} to { opacity:1; transform: scale(1);} }
  .glow { filter: drop-shadow(0 0 24px rgba(76,141,255,0.35)); }
  @media (prefers-reduced-motion: reduce) { .fade-up, .pulse-dot, .scale-in { animation: none !important; } }
`;
