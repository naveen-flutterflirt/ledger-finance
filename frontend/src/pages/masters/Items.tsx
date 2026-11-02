import React from 'react';
import MasterPage from '../../components/common/MasterPage.js';
import { inr2 } from '../../utils/format.js';
import { useData } from '../../api/client.js';

export default function Items() {
  const { data: lk } = useData<any>('/api/lookups');

  const acc = (f: (a: any) => boolean) =>
    (lk?.accounts ?? []).filter(f).map((a: any) => ({
      value: a.id,
      label: `${a.code} · ${a.name}`,
    }));

  return (
    <MasterPage
      title="Items &amp; services"
      endpoint="/api/items"
      defaults={{ kind: 'SERVICE', unit: 'NOS', gst_rate: 18, active: true }}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'kind', label: 'Type' },
        {
          key: 'hsn_sac',
          label: 'HSN/SAC',
          render: r => <span className="mono">{r.hsn_sac ?? '—'}</span>,
        },
        { key: 'gst_rate', label: 'GST %', num: true, render: r => `${r.gst_rate}%` },
        {
          key: 'sale_price',
          label: 'Sale price',
          num: true,
          render: r => inr2(r.sale_price),
        },
        {
          key: 'purchase_price',
          label: 'Purchase price',
          num: true,
          render: r => inr2(r.purchase_price),
        },
      ]}
      fields={[
        { name: 'name', label: 'Item / Service name', required: true },
        {
          name: 'kind',
          label: 'Item kind',
          type: 'select',
          options: [
            { value: 'GOODS', label: 'Goods (HSN)' },
            { value: 'SERVICE', label: 'Service (SAC)' },
          ],
        },
        { name: 'hsn_sac', label: 'HSN / SAC Code' },
        { name: 'unit', label: 'Measurement unit (e.g. NOS, HRS, USER)' },
        {
          name: 'gst_rate',
          label: 'Default GST rate',
          type: 'select',
          options: [0, 0.25, 3, 5, 12, 18, 28, 40].map(r => ({
            value: r,
            label: `${r}%`,
          })),
        },
        { name: 'sale_price', label: 'Sale price (₹)', type: 'number' },
        { name: 'purchase_price', label: 'Purchase price (₹)', type: 'number' },
        {
          name: 'income_account_id',
          label: 'Sales income account',
          type: 'select',
          options: acc(a => a.type === 'INCOME'),
        },
        {
          name: 'expense_account_id',
          label: 'Purchase / asset account',
          type: 'select',
          options: acc(
            a => a.type === 'EXPENSE' || ['FIXED_ASSET', 'INVENTORY'].includes(a.subtype)
          ),
        },
        { name: 'active', label: 'Active', type: 'checkbox' },
      ]}
    />
  );
}

