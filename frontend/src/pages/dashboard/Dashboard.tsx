import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useData } from '../../api/client.js';
import { InOutBars } from '../../components/common/Charts.js';
import { inr, fmtDate } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.js';
import { DashboardSkeleton } from '../../components/common/Skeleton.js';

export default function Dashboard() {
  const { role, canAccess } = useAuth();
  const { data: x, loading } = useData<any>('/api/reports/dashboard');

  if (!canAccess('dashboard')) {
    if (canAccess('sales')) return <Navigate to="/docs/sales" replace />;
    if (canAccess('purchases')) return <Navigate to="/docs/purchases" replace />;
    if (canAccess('payroll')) return <Navigate to="/payroll" replace />;
    if (canAccess('accounting')) return <Navigate to="/accounts" replace />;
    if (canAccess('reports')) return <Navigate to="/reports" replace />;
    return <Navigate to="/me/payslips" replace />;
  }

  if (loading || !x) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{x.company?.name}</h1>
          <span className="muted">
            {x.company?.industry?.replace('_', ' ')} · GSTIN {x.company?.gstin ?? '—'} · FY {x.fy?.label}
            {x.company?.lock_date ? ` · books locked up to ${fmtDate(x.company.lock_date)}` : ''}
          </span>
        </div>
        <div className="row">
          <Link className="btn" to="/docs/purchases/new">
            + Bill
          </Link>
          <Link className="btn" to="/vouchers?kind=RECEIPT">
            + Receipt
          </Link>
          <Link className="btn primary" to="/docs/sales/new">
            + Sales invoice
          </Link>
        </div>
      </div>

      {x.recon_unmatched > 0 && (
        <div className="warn">
          {x.recon_unmatched} bank statement line(s) are not reconciled. <Link to="/banking">Reconcile →</Link>
        </div>
      )}

      <div className="grid g4">
        <div className="card kpi">
          <div className="label">Cash &amp; bank</div>
          <div className="val">{inr(x.cash_total)}</div>
          <div className="sub">{x.cash?.length} accounts</div>
        </div>
        <div className="card kpi">
          <div className="label">Receivables (debtors)</div>
          <div className="val">{inr(x.receivables)}</div>
          <div className="sub">
            <Link to="/reports/ageing">Ageing →</Link>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Payables (creditors)</div>
          <div className="val">{inr(x.payables)}</div>
          <div className="sub">
            <Link to="/reports/ageing?side=AP">Ageing →</Link>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">GST payable (this month)</div>
          <div className="val">{inr(x.gst_payable_mtd)}</div>
          <div className="sub">
            <Link to="/reports/gst">GSTR-3B →</Link>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Revenue — FY to date</div>
          <div className="val">{inr(x.ytd?.revenue)}</div>
          <div className="sub">This month {inr(x.mtd?.revenue)}</div>
        </div>
        <div className="card kpi">
          <div className="label">Net profit — FY to date</div>
          <div className={`val ${x.ytd?.net_profit >= 0 ? 'in' : 'out'}`}>
            {inr(x.ytd?.net_profit)}
          </div>
          <div className="sub">
            Net margin {x.ytd?.net_margin}% · <Link to="/reports">P&amp;L →</Link>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Last payroll</div>
          <div className="val">{x.last_payroll ? inr(x.last_payroll.net) : '—'}</div>
          <div className="sub">
            {x.last_payroll ? `${x.last_payroll.period?.slice(0, 7)} · ${x.last_payroll.status}` : 'No runs yet'}
          </div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>Income vs expenses (12 months)</h3>
          {x.monthly && <InOutBars data={x.monthly.map((m: any) => ({ label: m.label, inflow: Number(m.income), outflow: Number(m.expense), net: Number(m.income) - Number(m.expense) }))} />}
        </div>
        <div className="card">
          <h3>Bank &amp; cash accounts</h3>
          <table>
            <tbody>
              {x.cash?.map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <Link to={`/reports/ledger?account_id=${b.id}`}>{b.name}</Link>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {b.subtype}
                    </div>
                  </td>
                  <td className={`num ${b.bal < 0 ? 'out' : ''}`}>
                    <b>{inr(b.bal)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Overdue invoices &amp; bills</h3>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Doc no.</th>
              <th>Party</th>
              <th>Due</th>
              <th className="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {x.overdue?.map((o: any) => (
              <tr key={o.id}>
                <td>
                  {o.kind === 'SALE' ? (
                    <span className="in">To collect</span>
                  ) : (
                    <span className="out">To pay</span>
                  )}
                </td>
                <td>
                  <Link to={`/docs/${o.kind === 'SALE' ? 'sales' : 'purchases'}/${o.id}`}>
                    {o.doc_no}
                  </Link>
                </td>
                <td>{o.party_name}</td>
                <td>
                  {fmtDate(o.due_date)}{' '}
                  <span className="badge s-OVERDUE">{o.days_overdue}d</span>
                </td>
                <td className="num">{inr(o.outstanding)}</td>
              </tr>
            ))}
            {!x.overdue?.length && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '16px' }}>
                  Nothing overdue
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

