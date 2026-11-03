import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../../api/client.js';
import { inr2 } from '../../utils/format.js';
import { DocViewSkeleton } from '../../components/common/Skeleton.js';

export default function PayslipView() {
  const { id } = useParams<{ id: string }>();
  const { data: s, error, loading } = useData<any>(`/api/payslips/${id}`);

  if (loading) return <DocViewSkeleton />;
  if (error) return <div className="err">{error}</div>;
  if (!s) return null;

  const E: [string, number][] = [
    ['Basic salary', s.basic],
    ['House rent allowance (HRA)', s.hra],
    ['Special allowance', s.special],
    ['Other allowances', s.other_allow],
    ['Bonus / incentive', s.bonus],
  ];

  const D: [string, number][] = [
    ['Provident fund (12%)', s.pf_employee],
    ['Employee State Insurance (0.75%)', s.esi_employee],
    ['Professional tax', s.pt],
    ['Income tax (TDS)', s.tds],
    ['Other deductions', s.other_deduction],
  ];

  return (
    <>
      <div className="topbar no-print">
        <h1>Salary slip</h1>
        <div className="row">
          <button className="btn" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>

      <div className="invoice">
        <div className="row">
          <div>
            <h2>{s.legal_name ?? s.company}</h2>
            <div className="muted">{s.address}</div>
          </div>
          <div className="spacer" />
          <div className="right">
            <h2 className="text-pink">PAYSLIP</h2>
            <b>
              {new Date(s.period + 'T00:00:00').toLocaleDateString('en-IN', {
                month: 'long',
                year: 'numeric',
              })}
            </b>
          </div>
        </div>

        <hr className="border-0 border-t border-surface-line my-4" />

        <table className="meta">
          <tbody>
            <tr>
              <td className="muted">Employee:</td>
              <td>
                <b>{s.name}</b> ({s.emp_code})
              </td>
              <td className="muted">Designation:</td>
              <td>
                {s.designation} · {s.department}
              </td>
            </tr>
            <tr>
              <td className="muted">PAN:</td>
              <td>{s.pan}</td>
              <td className="muted">UAN (PF):</td>
              <td>{s.uan ?? '—'}</td>
            </tr>
            <tr>
              <td className="muted">Bank Account:</td>
              <td>
                {s.bank_name} ••{s.bank_acc_last4}
              </td>
              <td className="muted">Paid Days:</td>
              <td>
                {s.paid_days} of {s.days_in_month} (LOP: {s.lop_days})
              </td>
            </tr>
          </tbody>
        </table>

        <div className="grid g2 mt-5">
          <table>
            <thead>
              <tr>
                <th>Earnings</th>
                <th className="num">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {E.filter(([, v]) => Number(v) > 0).map(([l, v]) => (
                <tr key={l}>
                  <td>{l}</td>
                  <td className="num">{inr2(v)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="tot">
                <td>Gross earnings</td>
                <td className="num">{inr2(s.gross)}</td>
              </tr>
            </tfoot>
          </table>

          <table>
            <thead>
              <tr>
                <th>Deductions</th>
                <th className="num">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {D.filter(([, v]) => Number(v) > 0).map(([l, v]) => (
                <tr key={l}>
                  <td>{l}</td>
                  <td className="num">{inr2(v)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="tot">
                <td>Total deductions</td>
                <td className="num">{inr2(s.total_deductions)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card bg-navy text-white mt-4.5 p-4.5">
          <div className="row">
            <b className="text-base">Take-home Net Pay</b>
            <div className="spacer" />
            <b className="text-2xl text-teal">{inr2(s.net_pay)}</b>
          </div>
        </div>

        <p className="muted mt-3.5">
          Employer contributions (not deducted from employee): PF {inr2(s.pf_employer)} · ESI{' '}
          {inr2(s.esi_employer)}. Applicable PF wage: {inr2(s.pf_wage)}.
          This is an electronically generated statement.
        </p>
      </div>
    </>
  );
}

