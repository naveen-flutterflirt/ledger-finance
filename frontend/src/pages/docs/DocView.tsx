import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import DocForm from '../../components/common/DocForm.js';
import { DOC_CONFIG } from '../../utils/constants.js';
import { Field, Modal, Msg, StatusBadge, Btn } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { fmtDate, inr2, words } from '../../utils/format.js';
import { DocViewSkeleton } from '../../components/common/Skeleton.js';

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
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2>{d.company?.legal_name ?? d.company?.name}</h2>
            <div className="muted" style={{ maxWidth: 420 }}>
              {d.company?.address}
            </div>
            <div style={{ marginTop: 4 }}>
              GSTIN <b className="mono">{d.company?.gstin ?? '—'}</b> · PAN {d.company?.pan ?? '—'}
            </div>
          </div>
          <div className="spacer" />
          <div className="right">
            <h2 style={{ color: 'var(--pink)' }}>{title}</h2>
            <table className="meta" style={{ width: 'auto', marginLeft: 'auto' }}>
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

        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0' }} />

        <div>
          <div className="muted">{meta?.sales ? 'Bill to' : 'Supplier'}</div>
          <b style={{ fontSize: 16 }}>{d.party_name}</b>
          <div className="muted">{d.party_address}</div>
          <div>
            GSTIN <span className="mono">{d.party_gstin ?? 'Unregistered'}</span> · State{' '}
            {d.party_state ?? '—'}
          </div>
        </div>

        <table style={{ marginTop: 18 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>HSN/SAC</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Taxable</th>
              <th className="num">GST %</th>
              {inter ? (
                <th className="num">IGST</th>
              ) : (
                <>
                  <th className="num">CGST</th>
                  <th className="num">SGST</th>
                </>
              )}
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {d.lines?.map((l: any, i: number) => (
              <tr key={l.id}>
                <td>{i + 1}</td>
                <td>
                  {l.description}
                  <div className="muted" style={{ fontSize: 11 }}>
                    {l.account_code} {l.account_name}
                  </div>
                </td>
                <td className="mono">{l.hsn_sac}</td>
                <td className="num">{Number(l.qty)}</td>
                <td className="num">{inr2(l.rate)}</td>
                <td className="num">{inr2(l.taxable)}</td>
                <td className="num">{l.gst_rate}%</td>
                {inter ? (
                  <td className="num">{inr2(l.igst)}</td>
                ) : (
                  <>
                    <td className="num">{inr2(l.cgst)}</td>
                    <td className="num">{inr2(l.sgst)}</td>
                  </>
                )}
                <td className="num">
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

        <div className="row" style={{ alignItems: 'flex-start', marginTop: 16 }}>
          <div style={{ maxWidth: 440 }}>
            <div className="muted">Amount in words:</div>
            <b>Rupees {words(d.total)} Only</b>
            {d.notes && <p className="muted" style={{ marginTop: 8 }}>{d.notes}</p>}
            {d.entry_no && (
              <p className="muted no-print" style={{ marginTop: 4 }}>
                Ledger entry: <Link to={`/journals`}>{d.entry_no}</Link>
              </p>
            )}
          </div>
          <div className="spacer" />
          <table style={{ width: 320 }}>
            <tbody>
              <tr>
                <td>Taxable value</td>
                <td className="num">{inr2(d.taxable_value)}</td>
              </tr>
              {inter ? (
                <tr>
                  <td>IGST</td>
                  <td className="num">{inr2(d.igst)}</td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td>CGST</td>
                    <td className="num">{inr2(d.cgst)}</td>
                  </tr>
                  <tr>
                    <td>SGST</td>
                    <td className="num">{inr2(d.sgst)}</td>
                  </tr>
                </>
              )}
              <tr>
                <td>Round off</td>
                <td className="num">{inr2(d.round_off)}</td>
              </tr>
              <tr className="tot">
                <td>Total</td>
                <td className="num">{inr2(d.total)}</td>
              </tr>
              {d.status !== 'DRAFT' && (
                <>
                  <tr>
                    <td>Settled</td>
                    <td className="num">{inr2(d.settled)}</td>
                  </tr>
                  <tr>
                    <td>
                      <b>Balance due</b>
                    </td>
                    <td className="num">
                      <b>{inr2(d.outstanding)}</b>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {d.settlements?.length > 0 && (
          <div className="no-print" style={{ marginTop: 18 }}>
            <div className="muted" style={{ fontWeight: 600, marginBottom: 4 }}>
              Settlement history:
            </div>
            {d.settlements.map((s: any, idx: number) => (
              <div key={idx} style={{ fontSize: 13 }}>
                {fmtDate(s.date)} · {s.via} {s.ref} · {inr2(s.amount)}
              </div>
            ))}
          </div>
        )}

        <p className="right" style={{ marginTop: 48 }}>
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
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
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

