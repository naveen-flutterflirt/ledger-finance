import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, fyStart, inr2, todayStr } from '../../utils/format.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import { useData } from '../../api/client.js';
import { KpiCard } from '../../components/common/KpiCard.js';
import { TrendingUp, ShoppingBag, PieChart, Award } from 'lucide-react';

const Grp = ({
  title,
  g,
  sign = 1,
}: {
  title: string;
  g: any;
  sign?: number;
}) => {
  if (!g?.lines?.length) return null;
  return (
    <>
      <tr className="grp">
        <td>{title}</td>
        <td className="num">{inr2(sign * g.total)}</td>
      </tr>
      {g.lines.map((l: any) => (
        <tr key={l.code} className="sub">
          <td className="indent">
            <Link to={`/reports/ledger?account_id=${l.account_id}`}>
              {l.code} · {l.name}
            </Link>
          </td>
          <td className="num">{inr2(sign * l.amount)}</td>
        </tr>
      ))}
    </>
  );
};

const Tot = ({
  label,
  v,
  strong,
}: {
  label: string;
  v: number;
  strong?: boolean;
}) => (
  <tr className={strong ? 'tot' : ''}>
    <td>
      <b>{label}</b>
    </td>
    <td className={`num ${v < 0 ? 'out' : ''}`}>
      <b>{inr2(v)}</b>
    </td>
  </tr>
);

export default function Statements() {
  const [tab, setTab] = useState<'pl' | 'bs' | 'cf' | 'tb'>('pl');
  const [from, setFrom] = useState(fyStart());
  const [to, setTo] = useState(todayStr());

  const url = {
    pl: `/api/reports/profit-loss?from=${from}&to=${to}`,
    bs: `/api/reports/balance-sheet?as_of=${to}`,
    cf: `/api/reports/cash-flow?from=${from}&to=${to}`,
    tb: `/api/reports/trial-balance?from=${from}&to=${to}`,
  }[tab];

  const { data: d, loading } = useData<any>(url);

  return (
    <>
      <div className="topbar no-print">
        <h1>Financial statements</h1>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <div className="tabs shrink-0">
            {[
              ['pl', 'Profit & loss'],
              ['bs', 'Balance sheet'],
              ['cf', 'Cash flow'],
              ['tb', 'Trial balance'],
            ].map(([k, l]) => (
              <button
                key={k}
                className={tab === k ? 'on' : ''}
                onClick={() => setTab(k as any)}
              >
                {l}
              </button>
            ))}
          </div>

          {tab !== 'bs' && (
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
            />
          )}

          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
          />

          <button className="btn whitespace-nowrap" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>

      {loading && <TableSkeleton rows={7} cols={3} />}

      {d && tab === 'pl' && (
        <>
          <div className="grid g4 mb-5">
            <KpiCard
              label="Revenue from operations"
              value={inr2(d.revenue?.total ?? 0)}
              icon={TrendingUp}
              variant="emerald"
              tooltipTitle="Total Revenue"
              tooltipDesc="Total operating sales, SaaS revenue, and services income earned during this period."
            />
            <KpiCard
              label="Cost of sales (COGS)"
              value={inr2(d.cogs?.total ?? 0)}
              icon={ShoppingBag}
              variant="amber"
              tooltipTitle="Cost of Goods & Direct Expenses"
              tooltipDesc="Hosting, infrastructure, and direct expenses incurred to deliver services."
            />
            <KpiCard
              label="Gross profit"
              value={inr2(d.gross_profit ?? 0)}
              sub={`${d.gross_margin}% margin`}
              icon={PieChart}
              variant="blue"
              tooltipTitle="Gross Profit Margin"
              tooltipDesc="Revenue minus cost of direct sales before overheads and operating costs."
            />
            <KpiCard
              label="Net profit (Before Tax)"
              value={inr2(d.net_profit ?? 0)}
              sub={`${d.net_margin}% net margin`}
              icon={Award}
              variant={d.net_profit >= 0 ? 'emerald' : 'pink'}
              valueClassName={d.net_profit >= 0 ? 'val-green' : 'text-rose-600'}
              tooltipTitle="Net Operating Profit"
              tooltipDesc="Final bottom-line operating earnings after subtracting all employee, admin, and financing costs."
            />
          </div>

          <div className="card w-full overflow-x-auto shadow-sm border border-slate-200 p-0">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="m-0 text-base font-bold text-navy">
                Statement of profit &amp; loss · {fmtDate(d.from)} – {fmtDate(d.to)}
              </h3>
              <span className="badge s-APPROVED text-xs px-2.5 py-1">
                Net Margin: {d.net_margin}%
              </span>
            </div>
            <table>
              <tbody>
                <Grp title="Revenue from operations" g={d.revenue} />
                <Grp title="Cost of sales &amp; direct expenses" g={d.cogs} />
                <Tot label={`Gross profit (${d.gross_margin}%)`} v={d.gross_profit} />
                <Grp title="Employee benefit expenses" g={d.employee} />
                <Grp title="Other operating expenses" g={d.opex} />
                <Tot label="EBITDA" v={d.ebitda} />
                <Grp title="Depreciation &amp; amortisation" g={d.depreciation} />
                <Grp title="Finance costs" g={d.finance} />
                <Grp title="Other income" g={d.other_income} />
                {d.round_off?.total !== 0 && <Grp title="Round off" g={d.round_off} />}
                <Tot
                  label={`Net profit (${d.net_margin}% margin)`}
                  v={d.net_profit}
                  strong
                />
              </tbody>
            </table>
            <div className="p-4 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500">
              Before tax. Year-end closing entries are excluded so closed financial periods retain their
              operational operating results.
            </div>
          </div>
        </>
      )}

      {d && tab === 'bs' && (
        <div className="grid g2">
          <div className="card">
            <h3>Assets · as of {fmtDate(d.as_of)}</h3>
            <table>
              <tbody>
                <Grp title="Fixed assets (net of depreciation)" g={d.assets.fixed} />
                <Grp title="Cash &amp; bank balances" g={d.assets.current.cash} />
                <Grp title="Trade receivables" g={d.assets.current.receivables} />
                <Grp title="Inventories" g={d.assets.current.inventory} />
                <Grp title="GST input tax credit" g={d.assets.current.taxes} />
                <Grp title="Other current assets" g={d.assets.current.other} />
                <Tot label="Total assets" v={d.assets.total} strong />
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Equity &amp; liabilities</h3>
            <table>
              <tbody>
                <Grp title="Share capital / owner's capital" g={d.equity.capital} />
                <Grp title="Retained earnings" g={d.equity.retained} />
                <tr className="grp">
                  <td>Profit for the period (unclosed)</td>
                  <td className="num">{inr2(d.equity.current_profit)}</td>
                </tr>
                <Grp title="Borrowings" g={d.liabilities.loans} />
                <Grp title="Trade payables" g={d.liabilities.current.payables} />
                <Grp title="GST output tax payable" g={d.liabilities.current.taxes} />
                <Grp title="Payroll &amp; statutory dues" g={d.liabilities.current.payroll} />
                <Grp title="Other current liabilities" g={d.liabilities.current.other} />
                <Tot label="Total equity &amp; liabilities" v={d.total_liabilities_equity} strong />
              </tbody>
            </table>
            <p className={`${d.balanced ? 'check' : 'cross'} mt-3.5`}>
              {d.balanced
                ? '✔ Balance sheet balances'
                : `✖ Difference of ${inr2(d.difference)} detected`}
            </p>
          </div>
        </div>
      )}

      {d && tab === 'cf' && (
        <div className="card max-w-4xl">
          <h3>
            Cash flow statement (Indirect method) · {fmtDate(d.from)} – {fmtDate(d.to)}
          </h3>
          <table>
            <tbody>
              {(['operating', 'investing', 'financing'] as const).map(k => (
                <React.Fragment key={k}>
                  <tr className="grp">
                    <td>Cash flow from {k} activities</td>
                    <td />
                  </tr>
                  {d[k].lines.map((l: any) => (
                    <tr key={k + l.label} className="sub">
                      <td className="indent">{l.label}</td>
                      <td className={`num ${l.amount < 0 ? 'out' : ''}`}>
                        {inr2(l.amount)}
                      </td>
                    </tr>
                  ))}
                  <Tot label={`Net cash from ${k} activities`} v={d[k].total} />
                </React.Fragment>
              ))}
              <Tot label="Net increase / (decrease) in cash" v={d.net_change} />
              <tr>
                <td>Opening cash &amp; bank balance</td>
                <td className="num">{inr2(d.opening_cash)}</td>
              </tr>
              <Tot label="Closing cash &amp; bank balance" v={d.closing_cash} strong />
            </tbody>
          </table>
          <p className={`${d.reconciles ? 'check' : 'cross'} mt-3.5`}>
            {d.reconciles
              ? '✔ Reconciles perfectly to the movement in cash & bank accounts'
              : '✖ Does not reconcile'}
          </p>
        </div>
      )}

      {d && tab === 'tb' && (
        <div className="card p-0 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th>Type</th>
                <th className="num">Opening</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
                <th className="num">Closing Dr</th>
                <th className="num">Closing Cr</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r: any) => (
                <tr key={r.id}>
                  <td className="mono">{r.code}</td>
                  <td>
                    <Link to={`/reports/ledger?account_id=${r.id}`}>{r.name}</Link>
                  </td>
                  <td className="muted">{r.type}</td>
                  <td className="num">
                    {r.opening
                      ? `${inr2(Math.abs(r.opening))} ${r.opening > 0 ? 'Dr' : 'Cr'}`
                      : '—'}
                  </td>
                  <td className="num">{r.debit ? inr2(r.debit) : '—'}</td>
                  <td className="num">{r.credit ? inr2(r.credit) : '—'}</td>
                  <td className="num">{r.closing > 0 ? inr2(r.closing) : '—'}</td>
                  <td className="num">{r.closing < 0 ? inr2(-r.closing) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="tot">
                <td colSpan={4}>
                  Total{' '}
                  {d.balanced ? (
                    <span className="check">✔ agrees</span>
                  ) : (
                    <span className="cross">✖ out of balance</span>
                  )}
                </td>
                <td className="num">{inr2(d.totals.debit)}</td>
                <td className="num">{inr2(d.totals.credit)}</td>
                <td className="num">{inr2(d.totals.closing_debit)}</td>
                <td className="num">{inr2(d.totals.closing_credit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

