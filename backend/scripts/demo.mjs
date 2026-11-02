// Seeds 7 months of realistic activity through the REST API (same path as the apps) and verifies the books.
// Usage: API=http://localhost:3000 node scripts/demo.mjs
const API = process.env.API ?? 'http://localhost:5000';
let token = '';
async function call(path, method = 'GET', body) {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${d.error}`);
  return d;
}
const expectFail = async (p, m, b, re) => { try { await call(p, m, b); throw new Error('expected failure: ' + p); } catch (e) { if (!re.test(e.message)) throw e; console.log('  ✓ rejected:', e.message.split('→ ')[1]); } };
const login = async (email) => { token = (await call('/api/auth/login', 'POST', { email, password: 'Admin@123', company_id: 1 })).token; };
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); };

await login('accounts@fin.local');
const lk = await call('/api/lookups');
const A = code => lk.accounts.find(a => a.code === code).id;
const P = name => lk.parties.find(p => p.name.startsWith(name)).id;
const I = name => lk.items.find(i => i.name.startsWith(name));
const BANK = A('1110'), PAYBANK = A('1111'), CASH = A('1100');
const line = (item, qty, rate) => ({ item_id: item.id, description: item.name, hsn_sac: item.hsn_sac, qty, rate: rate ?? (item.income_account_id ? item.sale_price : item.purchase_price), gst_rate: item.gst_rate,
  account_id: item.income_account_id ?? item.expense_account_id });

console.log('Opening balances 01-Apr-2026');
try {
  await call('/api/journals', 'POST', { date: '2026-04-01', source: 'OPENING', narration: 'Opening balances as on 1 April 2026', lines: [
    { account_id: BANK, debit: 1800000 }, { account_id: PAYBANK, debit: 200000 }, { account_id: CASH, debit: 25000 },
    { account_id: A('3100'), credit: 1000000 }, { account_id: A('2400'), credit: 400000 }] });
  await call('/api/docs/sales', 'POST', { doc_date: '2026-03-25', due_date: '2026-04-24', party_id: P('Acme'), place_of_supply: '27', is_opening: true, post: true,
    lines: [{ description: 'Opening balance – Mar-26 invoice', qty: 1, rate: 236000, gst_rate: 0, account_id: A('4110') }] });
  await call('/api/docs/purchases', 'POST', { doc_no: 'AWS-OB-0326', doc_date: '2026-03-28', party_id: P('Amazon'), place_of_supply: '27', is_opening: true, post: true,
    lines: [{ description: 'Opening balance – Mar-26 bill', qty: 1, rate: 44840, gst_rate: 0, account_id: A('5110') }] });
  await call('/api/assets', 'POST', { name: 'Office furniture – Indore', category: 'Furniture', asset_account_id: A('1500'), purchase_date: '2023-04-10', put_to_use_date: '2023-04-10',
    cost: 300000, salvage_value: 15000, method: 'SLM', useful_life_years: 10, funding: 'OPENING', opening_date: '2026-04-01', opening_acc_dep: 85500 });
} catch (e) {
  console.log('  Opening balances already recorded, proceeding to monthly transactions.');
}

const months = ['04', '05', '06', '07', '08', '09', '10'];
const invoices = {};
for (const m of months) {
  const d = n => `2026-${m}-${String(n).padStart(2, '0')}`;
  const nm = m === '12' ? '2027-01' : `2026-${String(+m + 1).padStart(2, '0')}`;

  const existingBills = await call(`/api/docs/purchases?party_id=${P('Amazon')}`);
  if (existingBills && existingBills.some(b => b.doc_no === `AWS-${m}26`)) {
    console.log('Month 2026-' + m + ' already recorded, skipping.');
    continue;
  }

  console.log('Month 2026-' + m);
  // Sales
  const hrs = 160 + (+m % 3) * 20;
  const acme = await call('/api/docs/sales', 'POST', { doc_date: d(3), party_id: P('Acme'), place_of_supply: '27', post: true, lines: [line(I('Custom'), hrs)] });
  const globex = await call('/api/docs/sales', 'POST', { doc_date: d(5), party_id: P('Globex'), place_of_supply: '23', post: true, lines: [line(I('SaaS'), 40 + +m)] });
  const hosp = await call('/api/docs/sales', 'POST', { doc_date: d(8), party_id: P('City Care'), place_of_supply: '23', post: true, lines: [line(I('Annual'), 1)] });
  invoices[m] = { acme, globex, hosp };
  if (+m >= 6) await call('/api/docs/sales', 'POST', { doc_date: d(12), party_id: P('Infotech'), place_of_supply: '29', post: true, lines: [line(I('Custom'), 60)] });
  // Purchases
  const aws = await call('/api/docs/purchases', 'POST', { doc_no: `AWS-${m}26`, doc_date: d(2), party_id: P('Amazon'), place_of_supply: '27', post: true, lines: [line(I('Cloud'), 1, 38000 + +m * 500)] });
  const tel = await call('/api/docs/purchases', 'POST', { doc_no: `BT/${m}/771`, doc_date: d(6), party_id: P('Bharat'), place_of_supply: '23', post: true,
    lines: [{ description: 'Leased line & mobiles', qty: 1, rate: 6200, gst_rate: 18, account_id: A('6220') }] });
  const rent = await call('/api/docs/purchases', 'POST', { doc_no: `RENT-${m}`, doc_date: d(1), party_id: P('R. Sharma'), place_of_supply: '23', post: true,
    lines: [{ description: `Office rent ${m}/2026`, qty: 1, rate: 85000, gst_rate: 0, account_id: A('6200') }] });
  // Credit / debit notes before settlement → they reduce what is collected / paid
  if (m === '08') {
    await call('/api/docs/credit-notes', 'POST', { doc_date: d(10), party_id: P('Globex'), place_of_supply: '23', against_id: globex.id, post: true,
      notes: '4 licences cancelled', lines: [line(I('SaaS'), 4)] });
    await call('/api/docs/debit-notes', 'POST', { doc_date: d(12), party_id: P('Amazon'), place_of_supply: '27', against_id: aws.id, post: true,
      notes: 'Over-billed storage', lines: [{ description: 'Storage over-billing', qty: 1, rate: 5000, gst_rate: 18, account_id: A('5110') }] });
  }
  // Pay vendors (rent on 5th, telecom 15th, AWS 25th except October)
  await call('/api/vouchers', 'POST', { kind: 'PAYMENT', voucher_date: d(5), party_id: P('R. Sharma'), bank_account_id: BANK, amount: 76500, tds_amount: 8500, mode: 'NEFT',
    reference: `RENT${m}`, allocations: [{ invoice_id: rent.id, amount: 85000 }] });                         // TDS 10% u/s 194-I
  await call('/api/vouchers', 'POST', { kind: 'PAYMENT', voucher_date: d(15), party_id: P('Bharat'), bank_account_id: BANK, amount: tel.total, mode: 'NEFT', reference: `BT${m}`, allocations: [{ invoice_id: tel.id, amount: tel.total }] });
  if (m !== '10') { const due = (await call(`/api/docs/purchases/${aws.id}`)).outstanding;
    await call('/api/vouchers', 'POST', { kind: 'PAYMENT', voucher_date: d(25), party_id: P('Amazon'), bank_account_id: BANK, amount: due, mode: 'NEFT', reference: `AWS${m}`, allocations: [{ invoice_id: aws.id, amount: due }] }); }
  // Customer receipts: Acme pays within month net of 2% TDS (Sep/Oct left unpaid → overdue), Globex & hospital pay
  if (+m <= 8) {
    const tds = Math.round(acme.taxable_value * 0.02);
    await call('/api/vouchers', 'POST', { kind: 'RECEIPT', voucher_date: d(28), party_id: P('Acme'), bank_account_id: BANK, amount: acme.total - tds, tds_amount: tds, mode: 'NEFT',
      reference: `ACME-UTR-${m}`, allocations: [{ invoice_id: acme.id, amount: acme.total }] });
  }
  if (m !== '10') { const due = (await call(`/api/docs/sales/${globex.id}`)).outstanding;
    await call('/api/vouchers', 'POST', { kind: 'RECEIPT', voucher_date: d(18), party_id: P('Globex'), bank_account_id: BANK, amount: due, mode: 'UPI', reference: `GLX${m}`, allocations: [{ invoice_id: globex.id, amount: due }] }); }
  await call('/api/vouchers', 'POST', { kind: 'RECEIPT', voucher_date: d(20), party_id: P('City Care'), bank_account_id: BANK, amount: m === '10' ? 15000 : hosp.total, mode: 'CHEQUE', reference: `CHQ${m}11`,
    allocations: [{ invoice_id: hosp.id, amount: m === '10' ? 15000 : hosp.total }] });
  if (m === '04') await call('/api/vouchers', 'POST', { kind: 'RECEIPT', voucher_date: d(22), party_id: P('Acme'), bank_account_id: BANK, amount: 236000, mode: 'NEFT', reference: 'ACME-OB',
    allocations: [{ invoice_id: (await call('/api/docs/sales?status=OPEN&party_id=' + P('Acme'))).find(x => x.is_opening).id, amount: 236000 }] });
  if (m === '04') await call('/api/vouchers', 'POST', { kind: 'PAYMENT', voucher_date: d(10), party_id: P('Amazon'), bank_account_id: BANK, amount: 44840, mode: 'NEFT', reference: 'AWS-OB',
    allocations: [{ invoice_id: (await call('/api/docs/purchases?status=OPEN&party_id=' + P('Amazon'))).find(x => x.is_opening).id, amount: 44840 }] });
  // Special events
  if (m === '05') await call('/api/journals', 'POST', { date: d(14), source: 'CONTRA', narration: 'Cash deposited into HDFC', lines: [{ account_id: BANK, debit: 15000 }, { account_id: CASH, credit: 15000 }] });
  if (m === '07') {
    const dell = await call('/api/docs/purchases', 'POST', { doc_no: 'DL/26/55190', doc_date: d(9), party_id: P('Dell'), place_of_supply: '29', post: true, lines: [line(I('Laptop'), 3)] });
    await call('/api/assets', 'POST', { name: '3 × Dell Latitude 7450 laptops', category: 'Computers', asset_account_id: A('1510'), purchase_date: d(9), put_to_use_date: d(12),
      cost: dell.taxable_value, salvage_value: 0, method: 'WDV', wdv_rate: 40, funding: 'BILL', bill_id: dell.id });
    await call('/api/vouchers', 'POST', { kind: 'PAYMENT', voucher_date: d(30), party_id: P('Dell'), bank_account_id: BANK, amount: dell.total, mode: 'RTGS', reference: 'DELL-RTGS', allocations: [{ invoice_id: dell.id, amount: dell.total }] });
  }
  // Payroll (HR): run, post; pay on last day from payroll bank
  token = (await call('/api/auth/login', 'POST', { email: 'hr@fin.local', password: 'Admin@123', company_id: 1 })).token;
  const run = await call('/api/payroll', 'POST', { period: `2026-${m}` });
  if (m === '09') { const r = await call(`/api/payroll/${run.id}`); const e = r.slips.find(s => s.emp_code === 'E002'); await call(`/api/payroll/${run.id}/slips/${e.employee_id}`, 'PUT', { lop_days: 2, bonus: 0, other_deduction: 0 }); }
  if (m === '10') { const r = await call(`/api/payroll/${run.id}`); for (const s of r.slips) await call(`/api/payroll/${run.id}/slips/${s.employee_id}`, 'PUT', { lop_days: s.lop_days, bonus: s.emp_code === 'E004' ? 10000 : 0, other_deduction: 0 }); }
  await call(`/api/payroll/${run.id}/post`, 'POST');
  const lastDay = new Date(Date.UTC(2026, +m, 0)).toISOString().slice(0, 10);
  await login('accounts@fin.local');
  if (m !== '10') await call(`/api/payroll/${run.id}/pay`, 'POST', { bank_account_id: PAYBANK, date: lastDay });
  if (m !== '10') await call('/api/journals', 'POST', { date: lastDay, source: 'CONTRA', narration: 'Fund payroll account', lines: [{ account_id: PAYBANK, debit: 330000 }, { account_id: BANK, credit: 330000 }] });
  // Depreciation
  await call('/api/assets/depreciate', 'POST', { period: `2026-${m}` });
  // Statutory dues of previous month paid on 15th / GST on 20th (from GSTR-3B)
  if (m !== '04') {
    const pm = `2026-${String(+m - 1).padStart(2, '0')}`, pEnd = new Date(Date.UTC(2026, +m - 1, 0)).toISOString().slice(0, 10);
    const tb = await call(`/api/reports/trial-balance?from=${pm}-01&to=${pEnd}`);
    const mv = code => { const r = tb.rows.find(x => x.code === code); return r ? r.credit : 0; };   // amount accrued in that month
    const stat = [['2310', mv('2310')], ['2320', mv('2320')], ['2330', mv('2330')], ['2340', mv('2340')], ['2210', mv('2210')]].filter(x => x[1] > 0);
    const total = Math.round(stat.reduce((s, x) => s + x[1], 0) * 100) / 100;
    await call('/api/journals', 'POST', { date: d(15), narration: `PF, ESI, PT & TDS deposited for ${pm}`, lines: [...stat.map(([c, v]) => ({ account_id: A(c), debit: v })), { account_id: BANK, credit: total }] });
    const g = (await call(`/api/reports/gst?from=${pm}-01&to=${pEnd}`)).gstr3b;
    const liab = { igst: g.outward.igst + g.reverse_charge.igst, cgst: g.outward.cgst + g.reverse_charge.cgst, sgst: g.outward.sgst + g.reverse_charge.sgst };
    const used = h => Math.round((g.itc[h] - g.credit_carried_forward[h]) * 100) / 100;
    if (g.total_payable > 0 || used('igst') > 0)
      await call('/api/journals', 'POST', { date: d(20), narration: `GSTR-3B ${pm}: output tax set off against ITC, balance paid`, lines: [
        { account_id: A('2202'), debit: liab.igst }, { account_id: A('2200'), debit: liab.cgst }, { account_id: A('2201'), debit: liab.sgst },
        { account_id: A('1402'), credit: used('igst') }, { account_id: A('1400'), credit: used('cgst') }, { account_id: A('1401'), credit: used('sgst') },
        { account_id: BANK, credit: g.total_payable }] });
  }
}

console.log('Bank statement (HDFC) import & reconciliation');
const gl = await call(`/api/reports/ledger?account_id=${BANK}&from=2026-04-01&to=2026-10-31`);
const rows = []; let bal = gl.opening;
const skip = new Set(gl.rows.filter(r => r.entry_date >= '2026-10-01' && r.credit > 0).slice(-2).map(r => r.id));   // last two payments not yet presented
for (const r of gl.rows) {
  if (skip.has(r.id)) continue;
  const shift = r.id % 3 === 0 ? 1 : 0, dt = new Date(Date.parse(r.entry_date) + shift * 86400e3).toISOString().slice(0, 10);
  bal = Math.round((bal + r.debit - r.credit) * 100) / 100;
  rows.push({ txn_date: dt > '2026-10-31' ? '2026-10-31' : dt, description: (r.party ? r.party + ' ' : '') + (r.narration ?? '').slice(0, 40), reference: r.entry_no, withdrawal: r.credit, deposit: r.debit, balance: bal });
}
for (const [dt, desc, w, dep] of [['2026-06-30', 'SMS ALERT CHARGES Q1', 59, 0], ['2026-09-30', 'SMS ALERT CHARGES Q2', 59, 0], ['2026-09-30', 'INT.PD SWEEP FD', 0, 4210]]) {
  const i = rows.findIndex(r => r.txn_date > dt); bal = 0;
  rows.splice(i < 0 ? rows.length : i, 0, { txn_date: dt, description: desc, reference: null, withdrawal: w, deposit: dep, balance: null });
}
rows.sort((a, b) => a.txn_date.localeCompare(b.txn_date));   // statements are chronological
let run = gl.opening; for (const r of rows) { run = Math.round((run + r.deposit - r.withdrawal) * 100) / 100; r.balance = run; }
const imp = await call('/api/bank/import', 'POST', { bank_account_id: BANK, rows });
console.log('  imported', imp.inserted, 'rows');
const am = await call('/api/bank/automatch', 'POST', { bank_account_id: BANK });
console.log('  auto-matched', am.matched, 'remaining', am.remaining);
let rec = await call(`/api/bank/reconcile?bank_account_id=${BANK}&as_of=2026-10-31`);
for (const s of rec.statement.filter(s => !s.matched_line_id))
  await call(`/api/bank/statement/${s.id}/create`, 'POST', { account_id: s.withdrawal > 0 ? A('6900') : A('4910'), narration: s.description });
rec = await call(`/api/bank/reconcile?bank_account_id=${BANK}&as_of=2026-10-31`);

console.log('Validation rules');
await expectFail('/api/journals', 'POST', { date: '2026-10-10', narration: 'bad', lines: [{ account_id: BANK, debit: 100 }, { account_id: CASH, credit: 90 }] }, /not balanced/);
await expectFail('/api/docs/purchases', 'POST', { doc_no: 'AWS-0526', doc_date: '2026-05-02', party_id: P('Amazon'), place_of_supply: '27', post: true, lines: [line(I('Cloud'), 1, 100)] }, /Already exists/);
await expectFail('/api/parties', 'POST', { name: 'Bad GST Co', kind: 'CUSTOMER', gstin: '27ABCDE1234F1Z5', state_code: '23' }, /does not match/);
const globexInv = invoices['10']?.globex?.id ?? (await call(`/api/docs/sales?party_id=${P('Globex')}`))[0]?.id;
if (globexInv) {
  await expectFail('/api/vouchers', 'POST', { kind: 'RECEIPT', voucher_date: '2026-10-30', party_id: P('Globex'), bank_account_id: BANK, amount: 999999,
    allocations: [{ invoice_id: globexInv, amount: 999999 }] }, /exceeds/);
}
token = (await call('/api/auth/login', 'POST', { email: 'auditor@fin.local', password: 'Admin@123', company_id: 1 })).token;
await expectFail('/api/journals', 'POST', { date: '2026-10-10', narration: 'auditor', lines: [] }, /role/);
await login('accounts@fin.local');

console.log('Books');
const tb = await call('/api/reports/trial-balance?from=2026-04-01&to=2026-10-31');
assert(tb.balanced, `Trial balance agrees: Dr ${tb.totals.closing_debit} = Cr ${tb.totals.closing_credit}`);
const bs = await call('/api/reports/balance-sheet?as_of=2026-10-31');
assert(bs.balanced, `Balance sheet balances: assets ${bs.assets.total} = liabilities+equity ${bs.total_liabilities_equity}`);
const pl = await call('/api/reports/profit-loss?from=2026-04-01&to=2026-10-31');
console.log(`  revenue ${pl.revenue.total} · gross profit ${pl.gross_profit} · EBITDA ${pl.ebitda} · net profit ${pl.net_profit} (${pl.net_margin}%)`);
const cf = await call('/api/reports/cash-flow?from=2026-04-01&to=2026-10-31');
assert(cf.reconciles, `Cash flow reconciles: net change ${cf.net_change}, cash ${cf.opening_cash} → ${cf.closing_cash}`);
assert(rec.difference === 0, `Bank reconciliation difference is 0 (statement ${rec.statement_balance}, adjusted books ${rec.adjusted_book_balance})`);
const ag = await call('/api/reports/ageing?side=AR&as_of=2026-11-01');
console.log('  receivables outstanding', ag.totals.total, '· 31-60 days', ag.totals.d31_60);
const gst = await call('/api/reports/gst?from=2026-10-01&to=2026-10-31');
console.log('  Oct GST: outward', JSON.stringify(gst.gstr3b.outward), 'ITC', JSON.stringify(gst.gstr3b.itc), 'payable', gst.gstr3b.total_payable);
console.log('DONE');
