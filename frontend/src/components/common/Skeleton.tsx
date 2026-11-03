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
    <div className="topbar mb-5">
      <Skeleton width={titleWidth} height={28} borderRadius={6} />
      {hasButton && (
        <div className="row gap-2.5">
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
      <div className="topbar mb-5">
        <div>
          <Skeleton width={200} height={28} borderRadius={6} className="mb-1.5" />
          <Skeleton width={140} height={14} borderRadius={4} />
        </div>
        <div className="row gap-2.5">
          <Skeleton width={120} height={34} borderRadius={6} />
        </div>
      </div>

      {/* KPI 4 Cards Grid */}
      <div className="grid g4 mb-4.5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-kpi">
            <Skeleton width="45%" height={12} borderRadius={4} />
            <Skeleton width="75%" height={26} borderRadius={6} className="my-1" />
            <Skeleton width="60%" height={11} borderRadius={4} />
          </div>
        ))}
      </div>

      {/* Main 2 Card Grid */}
      <div className="grid g2 mb-4.5">
        <div className="skeleton-card">
          <div className="flex justify-between items-center mb-4">
            <Skeleton width={140} height={18} borderRadius={4} />
            <Skeleton width={60} height={18} borderRadius={4} />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton width="100%" height={38} borderRadius={6} />
            <Skeleton width="100%" height={38} borderRadius={6} />
            <Skeleton width="100%" height={38} borderRadius={6} />
            <Skeleton width="100%" height={38} borderRadius={6} />
          </div>
        </div>

        <div className="skeleton-card">
          <div className="flex justify-between items-center mb-4">
            <Skeleton width={160} height={18} borderRadius={4} />
            <Skeleton width={50} height={18} borderRadius={4} />
          </div>
          <div className="flex flex-col gap-3">
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
    <div className="card p-0 overflow-hidden">
      {hasHeader && (
        <div
          className="grid gap-4 py-3 px-4 bg-slate-50 border-b border-surface-line"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} width="50%" height={12} borderRadius={4} />
          ))}
        </div>
      )}
      <div className="flex flex-col">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className={`grid gap-4 py-3.5 px-4 items-center ${r === rows - 1 ? '' : 'border-b border-surface-line'}`}
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
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
      <div className="topbar mb-5">
        <div className="flex items-center gap-3">
          <Skeleton width={180} height={28} borderRadius={6} />
          <Skeleton width={70} height={24} borderRadius={999} />
        </div>
        <div className="row gap-2">
          <Skeleton width={80} height={32} borderRadius={6} />
          <Skeleton width={80} height={32} borderRadius={6} />
        </div>
      </div>

      {/* Details Card */}
      <div className="card mb-4 p-5">
        <div className="grid g4 mb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton width="40%" height={11} borderRadius={3} />
              <Skeleton width="70%" height={16} borderRadius={4} />
            </div>
          ))}
        </div>
        <div className="grid g2">
          <div className="flex flex-col gap-1.5">
            <Skeleton width="30%" height={11} borderRadius={3} />
            <Skeleton width="60%" height={16} borderRadius={4} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton width="30%" height={11} borderRadius={3} />
            <Skeleton width="50%" height={16} borderRadius={4} />
          </div>
        </div>
      </div>

      {/* Items Table Card */}
      <div className="card p-0 overflow-hidden mb-4">
        <div className="py-3 px-4 border-b border-surface-line">
          <Skeleton width={100} height={14} borderRadius={4} />
        </div>
        <TableSkeleton rows={3} cols={5} hasHeader={false} />
      </div>

      {/* Bottom Summary Card */}
      <div className="flex justify-end">
        <div className="card w-[280px] p-4 flex flex-col gap-2.5">
          <div className="flex justify-between">
            <Skeleton width="40%" height={13} borderRadius={4} />
            <Skeleton width="30%" height={13} borderRadius={4} />
          </div>
          <div className="flex justify-between">
            <Skeleton width="40%" height={13} borderRadius={4} />
            <Skeleton width="30%" height={13} borderRadius={4} />
          </div>
          <div className="flex justify-between pt-2 border-t border-surface-line">
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
    <div className="card p-6 max-w-[640px]">
      <Skeleton width={160} height={22} borderRadius={6} className="mb-5" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: fieldCount }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton width="25%" height={12} borderRadius={4} />
            <Skeleton width="100%" height={38} borderRadius={6} />
          </div>
        ))}
        <div className="mt-2 flex gap-2.5">
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
      <div className="topbar mb-5">
        <Skeleton width={200} height={28} borderRadius={6} />
        <div className="row gap-2.5">
          <Skeleton width={130} height={34} borderRadius={6} />
          <Skeleton width={90} height={34} borderRadius={6} />
        </div>
      </div>
      <div className="card mb-4 p-4">
        <div className="row gap-4 flex-wrap">
          <Skeleton width={160} height={34} borderRadius={6} />
          <Skeleton width={160} height={34} borderRadius={6} />
          <Skeleton width={120} height={34} borderRadius={6} />
        </div>
      </div>
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
