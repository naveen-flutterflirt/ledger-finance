import React from 'react';
import MasterPage from '../../components/common/MasterPage.js';
import { fmtDate, inr2 } from '../../utils/format.js';
import { useData } from '../../api/client.js';

export default function Employees() {
  const { data: members } = useData<any[]>('/api/members');

  return (
    <MasterPage
      title="Employees"
      endpoint="/api/employees"
      defaults={{
        pf_applicable: true,
        esi_applicable: true,
        pt_applicable: true,
        active: true,
        hra: 0,
        special: 0,
        other_allow: 0,
        monthly_tds: 0,
        user_id: '',
      }}
      columns={[
        {
          key: 'emp_code',
          label: 'Code',
          render: r => <span className="mono">{r.emp_code}</span>,
        },
        {
          key: 'name',
          label: 'Name',
          render: r => (
            <>
              <b>{r.name}</b>
              <div className="muted" style={{ fontSize: 11 }}>
                {r.designation} · {r.department}
              </div>
            </>
          ),
        },
        {
          key: 'join_date',
          label: 'Joined',
          render: r => fmtDate(r.join_date),
        },
        {
          key: 'basic',
          label: 'Basic pay',
          num: true,
          render: r => inr2(r.basic),
        },
        {
          key: 'gross',
          label: 'Monthly gross',
          num: true,
          render: r => (
            <b>
              {inr2(
                Number(r.basic || 0) +
                  Number(r.hra || 0) +
                  Number(r.special || 0) +
                  Number(r.other_allow || 0)
              )}
            </b>
          ),
        },
        {
          key: 'user_id',
          label: 'Login Portal',
          render: r => {
            const m = members?.find(x => x.id === r.user_id);
            return m ? (
              <span className="badge s-APPROVED" title={`Logged in as ${m.email}`}>
                {m.email}
              </span>
            ) : (
              <span className="muted" style={{ fontSize: 11 }}>
                No login linked
              </span>
            );
          },
        },
        {
          key: 'stat',
          label: 'PF / ESI / PT',
          render: r =>
            [r.pf_applicable && 'PF', r.esi_applicable && 'ESI', r.pt_applicable && 'PT']
              .filter(Boolean)
              .join(' · '),
        },
        {
          key: 'monthly_tds',
          label: 'TDS/month',
          num: true,
          render: r => inr2(r.monthly_tds),
        },
        {
          key: 'active',
          label: 'Active',
          render: r => (r.active ? 'Yes' : 'No'),
        },
      ]}
      fields={[
        { name: 'emp_code', label: 'Employee code *', required: true },
        { name: 'name', label: 'Full name *', required: true },
        { name: 'designation', label: 'Designation' },
        { name: 'department', label: 'Department' },
        { name: 'join_date', label: 'Joining date *', type: 'date', required: true },
        { name: 'exit_date', label: 'Exit date', type: 'date' },
        { name: 'basic', label: 'Basic pay (monthly) *', type: 'number', required: true },
        { name: 'hra', label: 'HRA', type: 'number' },
        { name: 'special', label: 'Special allowance', type: 'number' },
        { name: 'other_allow', label: 'Other allowances', type: 'number' },
        { name: 'monthly_tds', label: 'TDS per month', type: 'number' },
        { name: 'pan', label: 'PAN' },
        { name: 'uan', label: 'UAN (PF)' },
        { name: 'esi_no', label: 'ESI Insurance number' },
        { name: 'bank_name', label: 'Bank name' },
        { name: 'bank_acc_last4', label: 'Account number (last 4 digits)' },
        { name: 'pf_applicable', label: 'PF applicable', type: 'checkbox' },
        { name: 'esi_applicable', label: 'ESI applicable', type: 'checkbox' },
        { name: 'pt_applicable', label: 'Professional tax applicable', type: 'checkbox' },
        {
          name: 'user_id',
          label: 'Linked Login Account (Select login user for employee self-service portal)',
          type: 'select',
          options: [
            { value: '', label: '— No login account linked —' },
            ...(members ?? []).map(m => ({
              value: m.id,
              label: `${m.name} (${m.email}) · ${m.role} [ID #${m.id}]`,
            })),
          ],
        },
        { name: 'active', label: 'Active employee', type: 'checkbox' },
      ]}
    />
  );
}
