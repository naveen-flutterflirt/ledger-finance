import React, { useState } from 'react';
import { AccountSelect, Field, Modal, Msg, Btn } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { fmtDate, inr2, todayStr } from '../../utils/format.js';

export default function Assets() {
  const { data, reload } = useData<any[]>('/api/assets');
  const { data: lk } = useData<any>('/api/lookups');
  const { data: bills } = useData<any[]>('/api/docs/purchases');

  const [f, setF] = useState<any>(null);
  const [disp, setDisp] = useState<any>(null);
  const [sched, setSched] = useState<any>(null);
  const [period, setPeriod] = useState(todayStr().slice(0, 7));
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { toast } = useToast();

  const run = async (key: string, fn: () => Promise<any>, m: (x: any) => string) => {
    setErr('');
    setOk('');
    setBusyKey(key);
    try {
      const x = await fn();
      const msg = m(x);
      setOk(msg);
      toast.success(msg);
      setF(null);
      setDisp(null);
      reload();
    } catch (e: any) {
      setErr(e.message || 'Operation failed');
      toast.error(e.message || 'Operation failed');
    } finally {
      setBusyKey(null);
    }
  };

  const act = (data ?? []).filter(a => a.status === 'ACTIVE');
  const tot = (k: string) => act.reduce((s, a) => s + (Number(a[k]) || 0), 0);

  return (
    <>
      <div className="topbar">
        <h1>Fixed assets &amp; depreciation</h1>
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          />
          <Btn
            className="btn whitespace-nowrap"
            loading={busyKey === 'depreciate'}
            loadingText="Calculating depreciation..."
            onClick={() =>
              run(
                'depreciate',
                () => apiCall('/api/assets/depreciate', 'POST', { period }),
                x =>
                  x.posted
                    ? `Depreciation of ${inr2(x.total)} posted for ${x.posted} asset(s)`
                    : 'Nothing to depreciate for this month'
              )
            }
          >
            Run depreciation
          </Btn>
          <button
            className="btn primary whitespace-nowrap"
            onClick={() =>
              setF({
                method: 'SLM',
                funding: 'BANK',
                purchase_date: todayStr(),
                salvage_value: 0,
              })
            }
          >
            + Add asset
          </button>
        </div>
      </div>

      <Msg err={f || disp ? '' : err} ok={ok} />

      <div className="grid g4">
        <div className="card kpi">
          <div className="label">Gross block (cost)</div>
          <div className="val">{inr2(tot('cost'))}</div>
        </div>
        <div className="card kpi">
          <div className="label">Accumulated depreciation</div>
          <div className="val">{inr2(tot('accumulated_dep'))}</div>
        </div>
        <div className="card kpi">
          <div className="label">Net block (book value)</div>
          <div className="val">{inr2(tot('book_value'))}</div>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Category</th>
              <th>In use from</th>
              <th>Method</th>
              <th className="num">Cost</th>
              <th className="num">Acc. dep.</th>
              <th className="num">Book value</th>
              <th>Last run</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.map(a => (
              <tr key={a.id} className={a.status === 'DISPOSED' ? 'opacity-55' : ''}>
                <td>
                  <span className="font-semibold">{a.name}</span>
                  <span className="muted mono text-xs ml-1.5">({a.asset_no})</span>
                </td>
                <td>
                  <span>{a.category}</span>
                  <span className="muted text-xs ml-1.5">· {a.asset_account}</span>
                </td>
                <td>{fmtDate(a.put_to_use_date)}</td>
                <td>
                  {a.method === 'SLM'
                    ? `SLM ${a.useful_life_years} yrs`
                    : `WDV ${a.wdv_rate}%`}
                </td>
                <td className="num">{inr2(a.cost)}</td>
                <td className="num">{inr2(a.accumulated_dep)}</td>
                <td className="num">
                  <b>{inr2(a.book_value)}</b>
                </td>
                <td>{a.last_period ? a.last_period.slice(0, 7) : '—'}</td>
                <td>
                  <span className={`badge ${a.status === 'ACTIVE' ? 's-PAID' : 's-CANCELLED'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="whitespace-nowrap">
                  <button
                    className="btn sm"
                    onClick={async () =>
                      setSched(await apiCall(`/api/assets/${a.id}`))
                    }
                  >
                    Schedule
                  </button>{' '}
                  {a.status === 'ACTIVE' && (
                    <button
                      className="btn sm ghost-red"
                      onClick={() =>
                        setDisp({ a, date: todayStr(), sale_amount: 0 })
                      }
                    >
                      Dispose
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {data && !data.length && (
              <tr>
                <td colSpan={10} className="muted text-center p-6">
                  No fixed assets registered
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {f && lk && (
        <Modal title="Add fixed asset" onClose={() => setF(null)}>
          <Msg err={err} />
          <div className="form">
            <Field label="Asset name *">
              <input
                value={f.name ?? ''}
                onChange={e => setF({ ...f, name: e.target.value })}
                placeholder="e.g. Dell Latitude 7450"
              />
            </Field>

            <Field label="Category *">
              <input
                list="cats"
                value={f.category ?? ''}
                onChange={e => setF({ ...f, category: e.target.value })}
                placeholder="Computers, Vehicles, Furniture..."
              />
              <datalist id="cats">
                {['Computers', 'Furniture', 'Vehicles', 'Plant & Machinery', 'Office Equipment', 'Buildings'].map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field label="Asset account *">
              <AccountSelect
                accounts={lk.accounts}
                filter={(a: any) => a.subtype === 'FIXED_ASSET'}
                value={f.asset_account_id}
                onChange={v => setF({ ...f, asset_account_id: Number(v) })}
              />
            </Field>

            <Field label="Cost (excl. GST) *">
              <input
                type="number"
                step="0.01"
                value={f.cost ?? ''}
                onChange={e => setF({ ...f, cost: e.target.value })}
              />
            </Field>

            <Field label="Purchase date">
              <input
                type="date"
                value={f.purchase_date}
                onChange={e => setF({ ...f, purchase_date: e.target.value })}
              />
            </Field>

            <Field label="Put to use date">
              <input
                type="date"
                value={f.put_to_use_date ?? f.purchase_date}
                onChange={e => setF({ ...f, put_to_use_date: e.target.value })}
              />
            </Field>

            <Field label="Depreciation method">
              <select
                value={f.method}
                onChange={e => setF({ ...f, method: e.target.value })}
              >
                <option value="SLM">Straight Line (SLM)</option>
                <option value="WDV">Written-Down Value (WDV)</option>
              </select>
            </Field>

            {f.method === 'SLM' ? (
              <Field label="Useful life (years)">
                <input
                  type="number"
                  step="0.5"
                  value={f.useful_life_years ?? ''}
                  onChange={e => setF({ ...f, useful_life_years: e.target.value })}
                />
              </Field>
            ) : (
              <Field label="WDV rate % per year">
                <input
                  type="number"
                  step="0.01"
                  value={f.wdv_rate ?? ''}
                  onChange={e => setF({ ...f, wdv_rate: e.target.value })}
                />
              </Field>
            )}

            <Field label="Salvage value">
              <input
                type="number"
                step="0.01"
                value={f.salvage_value}
                onChange={e => setF({ ...f, salvage_value: e.target.value })}
              />
            </Field>

            <Field label="Funding method">
              <select
                value={f.funding}
                onChange={e => setF({ ...f, funding: e.target.value })}
              >
                <option value="BANK">Paid from bank/cash now</option>
                <option value="BILL">Already recorded on a purchase bill</option>
                <option value="OPENING">Opening balance (pre-existing asset)</option>
              </select>
            </Field>

            {f.funding === 'BANK' && (
              <Field label="Paid from account">
                <AccountSelect
                  accounts={lk.accounts}
                  filter={(a: any) => ['BANK', 'CASH'].includes(a.subtype)}
                  value={f.paid_from_account_id}
                  onChange={v => setF({ ...f, paid_from_account_id: Number(v) })}
                />
              </Field>
            )}

            {f.funding === 'BILL' && (
              <Field label="Purchase bill">
                <select
                  value={f.bill_id ?? ''}
                  onChange={e => setF({ ...f, bill_id: e.target.value })}
                >
                  <option value="">— select bill —</option>
                  {(bills ?? [])
                    .filter(b => b.status !== 'CANCELLED' && b.status !== 'DRAFT')
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {b.doc_no} · {b.party_name} · {inr2(b.taxable_value)}
                      </option>
                    ))}
                </select>
              </Field>
            )}

            {f.funding === 'OPENING' && (
              <>
                <Field label="Opening date">
                  <input
                    type="date"
                    value={f.opening_date ?? ''}
                    onChange={e => setF({ ...f, opening_date: e.target.value })}
                  />
                </Field>
                <Field label="Depreciation already charged">
                  <input
                    type="number"
                    step="0.01"
                    value={f.opening_acc_dep ?? ''}
                    onChange={e => setF({ ...f, opening_acc_dep: e.target.value })}
                  />
                </Field>
              </>
            )}
          </div>

          <div className="row justify-end mt-5">
            <Btn
              className="btn primary"
              loading={busyKey === 'save_asset'}
              loadingText="Saving asset..."
              onClick={() =>
                run(
                  'save_asset',
                  () =>
                    apiCall('/api/assets', 'POST', {
                      ...f,
                      cost: Number(f.cost),
                      salvage_value: Number(f.salvage_value || 0),
                      opening_acc_dep: Number(f.opening_acc_dep || 0),
                    }),
                  x => `Asset ${x.asset_no} added successfully`
                )
              }
            >
              Save asset
            </Btn>
          </div>
        </Modal>
      )}

      {disp && (
        <Modal title={`Dispose asset · ${disp.a.name}`} onClose={() => setDisp(null)}>
          <p className="muted">
            Book value is {inr2(disp.a.book_value)}. The system will automatically calculate and post
            any Gain or Loss on disposal.
          </p>
          <div className="form">
            <Field label="Disposal date">
              <input
                type="date"
                value={disp.date}
                onChange={e => setDisp({ ...disp, date: e.target.value })}
              />
            </Field>

            <Field label="Sale proceeds (0 if scrapped)">
              <input
                type="number"
                step="0.01"
                value={disp.sale_amount}
                onChange={e => setDisp({ ...disp, sale_amount: e.target.value })}
              />
            </Field>

            <Field label="Received into bank/cash">
              <AccountSelect
                accounts={lk?.accounts ?? []}
                filter={(a: any) => ['BANK', 'CASH'].includes(a.subtype)}
                value={disp.account_id}
                onChange={v => setDisp({ ...disp, account_id: Number(v) })}
              />
            </Field>
          </div>

          <div className="row justify-end mt-5">
            <Btn
              className="btn red"
              loading={busyKey === 'dispose_asset'}
              loadingText="Disposing..."
              onClick={() =>
                run(
                  'dispose_asset',
                  () =>
                    apiCall(`/api/assets/${disp.a.id}/dispose`, 'POST', {
                      date: disp.date,
                      sale_amount: Number(disp.sale_amount),
                      account_id: disp.account_id,
                    }),
                  x => `Disposed: ${x.gain >= 0 ? 'gain' : 'loss'} ${inr2(Math.abs(x.gain))}`
                )
              }
            >
              Confirm disposal
            </Btn>
          </div>
        </Modal>
      )}

      {sched && (
        <Modal title={`Depreciation schedule · ${sched.name}`} onClose={() => setSched(null)}>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th className="num">Charge</th>
                <th className="num">Accumulated</th>
                <th className="num">Book value</th>
              </tr>
            </thead>
            <tbody>
              {sched.entries
                ?.reduce((acc: any[], e: any) => {
                  const prev = acc.length ? acc[acc.length - 1].acc : 0;
                  acc.push({ ...e, acc: prev + e.amount });
                  return acc;
                }, [])
                .map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.period.slice(0, 7)}</td>
                    <td className="num">{inr2(e.amount)}</td>
                    <td className="num">{inr2(e.acc)}</td>
                    <td className="num">{inr2(sched.cost - e.acc)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}

