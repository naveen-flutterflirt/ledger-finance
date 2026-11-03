import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Msg, StatusBadge, Btn } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { fmtDate, inr2, todayStr } from '../../utils/format.js';
import { DocViewSkeleton } from '../../components/common/Skeleton.js';
import { BookText, CheckCircle2, ArrowRight, Banknote, ShieldAlert, CheckCircle, Briefcase, Trash2 } from 'lucide-react';
import { KpiCard } from '../../components/common/KpiCard.js';

export default function PayrollRun() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: r, reload, loading } = useData<any>(`/api/payroll/${id}`);
  const { data: lk } = useData<any>('/api/lookups');

  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [ed, setEd] = useState<Record<number, any>>({});
  const [bank, setBank] = useState<string>('');
  const [payDate, setPayDate] = useState(todayStr());
  const { toast } = useToast();

  // Auto-select primary bank account if available
  React.useEffect(() => {
    if (!bank && lk?.accounts) {
      const primaryBank =
        lk.accounts.find((a: any) => a.subtype === 'BANK') ||
        lk.accounts.find((a: any) => a.subtype === 'CASH');
      if (primaryBank) setBank(String(primaryBank.id));
    }
  }, [lk, bank]);

  if (loading || !r) {
    return <DocViewSkeleton />;
  }

  const draft = r.status === 'DRAFT';

  const run = async (key: string, fn: () => Promise<any>, m: string) => {
    setErr('');
    setOk('');
    setBusyKey(key);
    try {
      await fn();
      setOk(m);
      toast.success(m);
      reload();
    } catch (x: any) {
      setErr(x.message || 'Action failed');
      toast.error(x.message || 'Action failed');
    } finally {
      setBusyKey(null);
    }
  };

  const T = (k: string) =>
    (r.slips ?? []).reduce((s: number, x: any) => s + (Number(x[k]) || 0), 0);

  return (
    <>
      <div className="topbar">
        <h1>
          Payroll ·{' '}
          {new Date(r.period + 'T00:00:00').toLocaleDateString('en-IN', {
            month: 'long',
            year: 'numeric',
          })}{' '}
          <StatusBadge s={r.status} />
        </h1>

        <div className="row">
          <Link className="btn" to="/payroll">
            ← Payroll runs
          </Link>

          {draft && (
            <>
              <Btn
                className="btn primary"
                loading={busyKey === 'post_ledger'}
                loadingText="Posting salary journal..."
                onClick={() =>
                  run(
                    'post_ledger',
                    () => apiCall(`/api/payroll/${r.id}/post`, 'POST'),
                    'Salary journal posted to ledger'
                  )
                }
              >
                Post to ledger
              </Btn>

              <Btn
                className="btn ghost-red"
                loading={busyKey === 'delete_draft'}
                loadingText="Deleting..."
                onClick={async () => {
                  if (
                    window.confirm(
                      `Delete draft payroll run #${r.id} for ${new Date(
                        r.period + 'T00:00:00'
                      ).toLocaleDateString('en-IN', {
                        month: 'long',
                        year: 'numeric',
                      })}? All draft employee payslips will be permanently removed.`
                    )
                  ) {
                    setBusyKey('delete_draft');
                    try {
                      await apiCall(`/api/payroll/${r.id}`, 'DELETE');
                      toast.success(`Draft payroll run #${r.id} deleted`);
                      navigate('/payroll');
                    } catch (x: any) {
                      toast.error(x.message || 'Failed to delete payroll run');
                      setBusyKey(null);
                    }
                  }
                }}
              >
                <Trash2 size={14} /> Delete Draft
              </Btn>
            </>
          )}

          {r.status === 'POSTED' && lk && (
            <>
              <select
                value={bank}
                onChange={e => setBank(e.target.value)}
                className="w-56"
              >
                <option value="">Pay from bank…</option>
                {lk.accounts
                  .filter((a: any) => a.subtype === 'BANK')
                  .map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>

              <input
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
                className="w-36"
              />

              <Btn
                className="btn green"
                disabled={!bank}
                loading={busyKey === 'pay_salaries'}
                loadingText="Disbursing..."
                onClick={() =>
                  run(
                    'pay_salaries',
                    () =>
                      apiCall(`/api/payroll/${r.id}/pay`, 'POST', {
                        bank_account_id: Number(bank),
                        date: payDate,
                      }),
                    'Net salaries disbursed'
                  )
                }
              >
                Pay {inr2(r.net)}
              </Btn>
            </>
          )}
        </div>
      </div>

      <Msg err={err} ok={ok} />

      {/* Ledger Journal Links */}
      {r.journal_entry_id && (
        <div className="card py-3 px-4.5 mb-4 bg-slate-50 border-l-4 border-l-indigo flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2.5">
            <BookText size={18} className="text-indigo shrink-0" />
            <div>
              <strong className="text-navy font-bold">Posted to General Ledger:</strong>{' '}
              <span className="muted">
                Double-entry salary &amp; statutory accrual journal entry is recorded.
              </span>
            </div>
          </div>
          <Link
            className="btn primary sm inline-flex items-center gap-1.5"
            to={`/journals/${r.journal_entry_id}`}
          >
            <span>View Ledger Journal #{r.journal_entry_id}</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {r.payment_entry_id && (
        <div className="card py-3 px-4.5 mb-4 bg-emerald-50/60 border-l-4 border-l-teal flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-teal shrink-0" />
            <div>
              <strong className="text-emerald-800 font-bold">Bank Payment Recorded:</strong>{' '}
              <span className="muted">
                Salary disbursement journal recorded against bank account.
              </span>
            </div>
          </div>
          <Link
            className="btn sm inline-flex items-center gap-1.5"
            to={`/journals/${r.payment_entry_id}`}
          >
            <span>View Disbursement Journal #{r.payment_entry_id}</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      )}

      <div className="grid g4">
        <KpiCard
          label="Gross salary"
          value={inr2(r.gross)}
          icon={Banknote}
          variant="indigo"
          tooltipTitle="Gross Salaries"
          tooltipDesc="Total earnings before statutory employee deductions like PF, ESI, PT, and TDS."
        />
        <KpiCard
          label="Total deductions"
          value={inr2(r.deductions)}
          icon={ShieldAlert}
          variant="amber"
          tooltipTitle="Statutory Deductions"
          tooltipDesc="Total employee deductions withheld for PF, ESI, Professional Tax, and TDS."
        />
        <KpiCard
          label="Net payable"
          value={<span className="in">{inr2(r.net)}</span>}
          icon={CheckCircle}
          variant="teal"
          tooltipTitle="Net Take-Home Payable"
          tooltipDesc="Net salaries to be disbursed directly into employees' bank accounts."
        />
        <KpiCard
          label="Employer cost"
          value={inr2(r.employer_cost)}
          icon={Briefcase}
          variant="purple"
          tooltipTitle="Total Cost to Company (CTC)"
          tooltipDesc="Total company cost including gross salary plus employer PF and ESI contributions."
        />
      </div>

      <div className="card p-0 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th className="num">Paid days</th>
              {draft && (
                <>
                  <th>LOP days</th>
                  <th>Bonus</th>
                  <th>Other ded.</th>
                </>
              )}
              <th className="num">Gross</th>
              <th className="num">PF wage</th>
              <th className="num">PF</th>
              <th className="num">ESI</th>
              <th className="num">PT</th>
              <th className="num">TDS</th>
              <th className="num">Net pay</th>
              <th className="num">Employer PF+ESI</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {r.slips?.map((s: any) => {
              const e = ed[s.employee_id] ?? {
                lop_days: s.lop_days,
                bonus: s.bonus,
                other_deduction: s.other_deduction,
              };

              return (
                <tr key={s.id}>
                  <td>
                    <b>{s.name}</b>
                    <div className="muted mono">{s.emp_code}</div>
                  </td>
                  <td className="num">
                    {s.paid_days}/{s.days_in_month}
                  </td>
                  {draft && (
                    <>
                      <td className="w-20">
                        <input
                          type="number"
                          step="0.5"
                          value={e.lop_days}
                          onChange={x =>
                            setEd({
                              ...ed,
                              [s.employee_id]: { ...e, lop_days: x.target.value },
                            })
                          }
                        />
                      </td>
                      <td className="w-24">
                        <input
                          type="number"
                          value={e.bonus}
                          onChange={x =>
                            setEd({
                              ...ed,
                              [s.employee_id]: { ...e, bonus: x.target.value },
                            })
                          }
                        />
                      </td>
                      <td className="w-24">
                        <input
                          type="number"
                          value={e.other_deduction}
                          onChange={x =>
                            setEd({
                              ...ed,
                              [s.employee_id]: { ...e, other_deduction: x.target.value },
                            })
                          }
                        />
                      </td>
                    </>
                  )}
                  <td className="num">{inr2(s.gross)}</td>
                  <td className="num muted">{inr2(s.pf_wage)}</td>
                  <td className="num">{inr2(s.pf_employee)}</td>
                  <td className="num">{inr2(s.esi_employee)}</td>
                  <td className="num">{inr2(s.pt)}</td>
                  <td className="num">{inr2(s.tds)}</td>
                  <td className="num">
                    <b>{inr2(s.net_pay)}</b>
                  </td>
                  <td className="num muted">
                    {inr2(Number(s.pf_employer) + Number(s.esi_employer))}
                  </td>
                  <td className="whitespace-nowrap">
                    {draft && ed[s.employee_id] && (
                      <Btn
                        className="btn sm primary"
                        loading={busyKey === `slip_${s.employee_id}`}
                        loadingText="Updating..."
                        onClick={() =>
                          run(
                            `slip_${s.employee_id}`,
                            async () => {
                              await apiCall(
                                `/api/payroll/${r.id}/slips/${s.employee_id}`,
                                'PUT',
                                {
                                  lop_days: Number(e.lop_days),
                                  bonus: Number(e.bonus),
                                  other_deduction: Number(e.other_deduction),
                                }
                              );
                              const n = { ...ed };
                              delete n[s.employee_id];
                              setEd(n);
                            },
                            'Payslip recalculated successfully'
                          )
                        }
                      >
                        Apply
                      </Btn>
                    )}{' '}
                    <Link className="btn sm" to={`/payslips/${s.id}`}>
                      Payslip
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="tot">
              <td>Total</td>
              <td />
              {draft && (
                <>
                  <td />
                  <td />
                  <td />
                </>
              )}
              <td className="num">{inr2(T('gross'))}</td>
              <td />
              <td className="num">{inr2(T('pf_employee'))}</td>
              <td className="num">{inr2(T('esi_employee'))}</td>
              <td className="num">{inr2(T('pt'))}</td>
              <td className="num">{inr2(T('tds'))}</td>
              <td className="num">{inr2(T('net_pay'))}</td>
              <td className="num">
                {inr2(T('pf_employer') + T('esi_employer'))}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

