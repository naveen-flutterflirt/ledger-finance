import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DOC_CONFIG } from '../../utils/constants.js';
import { AccountSelect, Field, Msg, Btn } from './ui.js';
import { FormSkeleton } from './Skeleton.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { inr2, todayStr } from '../../utils/format.js';

const RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];

type LineItem = {
  item_id?: any;
  description: string;
  hsn_sac?: string;
  qty: any;
  rate: any;
  discount?: any;
  gst_rate: any;
  account_id: any;
};

export default function DocForm({ kind, initial }: { kind: string; initial?: any }) {
  const meta = DOC_CONFIG[kind];
  const navigate = useNavigate();
  const { data: lk } = useData<any>('/api/lookups');
  const { data: bases } = useData<any[]>(meta.againstKind ? `/api/docs/${meta.againstKind}` : null);

  const [h, setH] = useState<any>(
    initial ?? { doc_date: todayStr(), reverse_charge: false, is_opening: false }
  );
  const [lines, setLines] = useState<LineItem[]>(
    initial?.lines ?? [{ description: '', qty: 1, rate: '', gst_rate: 18, account_id: '' }]
  );
  const [err, setErr] = useState('');
  const [busyAction, setBusyAction] = useState<'draft' | 'post' | null>(null);
  const { toast } = useToast();

  const parties = (lk?.parties ?? []).filter((p: any) => p.kind === meta.party || p.kind === 'BOTH');
  const party = parties.find((p: any) => String(p.id) === String(h.party_id));

  useEffect(() => {
    if (party && !initial) {
      setH((x: any) => ({
        ...x,
        place_of_supply: party.state_code ?? lk?.company?.state_code,
      }));
    }
  }, [h.party_id, party, initial, lk]);

  const acctOk = (a: any) =>
    meta.sales
      ? a.type === 'INCOME'
      : a.type === 'EXPENSE' || ['FIXED_ASSET', 'INVENTORY', 'CURRENT_ASSET'].includes(a.subtype);

  const upd = (i: number, p: Partial<LineItem>) =>
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const pickItem = (i: number, itemId: string) => {
    const it = lk?.items?.find((x: any) => String(x.id) === itemId);
    if (!it) return upd(i, { item_id: '' });

    upd(i, {
      item_id: it.id,
      description: it.name,
      hsn_sac: it.hsn_sac,
      rate: meta.sales ? it.sale_price : it.purchase_price,
      gst_rate: it.gst_rate,
      account_id: (meta.sales ? it.income_account_id : it.expense_account_id) ?? '',
    });
  };

  // Live GST preview
  const calc = useMemo(() => {
    const inter = lk && h.place_of_supply && h.place_of_supply !== lk.company.state_code;
    let taxable = 0;
    let tax = 0;

    for (const l of lines) {
      const t = Number(l.qty || 0) * Number(l.rate || 0) - Number(l.discount || 0);
      taxable += t;
      if (!h.is_opening) {
        tax += (t * Number(l.gst_rate || 0)) / 100;
      }
    }

    const exact = Math.round((taxable + tax) * 100) / 100;
    return {
      inter,
      taxable,
      tax,
      round: Math.round(exact) - exact,
      total: Math.round(exact),
    };
  }, [lines, h.place_of_supply, h.is_opening, lk]);

  async function save(post: boolean) {
    setErr('');
    setBusyAction(post ? 'post' : 'draft');
    try {
      const body = {
        ...h,
        post,
        lines: lines.map(l => ({
          ...l,
          qty: Number(l.qty),
          rate: Number(l.rate),
          discount: Number(l.discount || 0),
          gst_rate: Number(l.gst_rate),
        })),
      };

      const r = initial?.id
        ? await apiCall(`/api/docs/${kind}/${initial.id}`, 'PUT', body)
        : await apiCall(`/api/docs/${kind}`, 'POST', body);

      if (post && initial?.id) {
        await apiCall(`/api/docs/${kind}/${initial.id}/post`, 'POST');
      }

      toast.success(
        `${meta.one} ${post ? 'posted to ledger' : 'saved as draft'} successfully`
      );
      navigate(`/docs/${kind}/${r.id}`);
    } catch (x: any) {
      const msg = x.message || 'Failed to save document';
      setErr(msg);
      toast.error(msg);
      setBusyAction(null);
    }
  }

  if (!lk) return <FormSkeleton fieldCount={6} />;

  return (
    <>
      <Msg err={err} />
      <div className="card form">
        <Field label={`${meta.party === 'CUSTOMER' ? 'Customer' : 'Vendor'} *`}>
          <select
            value={h.party_id ?? ''}
            onChange={e => setH({ ...h, party_id: Number(e.target.value) })}
          >
            <option value="">— select —</option>
            {parties.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.gstin ? ` · ${p.gstin}` : ' · unregistered'}
              </option>
            ))}
          </select>
        </Field>

        {kind === 'purchases' && (
          <Field label="Vendor bill no. *">
            <input
              value={h.doc_no ?? ''}
              onChange={e => setH({ ...h, doc_no: e.target.value })}
            />
          </Field>
        )}

        <Field label="Date *">
          <input
            type="date"
            value={h.doc_date}
            onChange={e => setH({ ...h, doc_date: e.target.value })}
          />
        </Field>

        {!meta.againstKind && (
          <Field label="Due date">
            <input
              type="date"
              value={h.due_date ?? ''}
              onChange={e => setH({ ...h, due_date: e.target.value })}
            />
          </Field>
        )}

        <Field label="Place of supply (GST State)">
          <select
            value={h.place_of_supply ?? ''}
            onChange={e => setH({ ...h, place_of_supply: e.target.value })}
          >
            <option value="">— select state —</option>
            {Object.entries(lk.states).map(([c, n]: any) => (
              <option key={c} value={c}>
                {c} · {n}
              </option>
            ))}
          </select>
        </Field>

        {meta.againstKind && (
          <Field label={`Against ${meta.againstKind === 'sales' ? 'invoice' : 'bill'}`}>
            <select
              value={h.against_id ?? ''}
              onChange={e => setH({ ...h, against_id: e.target.value })}
            >
              <option value="">— select document —</option>
              {(bases ?? [])
                .filter(
                  b =>
                    String(b.party_id) === String(h.party_id) &&
                    b.status !== 'DRAFT' &&
                    b.status !== 'CANCELLED'
                )
                .map(b => (
                  <option key={b.id} value={b.id}>
                    {b.doc_no} · {inr2(b.total)}
                  </option>
                ))}
            </select>
          </Field>
        )}

        {kind === 'purchases' && (
          <Field label="Reverse charge (RCM)">
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={h.reverse_charge}
              onChange={e => setH({ ...h, reverse_charge: e.target.checked })}
            />
          </Field>
        )}

        {!meta.againstKind && !initial?.id && (
          <Field label="Opening balance (no GST)">
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={h.is_opening}
              onChange={e => setH({ ...h, is_opening: e.target.checked })}
            />
          </Field>
        )}
      </div>

      {h.place_of_supply && (
        <p className="muted">
          {calc.inter ? 'Inter-state supply → IGST' : 'Intra-state supply → CGST + SGST'}
          {h.is_opening ? ' (not applied to opening balances)' : ''}
        </p>
      )}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 180 }}>Item</th>
              <th>Description</th>
              <th style={{ width: 90 }}>HSN/SAC</th>
              <th style={{ width: 80 }}>Qty</th>
              <th style={{ width: 110 }}>Rate</th>
              <th style={{ width: 90 }}>Disc.</th>
              <th style={{ width: 80 }}>GST %</th>
              <th style={{ width: 220 }}>Account</th>
              <th className="num">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  <select
                    value={l.item_id ?? ''}
                    onChange={e => pickItem(i, e.target.value)}
                  >
                    <option value="">— select item —</option>
                    {lk.items.map((it: any) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={l.description}
                    onChange={e => upd(i, { description: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={l.hsn_sac ?? ''}
                    onChange={e => upd(i, { hsn_sac: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="any"
                    value={l.qty}
                    onChange={e => upd(i, { qty: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={l.rate}
                    onChange={e => upd(i, { rate: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={l.discount ?? ''}
                    onChange={e => upd(i, { discount: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={l.gst_rate}
                    onChange={e => upd(i, { gst_rate: e.target.value })}
                  >
                    {RATES.map(r => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <AccountSelect
                    accounts={lk.accounts}
                    filter={acctOk}
                    value={l.account_id}
                    onChange={v => upd(i, { account_id: v })}
                  />
                </td>
                <td className="num">
                  {inr2(
                    Number(l.qty || 0) * Number(l.rate || 0) - Number(l.discount || 0)
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn sm ghost-red"
                    onClick={() => setLines(lines.filter((_, j) => j !== i))}
                    disabled={lines.length === 1}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ padding: 14, alignItems: 'flex-start' }}>
          <button
            type="button"
            className="btn sm"
            onClick={() =>
              setLines([
                ...lines,
                { description: '', qty: 1, rate: '', gst_rate: 18, account_id: '' },
              ])
            }
          >
            + Add line
          </button>
          <div className="spacer" />
          <table style={{ width: 340 }}>
            <tbody>
              <tr>
                <td>Taxable value</td>
                <td className="num">{inr2(calc.taxable)}</td>
              </tr>
              <tr>
                <td>{calc.inter ? 'IGST' : 'CGST + SGST'}</td>
                <td className="num">{inr2(calc.tax)}</td>
              </tr>
              <tr>
                <td>Round off</td>
                <td className="num">{inr2(calc.round)}</td>
              </tr>
              <tr className="tot">
                <td>Total</td>
                <td className="num">{inr2(calc.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Field label="Notes / terms">
        <input
          value={h.notes ?? ''}
          onChange={e => setH({ ...h, notes: e.target.value })}
        />
      </Field>

      <div className="row" style={{ marginTop: 16 }}>
        <Btn
          type="button"
          className="btn"
          disabled={busyAction !== null}
          loading={busyAction === 'draft'}
          loadingText="Saving draft..."
          onClick={() => save(false)}
        >
          Save draft
        </Btn>
        <Btn
          type="button"
          className="btn primary"
          disabled={busyAction !== null}
          loading={busyAction === 'post'}
          loadingText="Posting to ledger..."
          onClick={() => save(true)}
        >
          Save & post to ledger
        </Btn>
      </div>
    </>
  );
}

