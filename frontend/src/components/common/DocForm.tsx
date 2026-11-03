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
      <div className="card p-5 mb-5 shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label={`${meta.party === 'CUSTOMER' ? 'Customer' : 'Vendor'} *`}>
            <select
              value={h.party_id ?? ''}
              onChange={e => setH({ ...h, party_id: Number(e.target.value) })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
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
                placeholder="e.g. INV-9842"
                onChange={e => setH({ ...h, doc_no: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
              />
            </Field>
          )}

          <Field label="Date *">
            <input
              type="date"
              value={h.doc_date}
              onChange={e => setH({ ...h, doc_date: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </Field>

          {!meta.againstKind && (
            <Field label="Due date">
              <input
                type="date"
                value={h.due_date ?? ''}
                onChange={e => setH({ ...h, due_date: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
              />
            </Field>
          )}

          <Field label="Place of supply (GST State)">
            <select
              value={h.place_of_supply ?? ''}
              onChange={e => setH({ ...h, place_of_supply: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
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
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
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
        </div>

        {(kind === 'purchases' || (!meta.againstKind && !initial?.id) || h.place_of_supply) && (
          <div className="flex flex-wrap items-center gap-6 pt-3 mt-2 border-t border-slate-100">
            {kind === 'purchases' && (
              <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  checked={h.reverse_charge}
                  onChange={e => setH({ ...h, reverse_charge: e.target.checked })}
                />
                <span>Reverse charge (RCM)</span>
              </label>
            )}

            {!meta.againstKind && !initial?.id && (
              <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  checked={h.is_opening}
                  onChange={e => setH({ ...h, is_opening: e.target.checked })}
                />
                <span>Opening balance (no GST)</span>
              </label>
            )}

            {h.place_of_supply && (
              <span className="text-xs text-slate-500 ml-auto bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                {calc.inter ? 'Inter-state supply → IGST' : 'Intra-state supply → CGST + SGST'}
                {h.is_opening ? ' (not applied to opening balances)' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="card p-0 overflow-x-auto mb-5 shadow-sm border border-slate-200">
        <table>
          <thead>
            <tr>
              <th className="min-w-[180px]">Item</th>
              <th className="min-w-[200px]">Description</th>
              <th className="min-w-[100px]">HSN/SAC</th>
              <th className="min-w-[80px]">Qty</th>
              <th className="min-w-[110px]">Rate</th>
              <th className="min-w-[95px]">Disc.</th>
              <th className="min-w-[95px]">GST %</th>
              <th className="min-w-[210px]">Account</th>
              <th className="min-w-[110px] num">Amount</th>
              <th className="w-10" />
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
                    placeholder="Line description"
                    onChange={e => upd(i, { description: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={l.hsn_sac ?? ''}
                    placeholder="HSN/SAC"
                    onChange={e => upd(i, { hsn_sac: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="any"
                    value={l.qty}
                    onChange={e => upd(i, { qty: e.target.value })}
                    className="tabular-nums"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={l.rate}
                    onChange={e => upd(i, { rate: e.target.value })}
                    className="tabular-nums"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={l.discount ?? ''}
                    onChange={e => upd(i, { discount: e.target.value })}
                    className="tabular-nums"
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
                <td className="num font-bold text-slate-900">
                  {inr2(
                    Number(l.qty || 0) * Number(l.rate || 0) - Number(l.discount || 0)
                  )}
                </td>
                <td className="text-center">
                  <button
                    type="button"
                    className="btn sm ghost-red"
                    onClick={() => setLines(lines.filter((_, j) => j !== i))}
                    disabled={lines.length === 1}
                    title="Remove item"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4 border-t border-slate-200 bg-slate-50/70">
          <button
            type="button"
            className="btn bg-white border border-slate-300 text-indigo-600 hover:bg-slate-50 font-semibold px-4 py-2 rounded-lg text-sm shadow-sm"
            onClick={() =>
              setLines([
                ...lines,
                { description: '', qty: 1, rate: '', gst_rate: 18, account_id: '' },
              ])
            }
          >
            + Add line item
          </button>

          <div className="w-full sm:w-80 bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Taxable value</span>
              <span className="font-semibold text-slate-800">{inr2(calc.taxable)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>{calc.inter ? 'IGST' : 'CGST + SGST'}</span>
              <span className="font-semibold text-slate-800">{inr2(calc.tax)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Round off</span>
              <span className="font-semibold text-slate-800">{inr2(calc.round)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-navy pt-2 border-t border-slate-200">
              <span>Grand Total</span>
              <span className="text-indigo-600 font-extrabold">{inr2(calc.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-5 border border-slate-200 shadow-sm">
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          Notes / Terms
        </label>
        <input
          value={h.notes ?? ''}
          placeholder="Add payment terms, supplier notes, or internal remarks..."
          onChange={e => setH({ ...h, notes: e.target.value })}
          className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 pb-6">
        <Btn
          type="button"
          className="btn bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold px-5 py-2.5 rounded-lg shadow-sm"
          disabled={busyAction !== null}
          loading={busyAction === 'draft'}
          loadingText="Saving draft..."
          onClick={() => save(false)}
        >
          Save draft
        </Btn>
        <Btn
          type="button"
          className="btn primary font-semibold px-6 py-2.5 rounded-lg shadow-sm"
          disabled={busyAction !== null}
          loading={busyAction === 'post'}
          loadingText="Posting to ledger..."
          onClick={() => save(true)}
        >
          Save &amp; post to ledger
        </Btn>
      </div>
    </>
  );
}

