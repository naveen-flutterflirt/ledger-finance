import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useData } from '../../api/client.js';
import { InOutBars } from '../../components/common/Charts.js';
import { inr, fmtDate } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.js';
import { DashboardSkeleton } from '../../components/common/Skeleton.js';
import { KpiCard } from '../../components/common/KpiCard.js';
import {
  Landmark,
  FileText,
  ArrowRightSquare,
  Percent,
  BarChart3,
  TrendingUp,
  Calendar,
} from 'lucide-react';

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
        <div className="flex items-center gap-3.5">
          <img
            src="/logo.png"
            alt="Bluepeak"
            width={40}
            height={40}
            className="topbar-logo"
          />
          <div className="h-8 w-px bg-slate-300 shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-navy tracking-tight m-0 leading-tight">
              {x.company?.name}
            </h1>
            <div className="text-[11.5px] uppercase font-semibold tracking-wider text-slate-500 flex items-center flex-wrap gap-1.5 mt-0.5">
              <span>{x.company?.industry?.replace('_', ' ')}</span>
              <span>•</span>
              <span>GSTIN {x.company?.gstin ?? '—'}</span>
              <span>•</span>
              <span>FY {x.fy?.label}</span>
              {x.company?.lock_date ? (
                <>
                  <span>•</span>
                  <span>Books locked up to {fmtDate(x.company.lock_date)}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          <Link
            className="btn bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-slate-50 whitespace-nowrap"
            to="/docs/purchases/new"
          >
            + Bill
          </Link>
          <Link
            className="btn bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-slate-50 whitespace-nowrap"
            to="/vouchers?kind=RECEIPT"
          >
            + Receipt
          </Link>
          <Link
            className="btn bg-[#1a56db] text-white px-4.5 py-2 rounded-lg font-medium shadow-sm hover:bg-[#1648c2] whitespace-nowrap"
            to="/docs/sales/new"
          >
            + Sales Invoice
          </Link>
        </div>
      </div>

      {x.recon_unmatched > 0 && (
        <div className="warn mb-5">
          {x.recon_unmatched} bank statement line(s) are not reconciled. <Link to="/banking">Reconcile →</Link>
        </div>
      )}

      {/* Row 1: 4 KPI Cards matching Image 1 */}
      <div className="kpi-grid-4">
        <KpiCard
          label="Cash & Bank"
          value={inr(x.cash_total)}
          sub={`${x.cash?.length ?? 0} accounts`}
          icon={Landmark}
          variant="emerald"
          tooltipTitle="Cash & Bank Balance"
          tooltipDesc="Total liquid funds available across all active bank accounts and cash in hand."
        />

        <KpiCard
          label={
            <span>
              Receivables<br />(Debtors)
            </span>
          }
          value={inr(x.receivables)}
          sub={
            <Link to="/reports/ageing" className="text-[#2563eb] font-semibold hover:underline">
              Ageing →
            </Link>
          }
          icon={FileText}
          variant="blue"
          tooltipTitle="Accounts Receivable (Debtors)"
          tooltipDesc="Total unpaid customer invoices pending collection from buyers."
        />

        <KpiCard
          label={
            <span>
              Payables<br />(Creditors)
            </span>
          }
          value={inr(x.payables)}
          sub={
            <Link to="/reports/ageing?side=AP" className="text-[#d97706] font-semibold hover:underline">
              Ageing →
            </Link>
          }
          icon={ArrowRightSquare}
          variant="amber"
          tooltipTitle="Accounts Payable (Creditors)"
          tooltipDesc="Total outstanding purchase bills and supplier invoices owed by the company."
        />

        <KpiCard
          label={
            <span>
              GST Payable<br />(This Month)
            </span>
          }
          value={inr(x.gst_payable_mtd)}
          sub={
            <Link to="/reports/gst" className="text-[#7c3aed] font-semibold hover:underline">
              GSTR-3B →
            </Link>
          }
          icon={Percent}
          variant="purple"
          tooltipTitle="Net GST Liability (Current Month)"
          tooltipDesc="Estimated net tax payable after deducting Input Tax Credit (ITC) from outward sales tax."
        />
      </div>

      {/* Row 2: 3 KPI Cards matching Image 1 */}
      <div className="kpi-grid-3">
        <KpiCard
          label="Revenue — FY to Date"
          value={inr(x.ytd?.revenue)}
          sub={`This month ${inr(x.mtd?.revenue || 0)}`}
          icon={BarChart3}
          variant="sky"
          tooltipTitle="Operating Revenue (FY to Date)"
          tooltipDesc="Cumulative gross turnover and operating sales booked since the start of this Financial Year."
        />

        <KpiCard
          label="Net Profit — FY to Date"
          value={inr(x.ytd?.net_profit)}
          valueClassName="val-green"
          sub={`Net margin ${x.ytd?.net_margin}%`}
          icon={TrendingUp}
          variant="emerald"
          tooltipTitle="Net Profit / Loss (YTD)"
          tooltipDesc="Bottom-line earnings after deducting cost of sales, operating expenses, taxes, and depreciation."
        />

        <KpiCard
          label="Last Payroll"
          value={x.last_payroll ? inr(x.last_payroll.net) : '—'}
          sub={
            x.last_payroll
              ? `${x.last_payroll.period?.slice(0, 7)} · ${x.last_payroll.status}`
              : 'No runs yet'
          }
          icon={Calendar}
          variant="pink"
          tooltipTitle="Latest Monthly Payroll"
          tooltipDesc="Total net salaries and employee liabilities disbursed in the most recent payroll cycle."
        />
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>Income vs expenses (12 months)</h3>
          {x.monthly && <InOutBars data={x.monthly.map((m: any) => ({ label: m.label, inflow: Number(m.income), outflow: Number(m.expense), net: Number(m.income) - Number(m.expense) }))} />}
        </div>
        <div className="card p-0 overflow-x-auto">
          <div className="p-4.5 pb-2">
            <h3 className="m-0">Bank &amp; cash accounts</h3>
          </div>
          <table>
            <tbody>
              {x.cash?.map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <span className="font-semibold">
                      <Link to={`/reports/ledger?account_id=${b.id}`}>{b.name}</Link>
                    </span>
                    <span className="muted text-xs ml-2">· {b.subtype}</span>
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

      <div className="card p-0 overflow-x-auto">
        <div className="p-4.5 pb-2">
          <h3 className="m-0">Overdue invoices &amp; bills</h3>
        </div>
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
                  <Link to={`/docs/${o.kind === 'SALE' ? 'sales' : 'purchases'}/${o.id}`} className="font-semibold whitespace-nowrap">
                    {o.doc_no}
                  </Link>
                </td>
                <td className="font-medium">{o.party_name}</td>
                <td>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span>{fmtDate(o.due_date)}</span>
                    <span className="badge s-OVERDUE text-[10px] py-0.5 px-1.5">{o.days_overdue}d</span>
                  </span>
                </td>
                <td className="num font-bold">{inr(o.outstanding)}</td>
              </tr>
            ))}
            {!x.overdue?.length && (
              <tr>
                <td colSpan={5} className="muted text-center p-4">
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

