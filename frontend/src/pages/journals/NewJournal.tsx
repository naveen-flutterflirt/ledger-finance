import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountSelect, Field, Msg, Btn } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { FormSkeleton } from '../../components/common/Skeleton.js';
import { inr2, todayStr } from '../../utils/format.js';

export default function NewJournal() {
  const navigate = useNavigate();
  const { data: lk } = useData<any>('/api/lookups');
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [h, setH] = useState<any>({
    date: todayStr(),
    source: 'MANUAL',
    narration: '',
  });

  const [lines, setLines] = useState<any[]>([
    { account_id: '', debit: '', credit: '' },
    { account_id: '', debit: '', credit: '' },
  ]);

  const [err, setErr] = useState('');

  const dr = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const cr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const diff = Math.round((dr - cr) * 100) / 100;

  const upd = (i: number, p: any) =>
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  async function save() {
    setErr('');
    setSaving(true);
    try {
      const r = await apiCall('/api/journals', 'POST', {
        ...h,
        lines: lines
          .filter(l => l.account_id)
          .map(l => ({
            ...l,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
          })),
      });
      toast.success(`Journal entry ${r.entry_no || '#' + r.id} posted successfully`);
      navigate(`/journals/${r.id}`);
    } catch (x: any) {
      const msg = x.message || 'Failed to post journal entry';
      setErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!lk) return <FormSkeleton fieldCount={5} />;

  const isParty = (id: any) =>
    ['RECEIVABLE', 'PAYABLE'].includes(
      lk.accounts.find((a: any) => String(a.id) === String(id))?.subtype
    );

  return (
    <>
      <div className="topbar">
        <h1>New journal entry</h1>
      </div>

      <Msg err={err} />

      <div className="card form">
        <Field label="Voucher type">
          <select
            value={h.source}
            onChange={e => setH({ ...h, source: e.target.value })}
          >
            <option value="MANUAL">Journal (General / Accrual / Adjustment)</option>
            <option value="OPENING">Opening balances (difference goes to Opening Balance Equity)</option>
            <option value="CONTRA">Contra (Bank ↔ Cash / Bank ↔ Bank)</option>
          </select>
        </Field>

        <Field label="Date">
          <input
            type="date"
            value={h.date}
            onChange={e => setH({ ...h, date: e.target.value })}
          />
        </Field>

        <Field label="Narration *" wide>
          <input
            value={h.narration}
            onChange={e => setH({ ...h, narration: e.target.value })}
            placeholder="Detailed description of the transaction"
          />
        </Field>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th className="w-[38%] min-w-[200px]">Account</th>
              <th>Sub-ledger party (Debtor / Creditor)</th>
              <th className="w-40">Debit (₹)</th>
              <th className="w-40">Credit (₹)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  <AccountSelect
                    accounts={lk.accounts}
                    filter={
                      h.source === 'CONTRA'
                        ? (a: any) => ['BANK', 'CASH'].includes(a.subtype)
                        : undefined
                    }
                    value={l.account_id}
                    onChange={v => upd(i, { account_id: v })}
                  />
                </td>
                <td>
                  {isParty(l.account_id) && (
                    <select
                      value={l.party_id ?? ''}
                      onChange={e => upd(i, { party_id: e.target.value })}
                    >
                      <option value="">— select customer/vendor —</option>
                      {lk.parties.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={l.debit}
                    onChange={e => upd(i, { debit: e.target.value, credit: '' })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={l.credit}
                    onChange={e => upd(i, { credit: e.target.value, debit: '' })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn sm ghost-red"
                    onClick={() => setLines(lines.filter((_, j) => j !== i))}
                    disabled={lines.length <= 2}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tot">
              <td>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() =>
                    setLines([...lines, { account_id: '', debit: '', credit: '' }])
                  }
                >
                  + Add row
                </button>
              </td>
              <td className="right">Totals</td>
              <td className="num">{inr2(dr)}</td>
              <td className="num">{inr2(cr)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className={diff === 0 ? 'check' : h.source === 'OPENING' ? 'muted' : 'cross'}>
        {diff === 0
          ? '✔ Balanced'
          : h.source === 'OPENING'
          ? `Difference of ${inr2(diff)} will automatically route to Opening Balance Equity (OBE)`
          : `Out of balance by ${inr2(Math.abs(diff))}`}
      </p>

      <Btn
        className="btn primary"
        onClick={save}
        loading={saving}
        loadingText="Posting journal entry..."
        disabled={!h.narration || (diff !== 0 && h.source !== 'OPENING')}
      >
        Post journal entry
      </Btn>
    </>
  );
}

