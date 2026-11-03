import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Msg, Btn } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { fmtDate, inr2 } from '../../utils/format.js';
import { DocViewSkeleton } from '../../components/common/Skeleton.js';

export default function JournalView() {
  const { id } = useParams<{ id: string }>();
  const { data: e, reload, loading } = useData<any>(`/api/journals/${id}`);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [reversing, setReversing] = useState(false);
  const { toast } = useToast();

  if (loading || !e) return <DocViewSkeleton />;

  const dr = e.lines?.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
  const cr = e.lines?.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);

  return (
    <>
      <div className="topbar">
        <h1 className="mono">{e.entry_no}</h1>
        <div className="row">
          <Link className="btn" to="/journals">
            ← Journals
          </Link>
          <button className="btn" onClick={() => window.print()}>
            Print
          </button>
          {!e.reversed_by &&
            !e.reversal_of &&
            ['MANUAL', 'CONTRA', 'OPENING', 'BANK_ENTRY'].includes(e.source) && (
              <Btn
                className="btn ghost-red"
                loading={reversing}
                loadingText="Reversing..."
                onClick={async () => {
                  const reason = prompt('Reason for reversal?');
                  if (!reason) return;
                  setReversing(true);
                  try {
                    await apiCall(`/api/journals/${e.id}/reverse`, 'POST', { reason });
                    setOk('Reversal posted');
                    toast.success('Journal entry reversal posted successfully');
                    reload();
                  } catch (x: any) {
                    const msg = x.message || 'Failed to reverse entry';
                    setErr(msg);
                    toast.error(msg);
                  } finally {
                    setReversing(false);
                  }
                }}
              >
                Reverse entry
              </Btn>
            )}
        </div>
      </div>

      <Msg err={err} ok={ok} />

      <div className="grid g4">
        <div className="card">
          <div className="muted">Date</div>
          <b>{fmtDate(e.entry_date)}</b>
        </div>
        <div className="card">
          <div className="muted">Source</div>
          <b>{e.source.replace(/_/g, ' ')}</b>
        </div>
        <div className="card">
          <div className="muted">Created by</div>
          <b>{e.created_by_name ?? 'System'}</b>
          <div className="muted text-[11px]">
            {new Date(e.created_at).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="card">
          <div className="muted">Reversal Status</div>
          <b>
            {e.reversed_by
              ? `Reversed by ${e.reversed_by_no}`
              : e.reversal_of
              ? `Reverses ${e.reversal_of_no}`
              : 'Active'}
          </b>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <p className="p-4 m-0 border-b border-surface-line">
          <b>Narration:</b> {e.narration}
        </p>
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Party</th>
              <th>Line note</th>
              <th className="num">Debit (₹)</th>
              <th className="num">Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {e.lines?.map((l: any) => (
              <tr key={l.id}>
                <td>
                  <span className="mono">{l.code}</span>{' '}
                  <Link to={`/reports/ledger?account_id=${l.account_id}`}>
                    {l.account}
                  </Link>
                </td>
                <td>{l.party ?? ''}</td>
                <td className="muted">{l.narration}</td>
                <td className="num">{l.debit ? inr2(l.debit) : ''}</td>
                <td className="num">{l.credit ? inr2(l.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tot">
              <td colSpan={3}>Total</td>
              <td className="num">{inr2(dr)}</td>
              <td className="num">{inr2(cr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

