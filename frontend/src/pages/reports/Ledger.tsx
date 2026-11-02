import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AccountSelect } from '../../components/common/ui.js';
import { fmtDate, fyStart, inr2, todayStr } from '../../utils/format.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import { useData } from '../../api/client.js';
import { Users, Building2, BookOpen } from 'lucide-react';

const drcr = (v: number) =>
  `${inr2(Math.abs(v))} ${v > 0 ? 'Dr' : v < 0 ? 'Cr' : ''}`;

export default function Ledger() {
  const [sp] = useSearchParams();

  const [acc, setAcc] = useState(sp.get('account_id') ?? '');
  const [customerParty, setCustomerParty] = useState('');
  const [vendorParty, setVendorParty] = useState('');
  const [from, setFrom] = useState(fyStart());
  const [to, setTo] = useState(todayStr());

  const { data: lk } = useData<any>('/api/lookups');

  // Determine initial mode from query params
  const initialPartyId = sp.get('party_id');
  const [mode, setMode] = useState<'account' | 'customer' | 'vendor'>(() => {
    if (initialPartyId) return 'customer';
    return 'account';
  });

  // Separate customers and vendors cleanly
  const customers = useMemo(() => {
    if (!lk?.parties) return [];
    return lk.parties.filter((p: any) => p.kind === 'CUSTOMER' || p.kind === 'BOTH');
  }, [lk?.parties]);

  const vendors = useMemo(() => {
    if (!lk?.parties) return [];
    return lk.parties.filter((p: any) => p.kind === 'VENDOR' || p.kind === 'BOTH');
  }, [lk?.parties]);

  // Handle initial party_id from URL
  useEffect(() => {
    if (initialPartyId && lk?.parties) {
      const match = lk.parties.find((p: any) => String(p.id) === String(initialPartyId));
      if (match?.kind === 'VENDOR') {
        setMode('vendor');
        setVendorParty(String(match.id));
      } else {
        setMode('customer');
        setCustomerParty(String(initialPartyId));
      }
    }
  }, [initialPartyId, lk?.parties]);

  // Auto-select first account in account mode
  useEffect(() => {
    if (mode === 'account' && !acc && lk?.accounts?.length > 0) {
      const defaultAcc =
        lk.accounts.find((a: any) => a.subtype === 'BANK') ||
        lk.accounts.find((a: any) => a.type === 'INCOME') ||
        lk.accounts[0];
      if (defaultAcc) setAcc(String(defaultAcc.id));
    }
  }, [mode, acc, lk]);

  // Auto-select first customer in customer mode
  useEffect(() => {
    if (mode === 'customer' && !customerParty && customers.length > 0) {
      setCustomerParty(String(customers[0].id));
    }
  }, [mode, customerParty, customers]);

  // Auto-select first vendor in vendor mode
  useEffect(() => {
    if (mode === 'vendor' && !vendorParty && vendors.length > 0) {
      setVendorParty(String(vendors[0].id));
    }
  }, [mode, vendorParty, vendors]);

  // Current active party id based on mode
  const activePartyId = mode === 'customer' ? customerParty : vendorParty;

  const { data: d, loading } = useData<any>(
    mode === 'account'
      ? acc
        ? `/api/reports/ledger?account_id=${acc}&from=${from}&to=${to}`
        : null
      : activePartyId
      ? `/api/reports/party-ledger?party_id=${activePartyId}&from=${from}&to=${to}`
      : null
  );

  return (
    <>
      <div className="topbar">
        <div>
          <h1>
            {mode === 'account'
              ? 'General ledger'
              : mode === 'customer'
              ? 'Customer statement of account'
              : 'Vendor statement of account'}
          </h1>
          <span className="muted">
            {mode === 'account'
              ? 'Complete double-entry transaction history for nominal, real & personal accounts'
              : mode === 'customer'
              ? 'Customer sales invoices, payment receipts & outstanding receivables (AR)'
              : 'Vendor purchase bills, payment disbursements & outstanding payables (AP)'}
          </span>
        </div>
        <div className="row no-print">
          <div className="tabs">
            <button
              type="button"
              className={mode === 'account' ? 'on' : ''}
              onClick={() => setMode('account')}
            >
              Account Ledger
            </button>
            <button
              type="button"
              className={mode === 'customer' ? 'on' : ''}
              onClick={() => {
                setMode('customer');
                if (!customerParty && customers.length > 0) {
                  setCustomerParty(String(customers[0].id));
                }
              }}
            >
              Customers
            </button>
            <button
              type="button"
              className={mode === 'vendor' ? 'on' : ''}
              onClick={() => {
                setMode('vendor');
                if (!vendorParty && vendors.length > 0) {
                  setVendorParty(String(vendors[0].id));
                }
              }}
            >
              Vendors
            </button>
          </div>
          <button type="button" className="btn" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>

      <div className="card form no-print" style={{ marginBottom: 16 }}>
        {mode === 'account' && (
          <div>
            <label>Select account</label>
            {lk && (
              <AccountSelect
                accounts={lk.accounts}
                value={acc}
                onChange={setAcc}
              />
            )}
          </div>
        )}

        {mode === 'customer' && (
          <div>
            <label>Select Customer</label>
            <select
              value={String(customerParty || '')}
              onChange={e => setCustomerParty(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">— Choose customer —</option>
              {customers.map((p: any) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} {p.gstin ? `(${p.gstin})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'vendor' && (
          <div>
            <label>Select Vendor / Supplier</label>
            <select
              value={String(vendorParty || '')}
              onChange={e => setVendorParty(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">— Choose vendor —</option>
              {vendors.map((p: any) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} {p.gstin ? `(${p.gstin})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label>From date</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
          />
        </div>

        <div>
          <label>To date</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
          />
        </div>
      </div>

      {loading && <TableSkeleton rows={6} cols={7} />}

      {!d && !loading && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              {mode === 'account' ? (
                <BookOpen size={24} />
              ) : mode === 'customer' ? (
                <Users size={24} />
              ) : (
                <Building2 size={24} />
              )}
            </div>
            <div className="empty-state-title">
              {mode === 'account'
                ? 'No account selected'
                : mode === 'customer'
                ? 'No customer selected'
                : 'No vendor selected'}
            </div>
            <div className="empty-state-sub">
              {mode === 'account'
                ? 'Select an account from the dropdown above to view its transactions and running balance.'
                : mode === 'customer'
                ? 'Select a customer from the dropdown above to view their sales invoices, receipts and balance.'
                : 'Select a vendor from the dropdown above to view their purchase bills, payments and balance.'}
            </div>
          </div>
        </div>
      )}

      {d && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fafbfe',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <b style={{ fontSize: 16, color: 'var(--navy)' }}>
                {d.account
                  ? `${d.account.code} · ${d.account.name}`
                  : `${d.party?.name} (${d.party?.kind === 'VENDOR' ? 'Vendor / Supplier' : 'Customer'})`}
              </b>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                Statement period: {fmtDate(d.from)} to {fmtDate(d.to)}
                {d.party?.gstin && ` · GSTIN: ${d.party.gstin}`}
                {d.party?.credit_days ? ` · Credit Terms: ${d.party.credit_days} days` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {mode === 'customer' ? 'Total Outstanding (Receivable): ' : mode === 'vendor' ? 'Total Payable (Due): ' : 'Net Closing Balance: '}
              </span>
              <b style={{ fontSize: 16, color: d.closing < 0 ? 'var(--red)' : '#0b7d6b' }}>
                {drcr(d.closing)}
              </b>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry no.</th>
                <th>Source</th>
                <th>Particulars</th>
                <th className="num">Debit (₹)</th>
                <th className="num">Credit (₹)</th>
                <th className="num">Running balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="grp" style={{ background: '#f8fafd' }}>
                <td colSpan={6}>
                  <b>Opening balance</b> (as of {fmtDate(d.from)})
                </td>
                <td className="num">
                  <b>{drcr(d.opening)}</b>
                </td>
              </tr>
              {d.rows.map((r: any, i: number) => (
                <tr key={i}>
                  <td>{fmtDate(r.entry_date)}</td>
                  <td className="mono">
                    {r.entry_id ? (
                      <Link to={`/journals/${r.entry_id}`}>
                        <b>{r.entry_no}</b>
                      </Link>
                    ) : (
                      r.entry_no
                    )}
                  </td>
                  <td>
                    <span className="badge">{r.source?.replace(/_/g, ' ')}</span>
                  </td>
                  <td>
                    {r.party ? <b>{r.party} · </b> : ''}
                    {r.narration}
                  </td>
                  <td className="num">{r.debit ? inr2(r.debit) : '—'}</td>
                  <td className="num">{r.credit ? inr2(r.credit) : '—'}</td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {drcr(r.balance)}
                  </td>
                </tr>
              ))}
              {d.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
                    No transactions found for this period.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="tot" style={{ background: '#fafbfe' }}>
                <td colSpan={6}>
                  <b>Closing balance</b> (as of {fmtDate(d.to)})
                </td>
                <td className="num">
                  <b>{drcr(d.closing)}</b>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
