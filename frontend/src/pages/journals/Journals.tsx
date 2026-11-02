import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../api/client.js';
import { fmtDate, fyStart, inr2, todayStr } from '../../utils/format.js';
import { Skeleton } from '../../components/common/Skeleton.js';

const SOURCES = [
  'MANUAL',
  'OPENING',
  'CONTRA',
  'SALES_INVOICE',
  'PURCHASE_BILL',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'RECEIPT',
  'PAYMENT',
  'DEPRECIATION',
  'ASSET_PURCHASE',
  'ASSET_DISPOSAL',
  'PAYROLL',
  'PAYROLL_PAYMENT',
  'BANK_ENTRY',
  'YEAR_CLOSE',
  'REVERSAL',
];

export default function Journals() {
  const [f, setF] = useState<any>({
    from: fyStart(),
    to: todayStr(),
    source: '',
    q: '',
  });

  const qs = new URLSearchParams(
    Object.entries(f).filter(([, v]) => v) as any
  ).toString();

  const { data, loading } = useData<any[]>(`/api/journals?${qs}`);

  return (
    <>
      <div className="topbar">
        <h1>Journal entries</h1>
        <Link className="btn primary" to="/journals/new">
          + New journal voucher
        </Link>
      </div>

      <div className="card form">
        <div>
          <label>From date</label>
          <input
            type="date"
            value={f.from}
            onChange={e => setF({ ...f, from: e.target.value })}
          />
        </div>
        <div>
          <label>To date</label>
          <input
            type="date"
            value={f.to}
            onChange={e => setF({ ...f, to: e.target.value })}
          />
        </div>
        <div>
          <label>Source</label>
          <select
            value={f.source}
            onChange={e => setF({ ...f, source: e.target.value })}
          >
            <option value="">All sources</option>
            {SOURCES.map(s => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Search keyword</label>
          <input
            value={f.q}
            onChange={e => setF({ ...f, q: e.target.value })}
            placeholder="Search narration or JV number"
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Entry no.</th>
              <th>Date</th>
              <th>Source</th>
              <th>Narration</th>
              <th>Created by</th>
              <th className="num">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <tr key={r}>
                  <td><Skeleton width="60%" height={15} /></td>
                  <td><Skeleton width="50%" height={15} /></td>
                  <td><Skeleton width={80} height={20} borderRadius={999} /></td>
                  <td><Skeleton width="75%" height={15} /></td>
                  <td><Skeleton width="55%" height={15} /></td>
                  <td className="num"><Skeleton width="50%" height={15} /></td>
                </tr>
              ))
            ) : (
              data?.map(e => (
                <tr key={e.id} style={{ opacity: e.reversed_by ? 0.55 : 1 }}>
                  <td>
                    <Link to={`/journals/${e.id}`}>
                      <b className="mono">{e.entry_no}</b>
                    </Link>
                  </td>
                  <td>{fmtDate(e.entry_date)}</td>
                  <td>
                    <span className="badge">{e.source.replace(/_/g, ' ')}</span>
                    {e.reversed_by && (
                      <span className="badge s-CANCELLED" style={{ marginLeft: 6 }}>
                        reversed
                      </span>
                    )}
                  </td>
                  <td>{e.narration}</td>
                  <td className="muted">{e.created_by}</td>
                  <td className="num">{inr2(e.amount)}</td>
                </tr>
              ))
            )}
            {data && !data.length && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
                  No journal vouchers matching filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

