import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import DocForm from '../../components/common/DocForm.js';
import { DOC_CONFIG } from '../../utils/constants.js';
import { Field, Modal, Msg, StatusBadge, Btn } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { fmtDate, inr2, words } from '../../utils/format.js';
import { DocViewSkeleton } from '../../components/common/Skeleton.js';
import { Trash2 } from 'lucide-react';

export default function DocView() {
  const { kind = 'sales', id } = useParams<{ kind: string; id: string }>();
  const meta = DOC_CONFIG[kind];
  const navigate = useNavigate();

  const { data: d, reload, loading } = useData<any>(`/api/docs/${kind}/${id}`);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [cancel, setCancel] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const { toast } = useToast();

  if (loading || !d) {
    return <DocViewSkeleton />;
  }

  const run = async (key: string, fn: () => Promise<any>, m: string) => {
    setErr('');
    setOk('');
    setBusyKey(key);
    try {
      await fn();
      setOk(m);
      toast.success(m);
      setCancel(null);
      reload();
    } catch (x: any) {
      setErr(x.message || 'Action failed');
      toast.error(x.message || 'Action failed');
    } finally {
      setBusyKey(null);
    }
  };

  if (edit) {
    return (
      <>
        <div className="topbar">
          <h1>Edit draft</h1>
          <button className="btn" onClick={() => setEdit(false)}>
            Cancel
          </button>
        </div>
        <DocForm
          kind={kind}
          initial={{
            ...d,
            lines: d.lines.map((l: any) => ({
              item_id: l.item_id ?? '',
              description: l.description,
              hsn_sac: l.hsn_sac,
              qty: l.qty,
              rate: l.rate,
              discount: l.discount,
              gst_rate: l.gst_rate,
              account_id: l.account_id,
            })),
          }}
        />
      </>
    );
  }

  const inter = d.igst > 0 || d.place_of_supply !== d.company?.state_code;
  const title =
    kind === 'sales'
      ? d.party_gstin
        ? 'TAX INVOICE'
        : 'TAX INVOICE (B2C)'
      : meta?.one.toUpperCase();

  return (
    <>
      <div className="topbar no-print">
        <h1>
          {d.doc_no ?? 'Draft'} <StatusBadge s={d.status} />
        </h1>
        <div className="row">
          <Link className="btn" to={`/docs/${kind}`}>
            ← Back
          </Link>
          <button className="btn" onClick={() => window.print()}>
            Print / PDF
          </button>

          {d.status === 'DRAFT' && (
            <>
              <button className="btn" onClick={() => setEdit(true)}>
                Edit
              </button>
              <Btn
                className="btn primary"
                loading={busyKey === 'post_doc'}
                loadingText="Posting..."
                onClick={() =>
                  run('post_doc', () => apiCall(`/api/docs/${kind}/${d.id}/post`, 'POST'), 'Posted to ledger')
                }
              >
                Post to ledger
              </Btn>
            </>
          )}

          {d.status !== 'CANCELLED' && (
            <button className="btn ghost-red" onClick={() => setCancel('')}>
              Cancel
            </button>
          )}

          <button
            type="button"
            className="btn ghost-red inline-flex items-center gap-1"
            onClick={async () => {
              if (
                window.confirm(
                  `Are you sure you want to permanently delete ${meta.one} ${
                    d.doc_no || '#' + d.id
                  }?`
                )
              ) {
                try {
                  await apiCall(`/api/docs/${kind}/${d.id}`, 'DELETE');
                  toast.success(`${meta.one} deleted successfully`);
                  navigate(`/docs/${kind}`);
                } catch (e: any) {
                  toast.error(e.message || 'Failed to delete');
                }
              }
            }}
            title={`Delete ${meta.one.toLowerCase()}`}
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>

          {['POSTED', 'PARTIAL'].includes(d.status) && !meta?.againstKind && (
            <Link
              className="btn green"
              to={`/vouchers?kind=${meta?.sales ? 'RECEIPT' : 'PAYMENT'}&party_id=${d.party_id}&invoice_id=${d.id}`}
            >
              {meta?.sales ? 'Receive payment' : 'Pay bill'}
            </Link>
          )}
        </div>
      </div>

      <div className="no-print">
        <Msg err={err} ok={ok} />
      </div>

      <div className="invoice">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-navy m-0">{d.company?.legal_name ?? d.company?.name}</h2>
            <div className="muted max-w-md text-xs sm:text-sm mt-1 leading-relaxed">
              {d.company?.address}
            </div>
            <div className="mt-1 text-xs sm:text-sm">
              GSTIN <b className="mono font-semibold">{d.company?.gstin ?? '—'}</b> · PAN {d.company?.pan ?? '—'}
            </div>
          </div>
          <div className="sm:text-right shrink-0">
            <h2 className="text-pink text-lg sm:text-xl font-bold uppercase tracking-wider m-0">{title}</h2>
            <table className="meta w-auto sm:ml-auto text-xs sm:text-sm mt-1">
              <tbody>
                <tr>
                  <td className="muted">No.</td>
                  <td>
                    <b>{d.doc_no ?? 'DRAFT'}</b>
                  </td>
                </tr>
                <tr>
                  <td className="muted">Date</td>
                  <td>{fmtDate(d.doc_date)}</td>
                </tr>
                {d.due_date && !meta?.againstKind && (
                  <tr>
                    <td className="muted">Due</td>
                    <td>{fmtDate(d.due_date)}</td>
                  </tr>
                )}
                {d.against_no && (
                  <tr>
                    <td className="muted">Against</td>
                    <td>{d.against_no}</td>
                  </tr>
                )}
                <tr>
                  <td className="muted">Place of supply</td>
                  <td>{d.place_of_supply}</td>
                </tr>
                {d.reverse_charge && (
                  <tr>
                    <td className="muted">Reverse charge</td>
                    <td>Yes</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <hr className="border-0 border-t border-surface-line my-4.5" />

        <div className="text-xs sm:text-sm">
          <div className="muted text-xs uppercase tracking-wider">{meta?.sales ? 'Bill to' : 'Supplier'}</div>
          <b className="text-base font-bold text-slate-900 block mt-0.5">{d.party_name}</b>
          <div className="muted text-xs sm:text-sm mt-0.5 leading-relaxed">{d.party_address}</div>
          <div className="mt-1">
            GSTIN <span className="mono font-semibold">{d.party_gstin ?? 'Unregistered'}</span> · State{' '}
            {d.party_state ?? '—'}
          </div>
        </div>

        {/* Invoice Table Container */}
        <div className="invoice-table-wrapper w-full overflow-x-auto my-4.5 rounded-lg border border-slate-200">
          <table className="invoice-items-table w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="col-idx">#</th>
                <th className="col-desc">Description</th>
                <th className="col-hsn">HSN/SAC</th>
                <th className="col-qty num">Qty</th>
                <th className="col-rate num">Rate</th>
                <th className="col-taxable num">Taxable</th>
                <th className="col-gst num">GST %</th>
                {inter ? (
                  <th className="col-tax num">IGST</th>
                ) : (
                  <>
                    <th className="col-tax num">CGST</th>
                    <th className="col-tax num">SGST</th>
                  </>
                )}
                <th className="col-amt num">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.lines?.map((l: any, i: number) => (
                <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="col-idx text-slate-400">{i + 1}</td>
                  <td className="col-desc">
                    <span className="font-semibold text-slate-800 block">{l.description}</span>
                    <div className="muted text-[11px] text-slate-400 mt-0.5">
                      {l.account_code} {l.account_name}
                    </div>
                  </td>
                  <td className="col-hsn mono text-slate-600">{l.hsn_sac}</td>
                  <td className="col-qty num text-slate-700">{Number(l.qty)}</td>
                  <td className="col-rate num text-slate-700">{inr2(l.rate)}</td>
                  <td className="col-taxable num text-slate-700">{inr2(l.taxable)}</td>
                  <td className="col-gst num text-slate-600">{l.gst_rate}%</td>
                  {inter ? (
                    <td className="col-tax num text-slate-700">{inr2(l.igst)}</td>
                  ) : (
                    <>
                      <td className="col-tax num text-slate-700">{inr2(l.cgst)}</td>
                      <td className="col-tax num text-slate-700">{inr2(l.sgst)}</td>
                    </>
                  )}
                  <td className="col-amt num font-bold text-slate-900">
                    {inr2(
                      Number(l.taxable) +
                        Number(l.cgst) +
                        Number(l.sgst) +
                        Number(l.igst)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mt-6 pt-4 border-t border-slate-100">
          <div className="max-w-md text-xs sm:text-sm">
            <div className="muted text-xs">Amount in words:</div>
            <b className="text-sm font-bold text-slate-800">Rupees {words(d.total)} Only</b>
            {d.notes && <p className="muted mt-2 text-xs leading-relaxed">{d.notes}</p>}
            {d.entry_no && (
              <p className="muted no-print mt-2 text-xs">
                Ledger entry: <Link to={`/journals`} className="text-indigo-600 hover:underline">{d.entry_no}</Link>
              </p>
            )}
          </div>
          <div className="w-full md:w-80">
            <table className="invoice-summary-table w-full text-xs sm:text-sm border-collapse">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-1.5 text-slate-600">Taxable value</td>
                  <td className="py-1.5 num font-medium text-slate-800">{inr2(d.taxable_value)}</td>
                </tr>
                {inter ? (
                  <tr>
                    <td className="py-1.5 text-slate-600">IGST</td>
                    <td className="py-1.5 num font-medium text-slate-800">{inr2(d.igst)}</td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td className="py-1.5 text-slate-600">CGST</td>
                      <td className="py-1.5 num font-medium text-slate-800">{inr2(d.cgst)}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-slate-600">SGST</td>
                      <td className="py-1.5 num font-medium text-slate-800">{inr2(d.sgst)}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <td className="py-1.5 text-slate-600">Round off</td>
                  <td className="py-1.5 num text-slate-600">{inr2(d.round_off)}</td>
                </tr>
                <tr className="tot font-bold text-slate-900 border-t-2 border-slate-200">
                  <td className="py-2 text-slate-900 font-bold">Total</td>
                  <td className="py-2 num text-base text-slate-900 font-bold">{inr2(d.total)}</td>
                </tr>
                {d.status !== 'DRAFT' && (
                  <>
                    <tr>
                      <td className="py-1.5 text-slate-600">Settled</td>
                      <td className="py-1.5 num text-emerald-600 font-medium">{inr2(d.settled)}</td>
                    </tr>
                    <tr className="font-bold border-t border-slate-100">
                      <td className="py-2 text-slate-800 font-bold">Balance due</td>
                      <td className="py-2 num text-slate-900 font-bold">{inr2(d.outstanding)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {d.settlements?.length > 0 && (
          <div className="no-print mt-4.5">
            <div className="muted font-semibold mb-1">
              Settlement history:
            </div>
            {d.settlements.map((s: any, idx: number) => (
              <div key={idx} className="text-[13px]">
                {fmtDate(s.date)} · {s.via} {s.ref} · {inr2(s.amount)}
              </div>
            ))}
          </div>
        )}

        <p className="right mt-12">
          For {d.company?.name}
          <br />
          <br />
          <br />
          <span className="muted">Authorised Signatory</span>
        </p>
      </div>

      {cancel !== null && (
        <Modal title="Cancel document" onClose={() => setCancel(null)}>
          <p className="muted">
            {d.status === 'DRAFT'
              ? 'The draft will be marked cancelled.'
              : 'A reversal entry will be posted to the ledger. Any payments applied must be cancelled first.'}
          </p>
          <Field label="Cancellation reason *">
            <input
              value={cancel}
              onChange={e => setCancel(e.target.value)}
              placeholder="e.g. Invoiced to incorrect company"
            />
          </Field>
          <div className="row justify-end mt-4">
            <button className="btn" onClick={() => setCancel(null)}>
              Keep document
            </button>
            <Btn
              className="btn red"
              loading={busyKey === 'cancel_doc'}
              loadingText="Cancelling..."
              onClick={() =>
                run(
                  'cancel_doc',
                  () =>
                    apiCall(`/api/docs/${kind}/${d.id}/cancel`, 'POST', { reason: cancel }),
                  'Document cancelled'
                )
              }
            >
              Cancel document
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

