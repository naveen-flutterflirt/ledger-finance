import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Msg, StatusBadge, Btn } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { inr2, todayStr } from '../../utils/format.js';
import { Skeleton } from '../../components/common/Skeleton.js';
import { FolderOpen } from 'lucide-react';

export default function Payroll() {
  const { data, reload, loading } = useData<any[]>('/api/payroll');
  const [period, setPeriod] = useState(todayStr().slice(0, 7));
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  return (
    <>
      <div className="topbar">
        <h1>Payroll runs</h1>
        <div className="row">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{ width: 160 }}
            title="Select payroll month"
          />
          <Btn
            className="btn primary"
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

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
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
                  <td className="right"><Skeleton width={80} height={26} borderRadius={4} /></td>
                </tr>
              ))
            ) : (
              data?.map(r => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/payroll/${r.id}`}>
                      <b>
                        {new Date(r.period + 'T00:00:00').toLocaleDateString('en-IN', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </b>
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
                  <td className="right" style={{ whiteSpace: 'nowrap' }}>
                    <Link className="btn sm primary" to={`/payroll/${r.id}`}>
                      View Run #{r.id}
                    </Link>
                    {r.journal_entry_id && (
                      <Link
                        className="btn sm"
                        to={`/journals/${r.journal_entry_id}`}
                        style={{ marginLeft: 6 }}
                        title="View Ledger Journal Entry"
                      >
                        Journal #{r.journal_entry_id}
                      </Link>
                    )}
                  </td>
                </tr>
              ))
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

      <p className="muted" style={{ marginTop: 14 }}>
        Statutory parameters (PF 12% + 12% on wages up to ceiling, ESI 0.75% + 3.25% up to ₹21,000 gross,
        Labour-Code 50% wage rule, and state professional tax slabs) are editable under Company Settings.
      </p>
    </>
  );
}
