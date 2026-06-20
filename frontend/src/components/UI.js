import React from 'react';

export function Spinner() {
  return (
    <div className="flex-center" style={{ height: 200 }}>
      <div className="spinner" />
    </div>
  );
}

export function Badge({ text, variant = 'blue' }) {
  return <span className={`badge badge-${variant}`}>{text}</span>;
}

export function StatusBadge({ status }) {
  const map = {
    pending:  { v: 'amber', l: 'En attente' },
    active:   { v: 'green', l: 'Actif' },
    rejected: { v: 'red',   l: 'Rejeté' },
    blocked:  { v: 'red',   l: 'Bloqué' },
  };
  const m = map[status] || { v: 'gray', l: status };
  return <Badge text={m.l} variant={m.v} />;
}

export function GradeBadge({ pct }) {
  const v = pct >= 75 ? 'green' : pct >= 61 ? 'amber' : 'red';
  const l = pct >= 75 ? '✓ Reçu' : pct >= 61 ? '≈ Limite' : '✗ Échoué';
  return <Badge text={l} variant={v} />;
}

export function ScoreDial({ correct, total }) {
  const p = total ? Math.round(correct / total * 100) : 0;
  const r = 44, cx = 56, cy = 56;
  const circ = 2 * Math.PI * r;
  const dash = (p / 100) * circ;
  const color = p >= 75 ? '#22c55e' : p >= 61 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ textAlign: 'center', position: 'relative', display: 'inline-block' }}>
      <svg width={112} height={112} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={9} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{p}%</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{correct}/{total}</div>
      </div>
    </div>
  );
}

export function InputField({ label, icon, ...props }) {
  return (
    <div className="input-group">
      {label && <label>{label}</label>}
      <div className="input-wrap">
        {icon && <i className={`ti ${icon}`} aria-hidden="true" />}
        <input {...props} />
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => onChange(!on)}>
      <div className={`toggle ${on ? 'on' : ''}`}><div className="toggle-knob" /></div>
      {label && <span className="text-muted" style={{ fontSize: 13 }}>{label}</span>}
    </div>
  );
}

export function ProgressBar({ value, max, style = {} }) {
  const pct = max ? Math.round(value / max * 100) : 0;
  return (
    <div className="progress-bar" style={style}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
