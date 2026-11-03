import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DOC_CONFIG } from '../../utils/constants.js';
import { StatusBadge } from '../../components/common/ui.js';
import { fmtDate, inr2 } from '../../utils/format.js';
import { useData } from '../../api/client.js';
import { Skeleton } from '../../components/common/Skeleton.js';
import { KpiCard } from '../../components/common/KpiCard.js';
import { Receipt, Percent, TrendingUp, CreditCard } from 'lucide-react';

export default function DocList() {
  const { kind = 'sales' } = useParams<{ kind: string }>();
  const meta = DOC_CONFIG[kind];
  const [st, setSt] = useState('');

  const { data, error, loading } = useData<any[]>(
    `/api/docs/${kind}${st ? `?status=${st}` : ''}`
  );

  if (!meta) return <p className="err">Unknown document kind: {kind}</p>;

  const sum = (k: string) =>
    (data ?? [])
      .filter(d => d.status !== 'CANCELLED' && d.status !== 'DRAFT')
      .reduce((s, d) => s + (Number(d[k]) || 0), 0);

  return (
    <>
      <div className="topbar">
        <h1>{meta.title}</h1>
        <div className="flex items-center gap-3 shrink-0">
          <select
            value={st}
            onChange={e => setSt(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="OPEN">Unpaid / part-paid</option>
            {['DRAFT', 'PAID', 'CANCELLED'].map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <Link className="btn primary whitespace-nowrap" to={`/docs/${kind}/new`}>
            + New {meta.one.toLowerCase()}
          </Link>
        </div>
      </div>

      {error && <div className="err">{error}</div>}

      <div className="grid g4">
        <KpiCard
          label="Taxable value"
          value={inr2(sum('taxable_value'))}
          icon={Receipt}
          variant="blue"
          tooltipTitle="Taxable Value"
          tooltipDesc="Total net value of goods/services across all valid documents before GST."
        />
        <KpiCard
          label="GST total"
          value={inr2(sum('cgst') + sum('sgst') + sum('igst'))}
          icon={Percent}
          variant="purple"
          tooltipTitle="GST Total"
          tooltipDesc="Combined CGST, SGST, and IGST tax computed across all documents in this list."
        />
        <KpiCard
          label="Total value"
          value={inr2(sum('total'))}
          icon={TrendingUp}
          variant="indigo"
          tooltipTitle="Grand Total"
          tooltipDesc="Gross total value of documents including taxable amount and all GST taxes."
        />
        <KpiCard
          label="Outstanding balance"
          value={inr2(sum('outstanding'))}
          icon={CreditCard}
          variant="amber"
          tooltipTitle="Outstanding Balance"
          tooltipDesc="Total remaining unpaid balance pending settlement from customers/vendors."
        />
      </div>

      <div className="card p-0 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Date</th>
              <th>{meta.party === 'CUSTOMER' ? 'Customer' : 'Vendor'}</th>
              <th>GSTIN</th>
              <th>Due</th>
              <th>Status</th>
              <th className="num">Taxable</th>
              <th className="num">GST</th>
              <th className="num">Total</th>
              <th className="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <tr key={r}>
                  <td><Skeleton width="70%" height={15} /></td>
                  <td><Skeleton width="60%" height={15} /></td>
                  <td><Skeleton width="80%" height={15} /></td>
                  <td><Skeleton width="65%" height={15} /></td>
                  <td><Skeleton width="55%" height={15} /></td>
                  <td><Skeleton width={65} height={20} borderRadius={999} /></td>
                  <td className="num"><Skeleton width="60%" height={15} /></td>
                  <td className="num"><Skeleton width="50%" height={15} /></td>
                  <td className="num"><Skeleton width="65%" height={15} /></td>
                  <td className="num"><Skeleton width="60%" height={15} /></td>
                </tr>
              ))
            ) : (
              data?.map(d => (
                <tr key={d.id}>
                  <td>
                    <Link
                      to={`/docs/${kind}/${d.id}`}
                      className="whitespace-nowrap font-semibold inline-flex items-center gap-1.5"
                    >
                      <span>{d.doc_no ?? 'Draft #' + d.id}</span>
                      {d.is_opening && (
                        <span className="badge text-[10px] py-px px-1.5 font-semibold">
                          opening
                        </span>
                      )}
                    </Link>
                  </td>
                  <td>{fmtDate(d.doc_date)}</td>
                  <td className="font-medium">{d.party_name}</td>
                  <td className="mono text-xs">{d.party_gstin ?? 'Unregistered'}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span>{fmtDate(d.due_date)}</span>
                      {d.days_overdue > 0 && ['POSTED', 'PARTIAL'].includes(d.status) && (
                        <span className="badge s-OVERDUE text-[10px] py-0.5 px-1.5">
                          {d.days_overdue}d overdue
                        </span>
                      )}
                    </span>
                  </td>
                  <td>
                    <StatusBadge s={d.status} />
                  </td>
                  <td className="num">{inr2(d.taxable_value)}</td>
                  <td className="num">{inr2(d.cgst + d.sgst + d.igst)}</td>
                  <td className="num">
                    <b>{inr2(d.total)}</b>
                  </td>
                  <td className="num">
                    {['POSTED', 'PARTIAL'].includes(d.status) ? inr2(d.outstanding) : '—'}
                  </td>
                </tr>
              ))
            )}
            {data && !data.length && (
              <tr>
                <td colSpan={10} className="muted text-center p-6">
                  No documents found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

