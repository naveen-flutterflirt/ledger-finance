import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import MasterPage from '../../components/common/MasterPage.js';
import { useData } from '../../api/client.js';

export default function Parties() {
  const [sp] = useSearchParams();
  const kind = sp.get('kind') ?? 'CUSTOMER';
  const { data: lk } = useData<any>('/api/lookups');

  const states = Object.entries(lk?.states ?? {}).map(([c, n]: any) => ({
    value: c,
    label: `${c} · ${n}`,
  }));

  return (
    <MasterPage
      key={kind}
      title={kind === 'VENDOR' ? 'Vendors' : 'Customers'}
      endpoint="/api/parties"
      defaults={{ kind, credit_days: 30, state_code: '23' }}
      filterRows={(r: any) => r.kind === kind || r.kind === 'BOTH'}
      columns={[
        {
          key: 'name',
          label: 'Name',
          render: r => (
            <Link to={`/reports/ledger?party_id=${r.id}`}>{r.name}</Link>
          ),
        },
        {
          key: 'gstin',
          label: 'GSTIN',
          render: r => (
            <span className="mono">{r.gstin ?? 'Unregistered'}</span>
          ),
        },
        { key: 'state_code', label: 'State' },
        { key: 'email', label: 'Email' },
        { key: 'credit_days', label: 'Credit days', num: true },
      ]}
      fields={[
        { name: 'name', label: 'Party name', required: true },
        {
          name: 'kind',
          label: 'Type',
          type: 'select',
          options: ['CUSTOMER', 'VENDOR', 'BOTH'].map(k => ({ value: k, label: k })),
        },
        { name: 'gstin', label: 'GSTIN' },
        { name: 'pan', label: 'PAN' },
        { name: 'state_code', label: 'State', type: 'select', options: states },
        { name: 'email', label: 'Email' },
        { name: 'phone', label: 'Phone' },
        { name: 'credit_days', label: 'Credit days', type: 'number' },
        { name: 'address', label: 'Address' },
      ]}
    />
  );
}

