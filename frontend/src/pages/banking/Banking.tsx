import React, { useEffect, useState } from 'react';
import { AccountSelect, Field, Modal, Msg, Btn } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { fmtDate, inr2, todayStr } from '../../utils/format.js';
import { Upload, Sparkles, CheckCircle2, AlertCircle, FileText, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

function parseCsv(text: string) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map(l => {
      const out: string[] = [];
      let cur = '';
      let q = false;
      for (const ch of l) {
        if (ch === '"') q = !q;
        else if (ch === ',' && !q) {
          out.push(cur.trim());
          cur = '';
        } else cur += ch;
      }
      out.push(cur.trim());
      return out;
    });

  const hi = rows.findIndex(
    r =>
      r.some(c => /date/i.test(c)) &&
      r.some(c => /(withdraw|debit|deposit|credit|amount)/i.test(c))
  );

  if (hi < 0) throw new Error('Could not find header row with Date and Debit/Credit columns');

  const h = rows[hi].map(c => c.toLowerCase());
  const col = (re: RegExp) => h.findIndex(c => re.test(c));
  const iD = col(/date/);
  const iDesc = col(/(narration|description|particular|details|remarks)/);
  const iRef = col(/(ref|chq|cheque|utr)/);
  const iW = col(/(withdraw|debit|dr)/);
  const iDep = col(/(deposit|credit|cr)/);
  const iB = col(/balance/);

  const num = (s?: string) =>
    Number((s ?? '').replace(/[₹,\s]/g, '').replace(/^\((.*)\)$/, '-$1')) || 0;

  const dt = (s: string) => {
    const m = s.match(/^(\d{1,2})[-/.](\d{1,2}|[A-Za-z]{3})[-/.](\d{2,4})$/);
    if (m) {
      const mon = isNaN(+m[2])
        ? 'janfebmaraprmayjunjulaugsepoctnovdec'.indexOf(m[2].toLowerCase()) / 3 + 1
        : +m[2];
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return `${y}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
  };

  return rows
    .slice(hi + 1)
    .filter(r => r[iD] && dt(r[iD]))
    .map(r => ({
      txn_date: dt(r[iD]),
      description: r[iDesc] || '—',
      reference: iRef >= 0 ? r[iRef] : null,
      withdrawal: Math.abs(num(r[iW])),
      deposit: Math.abs(num(r[iDep])),
      balance: iB >= 0 ? num(r[iB]) : null,
    }))
    .filter(r => (r.withdrawal > 0) !== (r.deposit > 0));
}

export default function Banking() {
  const { data: lk } = useData<any>('/api/lookups');
  const banks = (lk?.accounts ?? []).filter((a: any) => a.subtype === 'BANK');

  const [bank, setBank] = useState<number | null>(null);
  const [asOf, setAsOf] = useState(todayStr());

  useEffect(() => {
    if (banks[0] && !bank) setBank(banks[0].id);
  }, [banks, bank]);

  const { data: r, reload } = useData<any>(
    bank ? `/api/bank/reconcile?bank_account_id=${bank}&as_of=${asOf}` : null
  );

  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [show, setShow] = useState<'unmatched' | 'all'>('unmatched');
  const { toast } = useToast();

  const [pick, setPick] = useState<any>(null);
  const [cands, setCands] = useState<any[]>([]);
  const [book, setBook] = useState<any>(null);

  const run = async (key: string, fn: () => Promise<any>, m: (x: any) => string) => {
    setErr('');
    setOk('');
    setBusyKey(key);
    try {
      const x = await fn();
      const msg = m(x);
      setOk(msg);
      toast.success(msg);
      reload();
    } catch (e: any) {
      setErr(e.message || 'Operation failed');
      toast.error(e.message || 'Operation failed');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <>
      <div className="topbar flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200">
        <div>
          <h1 className="m-0 leading-tight">Bank reconciliation</h1>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Auto-match and reconcile general ledger bank accounts against imported statements.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <select
            value={bank ?? ''}
            onChange={e => setBank(Number(e.target.value))}
            className="text-sm font-medium"
            title="Select bank account"
          >
            {banks.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={asOf}
            onChange={e => setAsOf(e.target.value)}
            className="text-sm font-medium"
            title="Reconciliation as-of date"
          />

          <label className="btn m-0 cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 text-xs font-semibold">
            <Upload size={14} />
            <span>Import CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async e => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const rows = parseCsv(await f.text());
                  await run(
                    'import_csv',
                    () =>
                      apiCall('/api/bank/import', 'POST', {
                        bank_account_id: bank,
                        rows,
                      }),
                    (x: any) =>
                      `Imported ${x.inserted} lines (${x.skipped} duplicates skipped)`
                  );
                } catch (x: any) {
                  const msg = x.message || 'CSV Import failed';
                  setErr(msg);
                  toast.error(msg);
                }
                e.target.value = '';
              }}
            />
          </label>

          <Btn
            className="btn primary whitespace-nowrap inline-flex items-center gap-1.5 text-xs font-semibold"
            loading={busyKey === 'automatch'}
            loadingText="Auto-matching..."
            onClick={() =>
              run(
                'automatch',
                () => apiCall('/api/bank/automatch', 'POST', { bank_account_id: bank }),
                (x: any) => `Auto-matched ${x.matched}; ${x.remaining} left to review`
              )
            }
          >
            <Sparkles size={14} />
            <span>Auto-match</span>
          </Btn>
        </div>
      </div>

      <Msg err={err} ok={ok} />

      {r && (
        <>
          {/* Top 2 Cards: Grid with responsive collapse */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4.5 mb-6 min-w-0 w-full">
            {/* Left Card: Reconciliation Summary Statement */}
            <div className="card p-0 overflow-hidden min-w-0 shadow-sm border border-slate-200/90 rounded-xl bg-white flex flex-col">
              <div className="p-3.5 px-4 border-b border-slate-100 bg-slate-50/80">
                <h3 className="m-0 text-sm font-bold text-slate-800">
                  Reconciliation statement as of {fmtDate(r.as_of)}
                </h3>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-800 whitespace-normal">
                        Balance as per books
                      </td>
                      <td className="py-2.5 px-4 num font-bold text-slate-900 whitespace-nowrap">
                        {inr2(r.book_balance)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors text-slate-600">
                      <td className="py-2 px-4 pl-7 text-xs whitespace-normal">
                        Less: deposits recorded, not yet credited by bank
                      </td>
                      <td className="py-2 px-4 num text-xs whitespace-nowrap text-slate-600">
                        ({inr2(r.not_in_bank.deposits)})
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors text-slate-600">
                      <td className="py-2 px-4 pl-7 text-xs whitespace-normal">
                        Add: cheques/payments issued, not yet presented
                      </td>
                      <td className="py-2 px-4 num text-xs whitespace-nowrap text-slate-600">
                        {inr2(r.not_in_bank.payments)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors text-slate-600">
                      <td className="py-2 px-4 pl-7 text-xs whitespace-normal">
                        Add: credits in bank, not in books
                      </td>
                      <td className="py-2 px-4 num text-xs whitespace-nowrap text-slate-600">
                        {inr2(r.not_in_books.deposits)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors text-slate-600">
                      <td className="py-2 px-4 pl-7 text-xs whitespace-normal">
                        Less: debits in bank (charges, etc.), not in books
                      </td>
                      <td className="py-2 px-4 num text-xs whitespace-nowrap text-slate-600">
                        ({inr2(r.not_in_books.withdrawals)})
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-bold border-t border-b border-slate-200">
                      <td className="py-2.5 px-4 text-slate-900 whitespace-normal">
                        Adjusted book balance
                      </td>
                      <td className="py-2.5 px-4 num font-bold text-slate-900 whitespace-nowrap">
                        {inr2(r.adjusted_book_balance)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-800 whitespace-normal">
                        Balance as per bank statement
                      </td>
                      <td className="py-2.5 px-4 num font-bold text-slate-900 whitespace-nowrap">
                        {r.statement_balance == null ? '—' : inr2(r.statement_balance)}
                      </td>
                    </tr>
                    <tr className={r.difference === 0 ? 'bg-emerald-50/70' : 'bg-rose-50/70'}>
                      <td className="py-2.5 px-4 font-bold text-slate-900 whitespace-normal">
                        Difference
                      </td>
                      <td className="py-2.5 px-4 num font-bold whitespace-nowrap">
                        {r.difference == null ? (
                          <span className="text-slate-400 text-xs">Import statement to verify</span>
                        ) : r.difference === 0 ? (
                          <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                            ✔ 0.00 (Reconciled)
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold">{inr2(r.difference)}</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Card: Ledger Items Not on the Statement */}
            <div className="card p-0 overflow-hidden min-w-0 shadow-sm border border-slate-200/90 rounded-xl bg-white flex flex-col">
              <div className="p-3.5 px-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                <h3 className="m-0 text-sm font-bold text-slate-800">
                  Ledger items not on the statement ({r.unmatched_book.length})
                </h3>
                {r.unmatched_book.length > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {r.unmatched_book.length} to clear
                  </span>
                )}
              </div>
              <div className="overflow-x-auto w-full max-w-full">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2 px-3 whitespace-nowrap">Date</th>
                      <th className="py-2 px-2.5 whitespace-nowrap">Entry</th>
                      <th className="py-2 px-3 whitespace-nowrap">Narration</th>
                      <th className="py-2 px-3 num whitespace-nowrap">Dr</th>
                      <th className="py-2 px-3 num whitespace-nowrap">Cr</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.unmatched_book.slice(0, 10).map((b: any) => (
                      <tr key={b.line_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                          {fmtDate(b.entry_date)}
                        </td>
                        <td className="py-2 px-2.5 mono font-semibold text-slate-800 whitespace-nowrap">
                          {b.entry_no}
                        </td>
                        <td
                          className="py-2 px-3 max-w-[150px] sm:max-w-[200px] truncate text-slate-700"
                          title={b.party ?? b.narration}
                        >
                          {b.party ?? b.narration}
                        </td>
                        <td className="py-2 px-3 num whitespace-nowrap text-slate-900 font-medium">
                          {b.debit ? inr2(b.debit) : '—'}
                        </td>
                        <td className="py-2 px-3 num whitespace-nowrap text-slate-900 font-medium">
                          {b.credit ? inr2(b.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                    {!r.unmatched_book.length && (
                      <tr>
                        <td colSpan={5} className="muted text-center py-8 text-sm">
                          ✨ Every ledger item is accounted for on the statement.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom Card: Bank Statement Table */}
          <div className="card p-0 overflow-hidden min-w-0 shadow-sm border border-slate-200/90 rounded-xl bg-white w-full max-w-full">
            <div className="flex items-center justify-between flex-wrap gap-2.5 p-3.5 px-4 border-b border-slate-100 bg-slate-50/60">
              <h3 className="m-0 text-sm font-bold text-slate-800">
                Bank statement · {r.matched} matched, {r.unmatched} to review
              </h3>
              <div className="tabs flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg">
                <button
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    show === 'unmatched'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  onClick={() => setShow('unmatched')}
                >
                  To review ({r.unmatched})
                </button>
                <button
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    show === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  onClick={() => setShow('all')}
                >
                  All statement lines
                </button>
              </div>
            </div>

            <div className="overflow-x-auto w-full max-w-full">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Description</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Reference</th>
                    <th className="py-2.5 px-3 num whitespace-nowrap">Withdrawal</th>
                    <th className="py-2.5 px-3 num whitespace-nowrap">Deposit</th>
                    <th className="py-2.5 px-3 num whitespace-nowrap">Balance</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Matched With</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.statement
                    .filter((s: any) => show === 'all' || !s.matched_line_id)
                    .map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600">
                          {fmtDate(s.txn_date)}
                        </td>
                        <td
                          className="py-2.5 px-3 max-w-[180px] sm:max-w-[280px] truncate text-slate-800 font-medium"
                          title={s.description}
                        >
                          {s.description}
                        </td>
                        <td className="py-2.5 px-3 mono text-xs text-slate-500 whitespace-nowrap">
                          {s.reference ?? '—'}
                        </td>
                        <td className="py-2.5 px-3 num out font-medium text-rose-600 whitespace-nowrap">
                          {s.withdrawal ? inr2(s.withdrawal) : '—'}
                        </td>
                        <td className="py-2.5 px-3 num in font-medium text-emerald-600 whitespace-nowrap">
                          {s.deposit ? inr2(s.deposit) : '—'}
                        </td>
                        <td className="py-2.5 px-3 num font-semibold text-slate-800 whitespace-nowrap">
                          {s.balance != null ? inr2(s.balance) : '—'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {s.matched_line_id ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded text-xs">
                              ✔ {s.entry_no}
                            </span>
                          ) : (
                            <span className="badge s-SUBMITTED text-xs">unmatched</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          {s.matched_line_id ? (
                            <Btn
                              className="btn sm ghost-red px-2.5 py-1 text-xs"
                              loading={busyKey === `unmatch_${s.id}`}
                              loadingText="Unmatching..."
                              onClick={() =>
                                run(
                                  `unmatch_${s.id}`,
                                  () =>
                                    apiCall(`/api/bank/statement/${s.id}/match`, 'POST', {
                                      line_id: null,
                                    }),
                                  () => 'Transaction unmatched from ledger'
                                )
                              }
                            >
                              Unmatch
                            </Btn>
                          ) : (
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                className="btn sm primary px-2.5 py-1 text-xs font-semibold"
                                onClick={async () => {
                                  setPick(s);
                                  setCands(
                                    await apiCall(
                                      `/api/bank/statement/${s.id}/candidates`
                                    )
                                  );
                                }}
                              >
                                Match…
                              </button>
                              <button
                                className="btn sm green px-2.5 py-1 text-xs font-semibold"
                                onClick={() =>
                                  setBook({
                                    s,
                                    account_id: '',
                                    narration: s.description,
                                  })
                                }
                              >
                                Book it
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  {r.statement.filter((s: any) => show === 'all' || !s.matched_line_id).length === 0 && (
                    <tr>
                      <td colSpan={8} className="muted text-center py-10 text-sm">
                        🎉 No statement lines {show === 'unmatched' ? 'pending review' : 'found'}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Match Candidates Modal */}
      {pick && (
        <Modal
          title={`Match ${inr2(pick.deposit || pick.withdrawal)} · ${fmtDate(pick.txn_date)}`}
          onClose={() => setPick(null)}
        >
          <p className="muted text-xs mb-3">
            Unmatched ledger transactions on this bank matching this exact amount:
          </p>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <tbody className="divide-y divide-slate-100">
                {cands.map(c => (
                  <tr key={c.line_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">{fmtDate(c.entry_date)}</td>
                    <td className="py-2.5 px-3 mono font-semibold text-slate-800 whitespace-nowrap">{c.entry_no}</td>
                    <td className="py-2.5 px-3 max-w-[220px] truncate text-slate-700">{c.party ?? c.narration}</td>
                    <td className="py-2.5 px-3 text-right">
                      <Btn
                        className="btn sm primary px-3 py-1 text-xs"
                        loading={busyKey === `match_${c.line_id}`}
                        loadingText="Matching..."
                        onClick={async () => {
                          await run(
                            `match_${c.line_id}`,
                            () =>
                              apiCall(`/api/bank/statement/${pick.id}/match`, 'POST', {
                                line_id: c.line_id,
                              }),
                            () => 'Matched successfully'
                          );
                          setPick(null);
                        }}
                      >
                        Match
                      </Btn>
                    </td>
                  </tr>
                ))}
                {!cands.length && (
                  <tr>
                    <td colSpan={4} className="muted text-center py-8 text-sm">
                      No candidates found within ±5 days. Use “Book it” to record it directly into your ledger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Book It Modal */}
      {book && lk && (
        <Modal title="Record bank statement line into books" onClose={() => setBook(null)}>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 mb-4 leading-relaxed">
            <strong>{book.s.description}</strong> ·{' '}
            <span className="font-semibold text-slate-900">
              {book.s.withdrawal ? `Withdrawal ${inr2(book.s.withdrawal)}` : `Deposit ${inr2(book.s.deposit)}`}
            </span>
            <div className="text-slate-500 mt-1">
              Automatically generates a balanced ledger journal and marks the bank transaction reconciled.
            </div>
          </div>
          <div className="form">
            <Field label="Target account (e.g. Bank charges, Interest income) *">
              <AccountSelect
                accounts={lk.accounts}
                filter={(a: any) => a.id !== bank}
                value={book.account_id}
                onChange={v => setBook({ ...book, account_id: v })}
              />
            </Field>

            <Field label="Narration *" wide>
              <input
                value={book.narration}
                onChange={e => setBook({ ...book, narration: e.target.value })}
                required
              />
            </Field>
          </div>
          <div className="row justify-end mt-5 gap-2">
            <button type="button" className="btn" onClick={() => setBook(null)}>
              Cancel
            </button>
            <Btn
              className="btn green px-4 py-1.5 text-xs font-semibold"
              disabled={!book.account_id}
              loading={busyKey === 'book_and_match'}
              loadingText="Booking & matching..."
              onClick={async () => {
                await run(
                  'book_and_match',
                  () =>
                    apiCall(`/api/bank/statement/${book.s.id}/create`, 'POST', {
                      account_id: Number(book.account_id),
                      narration: book.narration,
                    }),
                  () => 'Booked and reconciled in books'
                );
                setBook(null);
              }}
            >
              Book &amp; Match
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
