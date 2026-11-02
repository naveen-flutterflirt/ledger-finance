import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DOC_CONFIG } from '../../utils/constants.js';
import { StatusBadge } from '../../components/common/ui.js';
import { fmtDate, inr2 } from '../../utils/format.js';
import { useData } from '../../api/client.js';
import { Skeleton } from '../../components/common/Skeleton.js';

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
        <div className="row">
          <select
            value={st}
            onChange={e => setSt(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="">All statuses</option>
            <option value="OPEN">Unpaid / part-paid</option>
            {['DRAFT', 'PAID', 'CANCELLED'].map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <Link className="btn primary" to={`/docs/${kind}/new`}>
            + New {meta.one.toLowerCase()}
          </Link>
        </div>
      </div>

      {error && <div className="err">{error}</div>}

      <div className="grid g4">
        <div className="card kpi">
          <div className="label">Taxable value</div>
          <div className="val">{inr2(sum('taxable_value'))}</div>
        </div>
        <div className="card kpi">
          <div className="label">GST total</div>
          <div className="val">
            {inr2(sum('cgst') + sum('sgst') + sum('igst'))}
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Total value</div>
          <div className="val">{inr2(sum('total'))}</div>
        </div>
        <div className="card kpi">
          <div className="label">Outstanding balance</div>
          <div className="val">{inr2(sum('outstanding'))}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
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
                    <Link to={`/docs/${kind}/${d.id}`}>
                      <b>{d.doc_no ?? 'Draft #' + d.id}</b>
                    </Link>
                    {d.is_opening && (
                      <div className="muted" style={{ fontSize: 11 }}>
                        opening balance
                      </div>
                    )}
                  </td>
                  <td>{fmtDate(d.doc_date)}</td>
                  <td>{d.party_name}</td>
                  <td className="mono">{d.party_gstin ?? 'Unregistered'}</td>
                  <td>
                    {fmtDate(d.due_date)}
                    {d.days_overdue > 0 && ['POSTED', 'PARTIAL'].includes(d.status) && (
                      <div>
                        <span className="badge s-OVERDUE">{d.days_overdue}d overdue</span>
                      </div>
                    )}
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
                <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
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

