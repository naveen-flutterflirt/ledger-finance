import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../api/client.js';
import { inr2 } from '../../utils/format.js';
import { Skeleton } from '../../components/common/Skeleton.js';
import { Wallet } from 'lucide-react';

export default function MyPayslips() {
  const { data, loading } = useData<any[]>('/api/me/payslips');

  return (
    <>
      <div className="topbar">
        <div>
          <h1>My salary slips</h1>
          <span className="muted">Your personal monthly payslips and statutory deduction breakdown</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Gross pay</th>
              <th className="num">Deductions</th>
              <th className="num">Net pay</th>
              <th>Status</th>
              <th className="right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, r) => (
                <tr key={r}>
                  <td><Skeleton width="60%" height={15} /></td>
                  <td className="num"><Skeleton width="50%" height={15} /></td>
                  <td className="num"><Skeleton width="50%" height={15} /></td>
                  <td className="num"><Skeleton width="55%" height={15} /></td>
                  <td><Skeleton width={60} height={20} borderRadius={999} /></td>
                  <td className="right"><Skeleton width={70} height={26} borderRadius={4} /></td>
                </tr>
              ))
            ) : (
              data?.map(p => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/payslips/${p.id}`}>
                      <b>
                        {new Date(p.period + 'T00:00:00').toLocaleDateString('en-IN', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </b>
                    </Link>
                  </td>
                  <td className="num">{inr2(p.gross)}</td>
                  <td className="num">{inr2(p.total_deductions)}</td>
                  <td className="num">
                    <b>{inr2(p.net_pay)}</b>
                  </td>
                  <td>
                    <span className={`badge ${p.status === 'PAID' ? 's-PAID' : 's-APPROVED'}`}>
                      {p.status === 'PAID' ? 'Paid' : 'Processed'}
                    </span>
                  </td>
                  <td className="right">
                    <Link className="btn sm primary" to={`/payslips/${p.id}`}>
                      View Slip →
                    </Link>
                  </td>
                </tr>
              ))
            )}
            {data && !data.length && !loading && (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Wallet size={22} />
                    </div>
                    <div className="empty-state-title">No payslips found for your login</div>
                    <div className="empty-state-sub">
                      This page displays your personal salary slips. If you draw a monthly salary, link your login user account to an Employee profile under <strong>Payroll → Employees</strong>.
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
