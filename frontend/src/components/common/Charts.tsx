import React from 'react';
import { inr } from '../../utils/format.js';

const short = (v: number) => {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  return a >= 1e7
    ? `${s}${(a / 1e7).toFixed(1)}Cr`
    : a >= 1e5
    ? `${s}${(a / 1e5).toFixed(1)}L`
    : a >= 1e3
    ? `${s}${(a / 1e3).toFixed(0)}k`
    : `${s}${a.toFixed(0)}`;
};

/** Grouped bars: inflow vs outflow per month */
export function InOutBars({
  data,
}: {
  data: { label: string; inflow: number; outflow: number; net: number }[];
}) {
  const W = 640;
  const H = 230;
  const P = 36;
  const max = Math.max(1, ...data.flatMap(d => [d.inflow, d.outflow]));
  const gw = (W - P) / Math.max(data.length, 1);
  const bw = Math.min(22, gw / 3);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Monthly inflow and outflow">
      {[0, 0.5, 1].map(f => (
        <g key={f}>
          <line
            x1={P}
            x2={W}
            y1={20 + (1 - f) * 160}
            y2={20 + (1 - f) * 160}
            stroke="#e3e7f0"
          />
          <text x={P - 6} y={24 + (1 - f) * 160} fontSize="10" textAnchor="end" fill="#6b7590">
            {short(max * f)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = P + i * gw + gw / 2;
        const hi = (d.inflow / max) * 160;
        const ho = (d.outflow / max) * 160;
        return (
          <g key={d.label}>
            <rect
              x={x - bw - 2}
              y={180 - hi}
              width={bw}
              height={hi}
              rx="3"
              fill="#12b39a"
            >
              <title>In: {inr(d.inflow)}</title>
            </rect>
            <rect
              x={x + 2}
              y={180 - ho}
              width={bw}
              height={ho}
              rx="3"
              fill="#E91E7B"
            >
              <title>Out: {inr(d.outflow)}</title>
            </rect>
            <text x={x} y={196} fontSize="11" textAnchor="middle" fill="#1b2440">
              {d.label}
            </text>
            <text
              x={x}
              y={212}
              fontSize="10"
              textAnchor="middle"
              fill={d.net >= 0 ? '#0b8a74' : '#dc2626'}
            >
              {d.net >= 0 ? '+' : ''}
              {short(d.net)}
            </text>
          </g>
        );
      })}
      <g fontSize="11">
        <rect x={W - 150} y={2} width="10" height="10" fill="#12b39a" />
        <text x={W - 136} y={11}>Income</text>
        <rect x={W - 80} y={2} width="10" height="10" fill="#E91E7B" />
        <text x={W - 66} y={11}>Expense</text>
      </g>
    </svg>
  );
}

/** Horizontal category bars */
export function CategoryBars({
  rows,
}: {
  rows: { category: string; color?: string; amount: number }[];
}) {
  const max = Math.max(1, ...rows.map(r => r.amount));
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      {rows.map(r => (
        <div key={r.category} style={{ marginBottom: 12 }}>
          <div className="row">
            <span className="dot" style={{ background: r.color ?? '#3B4FE0' }} />
            {r.category}
            <div className="spacer" />
            <b>{inr(r.amount)}</b>
            <span className="muted" style={{ width: 48, textAlign: 'right' }}>
              {total ? Math.round((r.amount / total) * 100) : 0}%
            </span>
          </div>
          <div className="bar-bg">
            <div
              className="bar"
              style={{
                width: `${(r.amount / max) * 100}%`,
                background: r.color ?? '#3B4FE0',
              }}
            />
          </div>
        </div>
      ))}
      {!rows.length && <p className="muted">No data for this period</p>}
    </div>
  );
}

