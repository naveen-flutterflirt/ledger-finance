import React, { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react';

export function Btn({
  children,
  loading = false,
  loadingText,
  disabled,
  className = 'btn',
  icon: Icon,
  type = 'button',
  ...props
}: {
  children: ReactNode;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
  icon?: any;
  type?: 'button' | 'submit' | 'reset';
  [key: string]: any;
}) {
  return (
    <button
      {...props}
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 ${className}`}
      disabled={disabled || loading}
      style={props.style}
    >
      {loading ? (
        <>
          <Loader2 size={15} className="spin" />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={15} />}
          {children}
        </>
      )}
    </button>
  );
}

export const Badge: React.FC<{ s: string }> = ({ s }) => (
  <span className={`badge s-${s}`}>{s.replace('_', ' ')}</span>
);

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="row border-b border-surface-line pb-3.5 mb-4">
          <h3 className="m-0 text-[17px] font-bold text-navy">{title}</h3>
          <div className="spacer" />
          <button
            className="btn sm p-1.5 flex items-center"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-full' : ''}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export const Msg: React.FC<{ err?: string; ok?: string }> = ({ err, ok }) => (
  <>
    {err && (
      <div className="err" role="alert">
        <AlertCircle size={16} className="shrink-0" />
        <span>{err}</span>
      </div>
    )}
    {ok && (
      <div className="ok" role="status">
        <CheckCircle2 size={16} className="shrink-0" />
        <span>{ok}</span>
      </div>
    )}
  </>
);

export function AccountSelect({
  accounts,
  value,
  onChange,
  filter,
  required,
}: {
  accounts: any[];
  value: any;
  onChange: (v: string) => void;
  filter?: (a: any) => boolean;
  required?: boolean;
}) {
  const list = filter ? accounts.filter(filter) : accounts;
  const groups = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
    .map(t => [t, list.filter(a => a.type === t)] as const)
    .filter(([, l]) => l.length > 0);

  return (
    <select
      required={required}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">— select account —</option>
      {groups.map(([t, l]) => (
        <optgroup key={t} label={t}>
          {l.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export const StatusBadge: React.FC<{ s: string }> = ({ s }) => {
  const norm = s === 'POSTED' ? 'OPEN' : s;
  return (
    <span
      className={`badge s-${norm} inline-flex items-center gap-1.5 py-1 px-2.5 font-semibold`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>{s.replace(/_/g, ' ')}</span>
    </span>
  );
};
