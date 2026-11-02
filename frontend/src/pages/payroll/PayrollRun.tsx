import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Msg, StatusBadge, Btn } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { fmtDate, inr2, todayStr } from '../../utils/format.js';
import { DocViewSkeleton } from '../../components/common/Skeleton.js';
import { BookText, CheckCircle2, ArrowRight } from 'lucide-react';

export default function PayrollRun() {
  const { id } = useParams<{ id: string }>();
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
          )}

          {r.status === 'POSTED' && lk && (
            <>
              <select
                value={bank}
                onChange={e => setBank(e.target.value)}
                style={{ width: 220 }}
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
                style={{ width: 150 }}
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
        <div
          className="card"
          style={{
            padding: '12px 18px',
            marginBottom: 16,
            background: '#f8fafd',
            borderLeft: '4px solid var(--indigo)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookText size={18} style={{ color: 'var(--indigo)' }} />
            <div>
              <strong style={{ color: 'var(--navy)' }}>Posted to General Ledger:</strong>{' '}
              <span className="muted">
                Double-entry salary &amp; statutory accrual journal entry is recorded.
              </span>
            </div>
          </div>
          <Link
            className="btn primary sm"
            to={`/journals/${r.journal_entry_id}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>View Ledger Journal #{r.journal_entry_id}</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {r.payment_entry_id && (
        <div
          className="card"
          style={{
            padding: '12px 18px',
            marginBottom: 16,
            background: '#f0fdf4',
            borderLeft: '4px solid var(--teal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} style={{ color: '#0b7d6b' }} />
            <div>
              <strong style={{ color: '#065f46' }}>Bank Payment Recorded:</strong>{' '}
              <span className="muted">
                Salary disbursement journal recorded against bank account.
              </span>
            </div>
          </div>
          <Link
            className="btn sm"
            to={`/journals/${r.payment_entry_id}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>View Disbursement Journal #{r.payment_entry_id}</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      )}

      <div className="grid g4">
        <div className="card kpi">
          <div className="label">Gross salary</div>
          <div className="val">{inr2(r.gross)}</div>
        </div>
        <div className="card kpi">
          <div className="label">Total deductions (PF, ESI, PT, TDS)</div>
          <div className="val">{inr2(r.deductions)}</div>
        </div>
        <div className="card kpi">
          <div className="label">Net payable</div>
          <div className="val in">{inr2(r.net)}</div>
        </div>
        <div className="card kpi">
          <div className="label">Employer cost (Gross + PF/ESI)</div>
          <div className="val">{inr2(r.employer_cost)}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
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
                      <td style={{ width: 80 }}>
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
                      <td style={{ width: 100 }}>
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
                      <td style={{ width: 100 }}>
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
                  <td style={{ whiteSpace: 'nowrap' }}>
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

