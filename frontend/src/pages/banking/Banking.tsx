import React, { useEffect, useState } from 'react';
import { AccountSelect, Field, Modal, Msg, Btn } from '../../components/common/ui.js';
import { apiCall, useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { fmtDate, inr2, todayStr } from '../../utils/format.js';

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
      <div className="topbar">
        <h1>Bank reconciliation</h1>
        <div className="row">
          <select
            value={bank ?? ''}
            onChange={e => setBank(Number(e.target.value))}
            style={{ width: 240 }}
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
            style={{ width: 160 }}
          />

          <label className="btn" style={{ margin: 0 }}>
            ⬆ Import CSV statement
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
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
            className="btn primary"
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
            Auto-match
          </Btn>
        </div>
      </div>

      <Msg err={err} ok={ok} />

      {r && (
        <>
          <div className="grid g2">
            <div className="card">
              <h3>Reconciliation statement as of {fmtDate(r.as_of)}</h3>
              <table>
                <tbody>
                  <tr>
                    <td>Balance as per books</td>
                    <td className="num">
                      <b>{inr2(r.book_balance)}</b>
                    </td>
                  </tr>
                  <tr className="sub">
                    <td className="indent">Less: deposits recorded, not yet credited by bank</td>
                    <td className="num">({inr2(r.not_in_bank.deposits)})</td>
                  </tr>
                  <tr className="sub">
                    <td className="indent">Add: cheques/payments issued, not yet presented</td>
                    <td className="num">{inr2(r.not_in_bank.payments)}</td>
                  </tr>
                  <tr className="sub">
                    <td className="indent">Add: credits in bank, not in books</td>
                    <td className="num">{inr2(r.not_in_books.deposits)}</td>
                  </tr>
                  <tr className="sub">
                    <td className="indent">Less: debits in bank (charges, etc.), not in books</td>
                    <td className="num">({inr2(r.not_in_books.withdrawals)})</td>
                  </tr>
                  <tr className="tot">
                    <td>Adjusted book balance</td>
                    <td className="num">{inr2(r.adjusted_book_balance)}</td>
                  </tr>
                  <tr>
                    <td>Balance as per bank statement</td>
                    <td className="num">
                      <b>{r.statement_balance == null ? '—' : inr2(r.statement_balance)}</b>
                    </td>
                  </tr>
                  <tr>
                    <td>Difference</td>
                    <td className={`num ${r.difference === 0 ? 'check' : 'cross'}`}>
                      {r.difference == null
                        ? 'import statement to verify'
                        : r.difference === 0
                        ? '✔ 0.00 (Reconciled)'
                        : inr2(r.difference)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>Ledger items not on the statement ({r.unmatched_book.length})</h3>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Entry</th>
                    <th>Narration</th>
                    <th className="num">Dr</th>
                    <th className="num">Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {r.unmatched_book.slice(0, 10).map((b: any) => (
                    <tr key={b.line_id}>
                      <td>{fmtDate(b.entry_date)}</td>
                      <td className="mono">{b.entry_no}</td>
                      <td>{b.party ?? b.narration}</td>
                      <td className="num">{b.debit ? inr2(b.debit) : ''}</td>
                      <td className="num">{b.credit ? inr2(b.credit) : ''}</td>
                    </tr>
                  ))}
                  {!r.unmatched_book.length && (
                    <tr>
                      <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '16px' }}>
                        Every ledger item is accounted for on the statement
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="row" style={{ padding: 14 }}>
              <h3 style={{ margin: 0 }}>
                Bank statement · {r.matched} matched, {r.unmatched} to review
              </h3>
              <div className="spacer" />
              <div className="tabs">
                <button
                  className={show === 'unmatched' ? 'on' : ''}
                  onClick={() => setShow('unmatched')}
                >
                  To review ({r.unmatched})
                </button>
                <button
                  className={show === 'all' ? 'on' : ''}
                  onClick={() => setShow('all')}
                >
                  All statement lines
                </button>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th className="num">Withdrawal</th>
                  <th className="num">Deposit</th>
                  <th className="num">Balance</th>
                  <th>Matched with</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {r.statement
                  .filter((s: any) => show === 'all' || !s.matched_line_id)
                  .map((s: any) => (
                    <tr key={s.id}>
                      <td>{fmtDate(s.txn_date)}</td>
                      <td>{s.description}</td>
                      <td className="mono">{s.reference ?? '—'}</td>
                      <td className="num out">{s.withdrawal ? inr2(s.withdrawal) : ''}</td>
                      <td className="num in">{s.deposit ? inr2(s.deposit) : ''}</td>
                      <td className="num">{s.balance != null ? inr2(s.balance) : ''}</td>
                      <td>
                        {s.matched_line_id ? (
                          <span className="check">✔ {s.entry_no}</span>
                        ) : (
                          <span className="badge s-SUBMITTED">unmatched</span>
                        )}
                      </td>
                      <td className="right" style={{ whiteSpace: 'nowrap' }}>
                        {s.matched_line_id ? (
                          <Btn
                            className="btn sm"
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
                          <>
                            <button
                              className="btn sm"
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
                            </button>{' '}
                            <button
                              className="btn sm green"
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
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pick && (
        <Modal
          title={`Match ${inr2(pick.deposit || pick.withdrawal)} · ${fmtDate(pick.txn_date)}`}
          onClose={() => setPick(null)}
        >
          <p className="muted">
            Unmatched ledger transactions on this bank matching this exact amount:
          </p>
          <table>
            <tbody>
              {cands.map(c => (
                <tr key={c.line_id}>
                  <td>{fmtDate(c.entry_date)}</td>
                  <td className="mono">{c.entry_no}</td>
                  <td>{c.party ?? c.narration}</td>
                  <td>
                    <Btn
                      className="btn sm primary"
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
                  <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '16px' }}>
                    No candidates found within ±5 days. Use “Book it” to record it.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Modal>
      )}

      {book && lk && (
        <Modal title="Record bank statement line into books" onClose={() => setBook(null)}>
          <p className="muted">
            {book.s.description} ·{' '}
            {book.s.withdrawal ? `withdrawal ${inr2(book.s.withdrawal)}` : `deposit ${inr2(book.s.deposit)}`}
            . Automatically generates a balanced journal and marks it reconciled.
          </p>
          <div className="form">
            <Field label="Target account (e.g. Bank charges, Interest income)">
              <AccountSelect
                accounts={lk.accounts}
                filter={(a: any) => a.id !== bank}
                value={book.account_id}
                onChange={v => setBook({ ...book, account_id: v })}
              />
            </Field>

            <Field label="Narration" wide>
              <input
                value={book.narration}
                onChange={e => setBook({ ...book, narration: e.target.value })}
              />
            </Field>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <Btn
              className="btn green"
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
              Book &amp; match
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

