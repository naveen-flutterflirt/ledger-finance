import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { inr2, todayStr } from '../../utils/format.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import { useData } from '../../api/client.js';

const B: [string, string][] = [
  ['not_due', 'Not due'],
  ['d0_30', '1–30 days'],
  ['d31_60', '31–60 days'],
  ['d61_90', '61–90 days'],
  ['d90p', '90+ days'],
];

export default function Ageing() {
  const [sp] = useSearchParams();
  const [side, setSide] = useState(sp.get('side') === 'AP' ? 'AP' : 'AR');
  const [asOf, setAsOf] = useState(todayStr());

  const { data: d, loading } = useData<any>(
    `/api/reports/ageing?side=${side}&as_of=${asOf}`
  );

  return (
    <>
      <div className="topbar">
        <h1>{side === 'AR' ? 'Receivables ageing' : 'Payables ageing'}</h1>
        <div className="flex items-center gap-2.5 flex-nowrap shrink-0">
          <div className="tabs shrink-0">
            <button
              className={side === 'AR' ? 'on' : ''}
              onClick={() => setSide('AR')}
            >
              Receivables (AR)
            </button>
            <button
              className={side === 'AP' ? 'on' : ''}
              onClick={() => setSide('AP')}
            >
              Payables (AP)
            </button>
          </div>
          <input
            type="date"
            value={asOf}
            onChange={e => setAsOf(e.target.value)}
          />
        </div>
      </div>

      {loading && <TableSkeleton rows={5} cols={7} />}

      {d && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-5">
            {B.map(([k, l], i) => {
              const variants = ['blue', 'emerald', 'amber', 'purple', 'pink'];
              const v = variants[i] || 'default';
              return (
                <div key={k} className={`card kpi kpi-${v}`}>
                  <div className="kpi-header">
                    <div className="kpi-label">{l}</div>
                  </div>
                  <div className={`val ${k === 'd90p' && d.totals[k] > 0 ? '!text-rose-600' : ''}`}>
                    {inr2(d.totals[k])}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card p-0 overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>{side === 'AR' ? 'Customer' : 'Vendor'}</th>
                  {B.map(([k, l]) => (
                    <th key={k} className="num">
                      {l}
                    </th>
                  ))}
                  <th className="num">Total outstanding</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r: any) => (
                  <tr key={r.party_id}>
                    <td>
                      <Link to={`/reports/ledger?party_id=${r.party_id}`}>
                        {r.party}
                      </Link>
                    </td>
                    {B.map(([k]) => (
                      <td
                        key={k}
                        className={`num ${k === 'd90p' && r[k] ? 'out' : ''}`}
                      >
                        {r[k] ? inr2(r[k]) : '—'}
                      </td>
                    ))}
                    <td className="num">
                      <b>{inr2(r.total)}</b>
                    </td>
                  </tr>
                ))}
                {!d.rows.length && (
                  <tr>
                    <td colSpan={7} className="muted text-center p-6">
                      No outstanding items found
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="tot">
                  <td>Total</td>
                  {B.map(([k]) => (
                    <td key={k} className="num">
                      {inr2(d.totals[k])}
                    </td>
                  ))}
                  <td className="num">{inr2(d.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </>
  );
}

