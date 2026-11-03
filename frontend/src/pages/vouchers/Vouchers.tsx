import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Field, Modal, Msg, Btn, StatusBadge } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { fmtDate, inr2, todayStr } from '../../utils/format.js';

export default function Vouchers() {
  const [sp, setSp] = useSearchParams();
  const kind = sp.get('kind') === 'PAYMENT' ? 'PAYMENT' : 'RECEIPT';
  const rec = kind === 'RECEIPT';

  const { data, reload, error } = useData<any[]>(`/api/vouchers?kind=${kind}`);
  const { data: lk } = useData<any>('/api/lookups');

  const [f, setF] = useState<any>(null);
  const [alloc, setAlloc] = useState<Record<number, string>>({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelBusyId, setCancelBusyId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: open } = useData<any[]>(
    f?.party_id
      ? `/api/docs/${rec ? 'sales' : 'purchases'}?status=OPEN&party_id=${f.party_id}`
      : null
  );

  useEffect(() => {
    if (sp.get('party_id') && lk) {
      setF({
        voucher_date: todayStr(),
        mode: 'NEFT',
        tds_amount: 0,
        party_id: Number(sp.get('party_id')),
        bank_account_id: lk.accounts.find((a: any) => a.subtype === 'BANK')?.id,
      });
    }
  }, [sp, lk]);

  useEffect(() => {
    const inv = sp.get('invoice_id');
    if (open && inv) {
      const o = open.find(x => String(x.id) === inv);
      if (o) {
        setAlloc({ [o.id]: String(o.outstanding) });
        setF((p: any) => ({ ...p, amount: o.outstanding }));
      }
    }
  }, [open, sp]);

  const allocated = Object.values(alloc).reduce((s, v) => s + Number(v || 0), 0);
  const gross = Number(f?.amount || 0) + Number(f?.tds_amount || 0);

  async function save() {
    setErr('');
    setSaving(true);
    try {
      const r = await apiCall('/api/vouchers', 'POST', {
        ...f,
        amount: Number(f.amount),
        tds_amount: Number(f.tds_amount || 0),
        allocations: Object.entries(alloc)
          .filter(([, v]) => Number(v) > 0)
          .map(([k, v]) => ({ invoice_id: Number(k), amount: Number(v) })),
      });

      const msg = `${r.voucher_no} posted${
        r.unallocated > 0 ? ` · ${inr2(r.unallocated)} kept as on-account advance` : ''
      }`;
      setOk(msg);
      toast.success(msg);
      setF(null);
      setAlloc({});
      reload();
    } catch (x: any) {
      const msg = x.message || 'Failed to post voucher';
      setErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>{rec ? 'Receipts from customers' : 'Payments to vendors'}</h1>
        <div className="flex items-center gap-2.5 flex-nowrap shrink-0">
          <div className="tabs shrink-0">
            <button
              className={kind === 'RECEIPT' ? 'on' : ''}
              onClick={() => setSp({ kind: 'RECEIPT' })}
            >
              Receipts
            </button>
            <button
              className={kind === 'PAYMENT' ? 'on' : ''}
              onClick={() => setSp({ kind: 'PAYMENT' })}
            >
              Payments
            </button>
          </div>

          <button
            className="btn primary whitespace-nowrap"
            onClick={() =>
              setF({
                voucher_date: todayStr(),
                mode: 'NEFT',
                tds_amount: 0,
                bank_account_id: lk?.accounts?.find((a: any) => a.subtype === 'BANK')?.id,
              })
            }
          >
            + New {rec ? 'receipt' : 'payment'}
          </button>
        </div>
      </div>

      <Msg err={err || error} ok={ok} />

      <div className="card p-0 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Voucher</th>
              <th>Date</th>
              <th>Party</th>
              <th>Bank</th>
              <th>Mode / Ref</th>
              <th>Status</th>
              <th className="num">TDS</th>
              <th className="num">Amount</th>
              <th className="num">Allocated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.map(v => (
              <tr key={v.id} className={v.status === 'CANCELLED' ? 'opacity-50' : ''}>
                <td>
                  <b className="whitespace-nowrap">{v.voucher_no}</b>
                </td>
                <td>{fmtDate(v.voucher_date)}</td>
                <td className="font-medium">{v.party}</td>
                <td>{v.bank}</td>
                <td>
                  <span className="font-semibold">{v.mode}</span>
                  {v.reference && (
                    <span className="muted mono ml-1.5 text-[11px]">
                      · {v.reference}
                    </span>
                  )}
                </td>
                <td>
                  <StatusBadge s={v.status === 'POSTED' ? 'PAID' : v.status} />
                </td>
                <td className="num">{v.tds_amount ? inr2(v.tds_amount) : '—'}</td>
                <td className="num">
                  <b>{inr2(v.amount)}</b>
                </td>
                <td className="num">{inr2(v.allocated)}</td>
                <td>
                  {v.status === 'POSTED' && (
                    <Btn
                      className="btn sm ghost-red"
                      loading={cancelBusyId === v.id}
                      loadingText="Cancelling..."
                      onClick={async () => {
                        const reason = prompt('Reason for cancelling ' + v.voucher_no + '?');
                        if (!reason) return;
                        setCancelBusyId(v.id);
                        try {
                          await apiCall(`/api/vouchers/${v.id}/cancel`, 'POST', { reason });
                          const msg = `${v.voucher_no} cancelled and reversed in ledger`;
                          setOk(msg);
                          toast.success(msg);
                          reload();
                        } catch (x: any) {
                          const msg = x.message || 'Failed to cancel voucher';
                          setErr(msg);
                          toast.error(msg);
                        } finally {
                          setCancelBusyId(null);
                        }
                      }}
                    >
                      Cancel
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
            {data && !data.length && (
              <tr>
                <td colSpan={10} className="muted text-center p-6">
                  No vouchers recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {f && lk && (
        <Modal
          title={rec ? 'Receipt from customer' : 'Payment to vendor'}
          onClose={() => setF(null)}
        >
          <Msg err={err} />
          <div className="form">
            <Field label={rec ? 'Customer *' : 'Vendor *'}>
              <select
                value={f.party_id ?? ''}
                onChange={e => {
                  setF({ ...f, party_id: Number(e.target.value) });
                  setAlloc({});
                }}
              >
                <option value="">— select party —</option>
                {lk.parties
                  .filter((p: any) => p.kind === (rec ? 'CUSTOMER' : 'VENDOR') || p.kind === 'BOTH')
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Date *">
              <input
                type="date"
                value={f.voucher_date}
                onChange={e => setF({ ...f, voucher_date: e.target.value })}
              />
            </Field>

            <Field label={rec ? 'Received into *' : 'Paid from *'}>
              <select
                value={f.bank_account_id ?? ''}
                onChange={e => setF({ ...f, bank_account_id: Number(e.target.value) })}
              >
                {lk.accounts
                  .filter((a: any) => ['BANK', 'CASH'].includes(a.subtype))
                  .map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label={rec ? 'Amount received *' : 'Amount paid *'}>
              <input
                type="number"
                step="0.01"
                value={f.amount ?? ''}
                onChange={e => setF({ ...f, amount: e.target.value })}
              />
            </Field>

            <Field label={rec ? 'TDS deducted by customer' : 'TDS deducted by us'}>
              <input
                type="number"
                step="0.01"
                value={f.tds_amount}
                onChange={e => setF({ ...f, tds_amount: e.target.value })}
              />
            </Field>

            <Field label="Payment mode">
              <select
                value={f.mode}
                onChange={e => setF({ ...f, mode: e.target.value })}
              >
                {['NEFT', 'RTGS', 'IMPS', 'UPI', 'BANK', 'CHEQUE', 'CASH', 'CARD'].map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="UTR / Reference / Cheque no." wide>
              <input
                value={f.reference ?? ''}
                onChange={e => setF({ ...f, reference: e.target.value })}
              />
            </Field>
          </div>

          {open && (
            <div className="mt-5">
              <h3>Settle against {rec ? 'invoices' : 'bills'}</h3>
              <table>
                <thead>
                  <tr>
                    <th>Doc</th>
                    <th>Date</th>
                    <th>Due</th>
                    <th className="num">Outstanding</th>
                    <th className="w-40">Allocate (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {open.map(o => (
                    <tr key={o.id}>
                      <td>{o.doc_no}</td>
                      <td>{fmtDate(o.doc_date)}</td>
                      <td>{fmtDate(o.due_date)}</td>
                      <td className="num">{inr2(o.outstanding)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          max={o.outstanding}
                          value={alloc[o.id] ?? ''}
                          onChange={e =>
                            setAlloc({ ...alloc, [o.id]: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  {!open.length && (
                    <tr>
                      <td colSpan={5} className="muted text-center p-4">
                        No open documents — full amount will be held as on-account advance
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <p className="muted mt-2.5">
                Total voucher value {inr2(gross)} (Amount + TDS) · Allocated {inr2(allocated)} ·{' '}
                {gross - allocated >= 0 ? (
                  `On account advance: ${inr2(gross - allocated)}`
                ) : (
                  <span className="out">Over-allocated!</span>
                )}
              </p>
            </div>
          )}

          <div className="row justify-end mt-5">
            <Btn
              className="btn green"
              onClick={save}
              loading={saving}
              loadingText="Posting voucher..."
              disabled={gross - allocated < 0}
            >
              Post {rec ? 'receipt' : 'payment'}
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

