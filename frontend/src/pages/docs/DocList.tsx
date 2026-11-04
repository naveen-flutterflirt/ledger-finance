import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DOC_CONFIG } from '../../utils/constants.js';
import { StatusBadge, Modal, Btn } from '../../components/common/ui.js';
import { fmtDate, inr2 } from '../../utils/format.js';
import { useData, apiCall } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { Skeleton } from '../../components/common/Skeleton.js';
import { KpiCard } from '../../components/common/KpiCard.js';
import { Receipt, Percent, TrendingUp, CreditCard, Eye, Trash2, AlertTriangle } from 'lucide-react';

export default function DocList() {
  const { kind = 'sales' } = useParams<{ kind: string }>();
  const meta = DOC_CONFIG[kind];
  const [st, setSt] = useState('');
  const [deletingDoc, setDeletingDoc] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const { data, error, loading, reload } = useData<any[]>(
    `/api/docs/${kind}${st ? `?status=${st}` : ''}`
  );

  if (!meta) return <p className="err">Unknown document kind: {kind}</p>;

  const sum = (k: string) =>
    (data ?? [])
      .filter(d => d.status !== 'CANCELLED' && d.status !== 'DRAFT')
      .reduce((s, d) => s + (Number(d[k]) || 0), 0);

  async function handleConfirmDelete() {
    if (!deletingDoc) return;
    setDeleting(true);
    try {
      await apiCall(`/api/docs/${kind}/${deletingDoc.id}`, 'DELETE');
      toast.success(`${meta.one} ${deletingDoc.doc_no || '#' + deletingDoc.id} deleted successfully`);
      setDeletingDoc(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  }

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

      <div className="card p-0 overflow-x-auto shadow-sm border border-slate-200 rounded-xl bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
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
              <th className="text-right whitespace-nowrap pr-4">Action</th>
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
                  <td className="text-right"><Skeleton width={70} height={24} borderRadius={4} /></td>
                </tr>
              ))
            ) : (
              data?.map(d => (
                <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                  <td>
                    <Link
                      to={`/docs/${kind}/${d.id}`}
                      className="whitespace-nowrap font-semibold inline-flex items-center gap-1.5 text-navy hover:text-indigo-600"
                    >
                      <span>{d.doc_no ?? 'Draft #' + d.id}</span>
                      {d.is_opening && (
                        <span className="badge text-[10px] py-px px-1.5 font-semibold">
                          opening
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{fmtDate(d.doc_date)}</td>
                  <td className="font-medium whitespace-nowrap">{d.party_name}</td>
                  <td className="mono text-xs whitespace-nowrap">{d.party_gstin ?? 'Unregistered'}</td>
                  <td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span>{fmtDate(d.due_date)}</span>
                      {d.days_overdue > 0 && ['POSTED', 'PARTIAL'].includes(d.status) && (
                        <span className="badge s-OVERDUE text-[10px] py-0.5 px-1.5">
                          {d.days_overdue}d overdue
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <StatusBadge s={d.status} />
                  </td>
                  <td className="num whitespace-nowrap">{inr2(d.taxable_value)}</td>
                  <td className="num whitespace-nowrap">{inr2(d.cgst + d.sgst + d.igst)}</td>
                  <td className="num whitespace-nowrap">
                    <b>{inr2(d.total)}</b>
                  </td>
                  <td className="num whitespace-nowrap">
                    {['POSTED', 'PARTIAL'].includes(d.status) ? inr2(d.outstanding) : '—'}
                  </td>
                  <td className="text-right whitespace-nowrap pr-4">
                    <div className="inline-flex items-center justify-end">
                      <div className="inline-flex items-center rounded-lg border border-slate-200/90 bg-white shadow-xs overflow-hidden">
                        <Link
                          to={`/docs/${kind}/${d.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                          title={`View ${d.doc_no ?? 'Document'}`}
                        >
                          <Eye size={13} className="text-slate-400" />
                          <span>View</span>
                        </Link>
                        <span className="w-px h-3.5 bg-slate-200" />
                        <button
                          type="button"
                          className="inline-flex items-center justify-center cursor-pointer px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          onClick={() => setDeletingDoc(d)}
                          title={`Delete ${meta.one.toLowerCase()}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {data && !data.length && !loading && (
              <tr>
                <td colSpan={11} className="muted text-center p-6">
                  No {meta.title.toLowerCase()} found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingDoc && (
        <Modal
          title={`Delete ${meta.one} — ${deletingDoc.doc_no || 'Draft #' + deletingDoc.id}`}
          onClose={() => setDeletingDoc(null)}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h4 className="m-0 text-base font-bold text-slate-900">
                  {deletingDoc.status === 'DRAFT'
                    ? `Delete Draft ${meta.one}?`
                    : `Delete & Reverse ${meta.one}?`}
                </h4>
                <div className="text-xs text-slate-600 mt-1.5 space-y-2">
                  <p className="m-0">
                    <strong>Party:</strong> {deletingDoc.party_name} · <strong>Amount:</strong> {inr2(deletingDoc.total)}
                  </p>
                  {deletingDoc.status === 'DRAFT' ? (
                    <p className="m-0 text-slate-500">
                      Are you sure you want to permanently delete this draft document and all its line items? This action cannot be undone.
                    </p>
                  ) : ['PAID', 'PARTIAL'].includes(deletingDoc.status) ? (
                    <div className="text-amber-800 bg-amber-50 border border-amber-200 rounded p-3 leading-relaxed space-y-1.5">
                      <p className="m-0 font-semibold">
                        ⚠️ Payments or credit notes are applied to this document.
                      </p>
                      <p className="m-0 text-[11px] text-amber-700">
                        In accounting, payments must be removed before an invoice can be deleted:
                      </p>
                      <ol className="m-0 pl-4 list-decimal text-[11px] text-amber-900 space-y-0.5">
                        <li>
                          Open{' '}
                          <Link to="/vouchers" className="underline font-bold text-amber-950">
                            Vouchers
                          </Link>{' '}
                          and cancel the receipt/payment voucher linked to this invoice.
                        </li>
                        <li>Return here and delete this invoice.</li>
                      </ol>
                    </div>
                  ) : (
                    <p className="m-0 text-slate-700 bg-slate-50 border border-slate-200 rounded p-2.5 leading-relaxed">
                      ℹ️ This document is currently posted to the General Ledger. Deleting it will automatically create an audit reversal entry in your ledger and permanently delete the record.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="row justify-end mt-5 gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn"
                onClick={() => setDeletingDoc(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <Btn
                type="button"
                className="btn red"
                loading={deleting}
                loadingText="Deleting..."
                onClick={handleConfirmDelete}
              >
                Yes, Delete
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
