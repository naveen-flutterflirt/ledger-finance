import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Msg, StatusBadge, Btn, Modal, Field } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { inr2, todayStr } from '../../utils/format.js';
import { Skeleton } from '../../components/common/Skeleton.js';
import { FolderOpen, Edit3, Trash2, Calendar, Eye, BookText } from 'lucide-react';

export default function Payroll() {
  const { data, reload, loading } = useData<any[]>('/api/payroll');
  const [period, setPeriod] = useState(todayStr().slice(0, 7));
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Edit & Delete states
  const [editingRun, setEditingRun] = useState<any | null>(null);
  const [newMonth, setNewMonth] = useState<string>('');
  const [savingPeriod, setSavingPeriod] = useState(false);

  const [deletingRun, setDeletingRun] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  const existingRun = data?.find(r => r.period.startsWith(period));

  async function createPayroll() {
    setErr('');

    // If a run for this period already exists in state
    if (existingRun) {
      if (existingRun.status === 'DRAFT') {
        navigate(`/payroll/${existingRun.id}`);
        return;
      }
      const msg = `Payroll for ${period} is already ${existingRun.status.toLowerCase()} (Run #${existingRun.id}).`;
      setErr(msg);
      toast.info(msg);
      return;
    }

    setSubmitting(true);
    try {
      const r = await apiCall('/api/payroll', 'POST', { period });
      toast.success(`Payroll run #${r.id} for ${period} created successfully`);
      navigate(`/payroll/${r.id}`);
    } catch (x: any) {
      const msg = x.message || `Payroll for ${period} already exists`;
      setErr(msg);
      toast.error(msg);
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdatePeriod(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRun || !newMonth) return;
    setSavingPeriod(true);
    try {
      await apiCall(`/api/payroll/${editingRun.id}`, 'PUT', { period: newMonth });
      toast.success(`Payroll run #${editingRun.id} month updated to ${newMonth}`);
      setEditingRun(null);
      reload();
    } catch (x: any) {
      toast.error(x.message || 'Failed to update payroll period');
    } finally {
      setSavingPeriod(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingRun) return;
    setDeleting(true);
    try {
      await apiCall(`/api/payroll/${deletingRun.id}`, 'DELETE');
      toast.success(`Payroll run #${deletingRun.id} deleted successfully`);
      setDeletingRun(null);
      reload();
    } catch (x: any) {
      toast.error(x.message || 'Failed to delete payroll run');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Payroll runs</h1>
        <div className="flex items-center gap-2.5 flex-nowrap shrink-0">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            title="Select payroll month"
          />
          <Btn
            className="btn primary whitespace-nowrap"
            onClick={createPayroll}
            loading={submitting}
            loadingText="Processing..."
          >
            {existingRun?.status === 'DRAFT'
              ? 'Open Draft Payroll →'
              : existingRun
              ? 'View Existing Payroll'
              : '+ Run payroll'}
          </Btn>
        </div>
      </div>

      <Msg err={err} />

      <div className="card p-0 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Status</th>
              <th className="num">Employees</th>
              <th className="num">Gross</th>
              <th className="num">Deductions</th>
              <th className="num">Net pay</th>
              <th className="num">Cost to company (CTC)</th>
              <th className="right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, r) => (
                <tr key={r}>
                  <td><Skeleton width="65%" height={15} /></td>
                  <td><Skeleton width={65} height={20} borderRadius={999} /></td>
                  <td className="num"><Skeleton width="40%" height={15} /></td>
                  <td className="num"><Skeleton width="60%" height={15} /></td>
                  <td className="num"><Skeleton width="60%" height={15} /></td>
                  <td className="num"><Skeleton width="65%" height={15} /></td>
                  <td className="num"><Skeleton width="65%" height={15} /></td>
                  <td className="right"><Skeleton width={120} height={26} borderRadius={4} /></td>
                </tr>
              ))
            ) : (
              data?.map(r => {
                const monthLabel = new Date(r.period + 'T00:00:00').toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                });
                const isDraft = r.status === 'DRAFT';
                const isPosted = r.status === 'POSTED';
                const isPaid = r.status === 'PAID';

                return (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/payroll/${r.id}`}>
                        <b>{monthLabel}</b>
                      </Link>
                    </td>
                    <td>
                      <StatusBadge s={r.status} />
                    </td>
                    <td className="num">{r.employees}</td>
                    <td className="num">{inr2(r.gross)}</td>
                    <td className="num">{inr2(r.deductions)}</td>
                    <td className="num">
                      <b>{inr2(r.net)}</b>
                    </td>
                    <td className="num">{inr2(r.employer_cost)}</td>
                    <td className="right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-nowrap">
                        {isDraft ? (
                          <>
                            <Link
                              className="btn sm primary inline-flex items-center gap-1"
                              to={`/payroll/${r.id}`}
                              title={`Edit draft payroll run #${r.id} (${monthLabel})`}
                            >
                              <Edit3 size={13} />
                              <span>Edit Run #{r.id}</span>
                            </Link>

                            <button
                              type="button"
                              className="btn sm inline-flex items-center gap-1"
                              onClick={() => {
                                setEditingRun(r);
                                setNewMonth(r.period.slice(0, 7));
                              }}
                              title="Change payroll month/period"
                            >
                              <Calendar size={13} />
                              <span>Month</span>
                            </button>

                            <button
                              type="button"
                              className="btn sm ghost-red inline-flex items-center gap-1"
                              onClick={() => setDeletingRun(r)}
                              title="Delete this draft payroll run"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              className="btn sm inline-flex items-center gap-1"
                              to={`/payroll/${r.id}`}
                              title={`View payroll run #${r.id}`}
                            >
                              <Eye size={13} />
                              <span>View Run #{r.id}</span>
                            </Link>

                            {r.journal_entry_id && (
                              <Link
                                className="btn sm inline-flex items-center gap-1"
                                to={`/journals/${r.journal_entry_id}`}
                                title="View Ledger Journal Entry"
                              >
                                <BookText size={13} />
                                <span>Journal #{r.journal_entry_id}</span>
                              </Link>
                            )}

                            {isPosted && (
                              <button
                                type="button"
                                className="btn sm ghost-red inline-flex items-center gap-1"
                                onClick={() => setDeletingRun(r)}
                                title="Reverse journal entry and delete this run"
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            {data && !data.length && !loading && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <FolderOpen size={22} />
                    </div>
                    <div className="empty-state-title">No payroll runs yet</div>
                    <div className="empty-state-sub">
                      Select a month above and click "+ Run payroll" to compute employee salaries.
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted mt-3.5">
        Statutory parameters (PF 12% + 12% on wages up to ceiling, ESI 0.75% + 3.25% up to ₹21,000 gross,
        Labour-Code 50% wage rule, and state professional tax slabs) are editable under Company Settings.
      </p>

      {/* Edit Month / Period Modal */}
      {editingRun && (
        <Modal
          title={`Change Month — Payroll Run #${editingRun.id}`}
          onClose={() => setEditingRun(null)}
        >
          <form onSubmit={handleUpdatePeriod}>
            <div className="form">
              <Field label="Target Payroll Month *">
                <input
                  type="month"
                  required
                  value={newMonth}
                  onChange={e => setNewMonth(e.target.value)}
                  autoFocus
                />
              </Field>
              <div className="col-span-full text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2.5 leading-relaxed">
                ℹ️ Changing the month will recompute working days, calculate attendance loss-of-pay (LOP), and regenerate draft payslips for all active employees during that period.
              </div>
            </div>
            <div className="row justify-end mt-5 gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => setEditingRun(null)}
                disabled={savingPeriod}
              >
                Cancel
              </button>
              <Btn
                type="submit"
                className="btn primary"
                loading={savingPeriod}
                loadingText="Updating..."
              >
                Update Month
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Run Confirmation Modal */}
      {deletingRun && (
        <Modal
          title={`Delete Payroll Run #${deletingRun.id}`}
          onClose={() => setDeletingRun(null)}
        >
          <div className="space-y-4">
            {deletingRun.status === 'DRAFT' ? (
              <p className="text-sm text-slate-700">
                Are you sure you want to permanently delete draft payroll run #{deletingRun.id} for{' '}
                <b>
                  {new Date(deletingRun.period + 'T00:00:00').toLocaleDateString('en-IN', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </b>
                ? All {deletingRun.employees} draft employee payslips in this run will be deleted.
              </p>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm leading-relaxed">
                <strong>Warning:</strong> This payroll run has already been posted to the General Ledger as{' '}
                <strong>Journal #{deletingRun.journal_entry_id}</strong>. Deleting it will automatically post an audit-compliant reversal journal entry to reverse the salary accrual, and then delete the payroll record.
              </div>
            )}

            <div className="row justify-end mt-5 gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => setDeletingRun(null)}
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
                Yes, Delete Run
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
