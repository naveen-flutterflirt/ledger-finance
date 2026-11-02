import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 6,
  className = '',
  style = {},
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

export function SkeletonTopbar({ titleWidth = 160, hasButton = true }: { titleWidth?: number; hasButton?: boolean }) {
  return (
    <div className="topbar" style={{ marginBottom: 20 }}>
      <Skeleton width={titleWidth} height={28} borderRadius={6} />
      {hasButton && (
        <div className="row" style={{ gap: 10 }}>
          <Skeleton width={90} height={34} borderRadius={6} />
        </div>
      )}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      {/* Topbar Skeleton */}
      <div className="topbar" style={{ marginBottom: 20 }}>
        <div>
          <Skeleton width={200} height={28} borderRadius={6} style={{ marginBottom: 6 }} />
          <Skeleton width={140} height={14} borderRadius={4} />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Skeleton width={120} height={34} borderRadius={6} />
        </div>
      </div>

      {/* KPI 4 Cards Grid */}
      <div className="grid g4" style={{ marginBottom: 18 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-kpi">
            <Skeleton width="45%" height={12} borderRadius={4} />
            <Skeleton width="75%" height={26} borderRadius={6} style={{ margin: '4px 0' }} />
            <Skeleton width="60%" height={11} borderRadius={4} />
          </div>
        ))}
      </div>

      {/* Main 2 Card Grid */}
      <div className="grid g2" style={{ marginBottom: 18 }}>
        <div className="skeleton-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <Skeleton width={140} height={18} borderRadius={4} />
            <Skeleton width={60} height={18} borderRadius={4} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton width="100%" height={38} borderRadius={6} />
            <Skeleton width="100%" height={38} borderRadius={6} />
            <Skeleton width="100%" height={38} borderRadius={6} />
            <Skeleton width="100%" height={38} borderRadius={6} />
          </div>
        </div>

        <div className="skeleton-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <Skeleton width={160} height={18} borderRadius={4} />
            <Skeleton width={50} height={18} borderRadius={4} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton width="100%" height={38} borderRadius={6} />
            <Skeleton width="100%" height={38} borderRadius={6} />
            <Skeleton width="100%" height={38} borderRadius={6} />
            <Skeleton width="100%" height={38} borderRadius={6} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 5,
  hasHeader = true,
}: {
  rows?: number;
  cols?: number;
  hasHeader?: boolean;
}) {
  const widths = ['35%', '65%', '50%', '40%', '80%', '45%', '70%'];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {hasHeader && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            padding: '12px 16px',
            background: '#fafbfe',
            borderBottom: '1px solid var(--line)',
            gap: 16,
          }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} width="50%" height={12} borderRadius={4} />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              padding: '14px 16px',
              borderBottom: r === rows - 1 ? 'none' : '1px solid var(--line)',
              gap: 16,
              alignItems: 'center',
            }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                width={widths[(r + c) % widths.length]}
                height={14}
                borderRadius={4}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TablePageSkeleton({
  titleWidth = 150,
  rows = 6,
  cols = 5,
}: {
  titleWidth?: number;
  rows?: number;
  cols?: number;
}) {
  return (
    <div>
      <SkeletonTopbar titleWidth={titleWidth} hasButton />
      <TableSkeleton rows={rows} cols={cols} />
    </div>
  );
}

export function DocViewSkeleton() {
  return (
    <div>
      {/* Top action bar */}
      <div className="topbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton width={180} height={28} borderRadius={6} />
          <Skeleton width={70} height={24} borderRadius={999} />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Skeleton width={80} height={32} borderRadius={6} />
          <Skeleton width={80} height={32} borderRadius={6} />
        </div>
      </div>

      {/* Details Card */}
      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div className="grid g4" style={{ marginBottom: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width="40%" height={11} borderRadius={3} />
              <Skeleton width="70%" height={16} borderRadius={4} />
            </div>
          ))}
        </div>
        <div className="grid g2">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="30%" height={11} borderRadius={3} />
            <Skeleton width="60%" height={16} borderRadius={4} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="30%" height={11} borderRadius={3} />
            <Skeleton width="50%" height={16} borderRadius={4} />
          </div>
        </div>
      </div>

      {/* Items Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          <Skeleton width={100} height={14} borderRadius={4} />
        </div>
        <TableSkeleton rows={3} cols={5} hasHeader={false} />
      </div>

      {/* Bottom Summary Card */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="card" style={{ width: 280, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton width="40%" height={13} borderRadius={4} />
            <Skeleton width="30%" height={13} borderRadius={4} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton width="40%" height={13} borderRadius={4} />
            <Skeleton width="30%" height={13} borderRadius={4} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            <Skeleton width="50%" height={18} borderRadius={4} />
            <Skeleton width="35%" height={18} borderRadius={4} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton({ fieldCount = 4 }: { fieldCount?: number }) {
  return (
    <div className="card" style={{ padding: 24, maxWidth: 640 }}>
      <Skeleton width={160} height={22} borderRadius={6} style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Array.from({ length: fieldCount }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="25%" height={12} borderRadius={4} />
            <Skeleton width="100%" height={38} borderRadius={6} />
          </div>
        ))}
        <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
          <Skeleton width={110} height={36} borderRadius={6} />
          <Skeleton width={80} height={36} borderRadius={6} />
        </div>
      </div>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div>
      <div className="topbar" style={{ marginBottom: 20 }}>
        <Skeleton width={200} height={28} borderRadius={6} />
        <div className="row" style={{ gap: 10 }}>
          <Skeleton width={130} height={34} borderRadius={6} />
          <Skeleton width={90} height={34} borderRadius={6} />
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <Skeleton width={160} height={34} borderRadius={6} />
          <Skeleton width={160} height={34} borderRadius={6} />
          <Skeleton width={120} height={34} borderRadius={6} />
        </div>
      </div>
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}

