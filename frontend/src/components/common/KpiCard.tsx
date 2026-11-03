import React, { ReactNode } from 'react';
import { Info, LucideIcon } from 'lucide-react';

export interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  variant?: 'emerald' | 'blue' | 'amber' | 'purple' | 'sky' | 'teal' | 'pink' | 'indigo' | 'default';
  tooltipTitle?: string;
  tooltipDesc: string;
  className?: string;
  valueClassName?: string;
}

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  variant = 'default',
  tooltipTitle,
  tooltipDesc,
  className = '',
  valueClassName = '',
}: KpiCardProps) {
  return (
    <div className={`card kpi kpi-${variant} ${className}`}>
      <div className="kpi-header">
        <div className="kpi-title-group">
          {Icon && (
            <div className={`kpi-icon-pill kpi-icon-${variant}`}>
              <Icon size={16} strokeWidth={2.2} />
            </div>
          )}
          <div className="kpi-label">{label}</div>
        </div>

        <div className="kpi-tooltip-wrap">
          <button
            type="button"
            className="kpi-info-btn"
            aria-label={typeof label === 'string' ? `About ${label}` : 'Information'}
            tabIndex={0}
          >
            <Info size={13} strokeWidth={2.4} />
          </button>
          <div className="kpi-tooltip" role="tooltip">
            <div className="kpi-tooltip-title">
              {tooltipTitle || (typeof label === 'string' ? label : 'Metric Information')}
            </div>
            <div className="kpi-tooltip-desc">
              {tooltipDesc}
            </div>
          </div>
        </div>
      </div>

      <div className={`val ${valueClassName}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
