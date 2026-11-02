import React from 'react';
import { Link } from 'react-router-dom';
import MasterPage from '../../components/common/MasterPage.js';
import { inr2 } from '../../utils/format.js';

const SUB = [
  'BANK',
  'CASH',
  'RECEIVABLE',
  'INVENTORY',
  'CURRENT_ASSET',
  'TAX_INPUT',
  'FIXED_ASSET',
  'ACC_DEPRECIATION',
  'PAYABLE',
  'CURRENT_LIABILITY',
  'TAX_OUTPUT',
  'PAYROLL_LIABILITY',
  'LOAN',
  'CAPITAL',
  'RETAINED_EARNINGS',
  'SALES',
  'OTHER_INCOME',
  'COGS',
  'DIRECT_EXPENSE',
  'INDIRECT_EXPENSE',
  'PAYROLL_EXPENSE',
  'DEPRECIATION',
  'FINANCE_COST',
  'ROUND_OFF',
];

const showBalance = (r: any) => {
  const b = ['ASSET', 'EXPENSE'].includes(r.type) ? r.balance : -r.balance;
  return (
    <span className={b < 0 ? 'out' : ''}>
      {inr2(Math.abs(b))} {r.balance === 0 ? '' : r.balance > 0 ? 'Dr' : 'Cr'}
    </span>
  );
};

export default function Accounts() {
  return (
    <MasterPage
      title="Chart of accounts"
      endpoint="/api/accounts"
      defaults={{ type: 'EXPENSE', subtype: 'INDIRECT_EXPENSE', active: true }}
      columns={[
        {
          key: 'code',
          label: 'Code',
          render: r => <span className="mono">{r.code}</span>,
        },
        {
          key: 'name',
          label: 'Account name',
          render: r => (
            <>
              <Link to={`/reports/ledger?account_id=${r.id}`}>{r.name}</Link>
              {r.system_key && (
                <span className="badge" style={{ marginLeft: 6 }}>
                  system
                </span>
              )}
            </>
          ),
        },
        { key: 'type', label: 'Type' },
        {
          key: 'subtype',
          label: 'Group',
          render: r => r.subtype?.replace(/_/g, ' ').toLowerCase(),
        },
        {
          key: 'balance',
          label: 'Balance',
          num: true,
          render: showBalance,
        },
      ]}
      fields={[
        { name: 'code', label: 'Account code', required: true },
        { name: 'name', label: 'Account name', required: true },
        {
          name: 'type',
          label: 'Account type',
          type: 'select',
          required: true,
          options: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].map(t => ({
            value: t,
            label: t,
          })),
        },
        {
          name: 'subtype',
          label: 'Group (drives reports)',
          type: 'select',
          required: true,
          options: SUB.map(t => ({ value: t, label: t.replace(/_/g, ' ') })),
        },
        { name: 'bank_name', label: 'Bank name (if bank account)' },
        { name: 'bank_acc_last4', label: 'Account number (last 4 digits)' },
        { name: 'ifsc', label: 'IFSC Code' },
        { name: 'active', label: 'Active', type: 'checkbox' },
      ]}
    />
  );
}

