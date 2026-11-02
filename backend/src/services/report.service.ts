import { query, one, tx } from '../config/database.js';
import { HttpError } from '../middleware/error.js';
import { LedgerService } from './ledger.service.js';
import { r2 } from '../utils/money.js';
import { addDays, today } from '../utils/dates.js';

const NORMAL_DEBIT = ['ASSET', 'EXPENSE'];

export class ReportService {
  /**
   * Trial Balance: Opening balance, period movements, and closing balance
   */
  static async trialBalance(companyId: number, from: string, to: string) {
    const rows = await query(
      `SELECT a.id, a.code, a.name, a.type, a.subtype,
              COALESCE(SUM(l.debit - l.credit) FILTER (WHERE e.entry_date < $2), 0) AS opening,
              COALESCE(SUM(l.debit) FILTER (WHERE e.entry_date BETWEEN $2 AND $3), 0) AS debit,
              COALESCE(SUM(l.credit) FILTER (WHERE e.entry_date BETWEEN $2 AND $3), 0) AS credit
       FROM accounts a 
       LEFT JOIN journal_lines l ON l.account_id = a.id 
       LEFT JOIN journal_entries e ON e.id = l.entry_id AND e.entry_date <= $3
       WHERE a.company_id = $1 
       GROUP BY a.id 
       ORDER BY a.code`,
      [companyId, from, to]
    );

    const out = rows
      .map(r => ({ ...r, closing: r2(r.opening + r.debit - r.credit) }))
      .filter(r => r.opening !== 0 || r.debit !== 0 || r.credit !== 0);

    const tot = (k: string) => r2(out.reduce((s, r: any) => s + r[k], 0));
    const closingDr = r2(out.filter(r => r.closing > 0).reduce((s, r) => s + r.closing, 0));
    const closingCr = r2(-out.filter(r => r.closing < 0).reduce((s, r) => s + r.closing, 0));

    return {
      from,
      to,
      rows: out,
      totals: {
        debit: tot('debit'),
        credit: tot('credit'),
        closing_debit: closingDr,
        closing_credit: closingCr,
      },
      balanced: tot('debit') === tot('credit') && closingDr === closingCr,
    };
  }

  private static async balancesBySubtype(
    companyId: number,
    from: string | null,
    to: string,
    excludeClose: boolean
  ) {
    return query(
      `SELECT a.id, a.code, a.name, a.type, a.subtype, COALESCE(SUM(l.debit - l.credit), 0) AS bal
       FROM accounts a 
       JOIN journal_lines l ON l.account_id = a.id 
       JOIN journal_entries e ON e.id = l.entry_id
       WHERE a.company_id = $1 AND e.entry_date <= $3 
         AND ($2::date IS NULL OR e.entry_date >= $2) 
         ${excludeClose ? "AND e.source <> 'YEAR_CLOSE'" : ''}
       GROUP BY a.id 
       HAVING SUM(l.debit - l.credit) <> 0 
       ORDER BY a.code`,
      [companyId, from, to]
    );
  }

  /**
   * Profit & Loss statement (Schedule III structure)
   */
  static async profitLoss(companyId: number, from: string, to: string) {
    const rows = (await this.balancesBySubtype(companyId, from, to, true)).filter(
      r => r.type === 'INCOME' || r.type === 'EXPENSE'
    );

    const grp = (subs: string[], sign: number) => {
      const lines = rows
        .filter(r => subs.includes(r.subtype))
        .map(r => ({
          code: r.code,
          name: r.name,
          account_id: r.id,
          amount: r2(sign * r.bal),
        }));
      return { lines, total: r2(lines.reduce((s, l) => s + l.amount, 0)) };
    };

    const revenue = grp(['SALES'], -1);
    const cogs = grp(['COGS', 'DIRECT_EXPENSE'], 1);
    const gross = r2(revenue.total - cogs.total);

    const employee = grp(['PAYROLL_EXPENSE'], 1);
    const opex = grp(['INDIRECT_EXPENSE'], 1);
    const ebitda = r2(gross - employee.total - opex.total);

    const depreciation = grp(['DEPRECIATION'], 1);
    const finance = grp(['FINANCE_COST'], 1);
    const other = grp(['OTHER_INCOME'], -1);
    const roundOff = grp(['ROUND_OFF'], 1);

    const net = r2(ebitda - depreciation.total - finance.total + other.total - roundOff.total);

    return {
      from,
      to,
      revenue,
      cogs,
      gross_profit: gross,
      gross_margin: revenue.total ? r2((gross / revenue.total) * 100) : 0,
      employee,
      opex,
      ebitda,
      depreciation,
      finance,
      other_income: other,
      round_off: roundOff,
      net_profit: net,
      net_margin: revenue.total ? r2((net / revenue.total) * 100) : 0,
    };
  }

  /**
   * Balance Sheet
   */
  static async balanceSheet(companyId: number, asOf: string) {
    const rows = await this.balancesBySubtype(companyId, null, asOf, false);
    const pick = (subs: string[], sign: number) => {
      const lines = rows
        .filter(r => subs.includes(r.subtype))
        .map(r => ({
          code: r.code,
          name: r.name,
          account_id: r.id,
          amount: r2(sign * r.bal),
        }));
      return { lines, total: r2(lines.reduce((s, l) => s + l.amount, 0)) };
    };

    const fixed = pick(['FIXED_ASSET', 'ACC_DEPRECIATION'], 1);
    const current = {
      cash: pick(['BANK', 'CASH'], 1),
      receivables: pick(['RECEIVABLE'], 1),
      inventory: pick(['INVENTORY'], 1),
      taxes: pick(['TAX_INPUT'], 1),
      other: pick(['CURRENT_ASSET'], 1),
    };

    const currentTotal = r2(Object.values(current).reduce((s, g) => s + g.total, 0));
    const totalAssets = r2(fixed.total + currentTotal);

    const loans = pick(['LOAN'], -1);
    const cl = {
      payables: pick(['PAYABLE'], -1),
      taxes: pick(['TAX_OUTPUT'], -1),
      payroll: pick(['PAYROLL_LIABILITY'], -1),
      other: pick(['CURRENT_LIABILITY'], -1),
    };

    const clTotal = r2(Object.values(cl).reduce((s, g) => s + g.total, 0));
    const capital = pick(['CAPITAL'], -1);
    const retained = pick(['RETAINED_EARNINGS'], -1);
    const unclosed = r2(
      -rows
        .filter(r => r.type === 'INCOME' || r.type === 'EXPENSE')
        .reduce((s, r) => s + r.bal, 0)
    );

    const equity = r2(capital.total + retained.total + unclosed);
    const totalLE = r2(equity + loans.total + clTotal);

    return {
      as_of: asOf,
      assets: { fixed, current, current_total: currentTotal, total: totalAssets },
      liabilities: { loans, current: cl, current_total: clTotal },
      equity: { capital, retained, current_profit: unclosed, total: equity },
      total_liabilities_equity: totalLE,
      balanced: totalAssets === totalLE,
      difference: r2(totalAssets - totalLE),
    };
  }

  /**
   * Cash Flow Statement (Indirect Method)
   */
  static async cashFlow(companyId: number, from: string, to: string) {
    const pl = await this.profitLoss(companyId, from, to);
    const mv = await query(
      `SELECT a.subtype, a.name, COALESCE(SUM(l.debit - l.credit), 0) AS mv 
       FROM accounts a 
       JOIN journal_lines l ON l.account_id = a.id
       JOIN journal_entries e ON e.id = l.entry_id 
       WHERE a.company_id = $1 AND e.entry_date BETWEEN $2 AND $3 
         AND e.source <> 'YEAR_CLOSE'
         AND a.type IN ('ASSET','LIABILITY','EQUITY') 
       GROUP BY a.subtype, a.name 
       HAVING SUM(l.debit - l.credit) <> 0`,
      [companyId, from, to]
    );

    const sumOf = (subs: string[]) =>
      r2(-mv.filter(m => subs.includes(m.subtype)).reduce((s, m) => s + m.mv, 0));

    const op = [
      { label: 'Net profit', amount: pl.net_profit },
      { label: 'Add: depreciation', amount: sumOf(['ACC_DEPRECIATION']) },
      { label: '(Increase)/decrease in receivables', amount: sumOf(['RECEIVABLE']) },
      { label: '(Increase)/decrease in inventory', amount: sumOf(['INVENTORY']) },
      {
        label: '(Increase)/decrease in other current assets & input tax',
        amount: sumOf(['CURRENT_ASSET', 'TAX_INPUT']),
      },
      { label: 'Increase/(decrease) in payables', amount: sumOf(['PAYABLE']) },
      {
        label: 'Increase/(decrease) in tax, payroll & other liabilities',
        amount: sumOf(['TAX_OUTPUT', 'PAYROLL_LIABILITY', 'CURRENT_LIABILITY']),
      },
    ].filter(x => x.amount !== 0 || x.label === 'Net profit');

    const inv = [
      { label: 'Purchase / sale of fixed assets', amount: sumOf(['FIXED_ASSET']) },
    ].filter(x => x.amount !== 0);

    const fin = [
      { label: 'Loans taken / (repaid)', amount: sumOf(['LOAN']) },
      {
        label: 'Capital introduced / (withdrawn)',
        amount: sumOf(['CAPITAL', 'RETAINED_EARNINGS']),
      },
    ].filter(x => x.amount !== 0);

    const t = (xs: any[]) => r2(xs.reduce((s, x) => s + x.amount, 0));

    const openCash = await one(
      `SELECT COALESCE(SUM(l.debit - l.credit), 0) v 
       FROM journal_lines l 
       JOIN journal_entries e ON e.id = l.entry_id 
       JOIN accounts a ON a.id = l.account_id
       WHERE a.company_id = $1 AND a.subtype IN ('BANK','CASH') AND e.entry_date < $2`,
      [companyId, from]
    );

    const net = r2(t(op) + t(inv) + t(fin));
    const opening = Number(openCash!.v);
    const cashMove = r2(-sumOf(['BANK', 'CASH']));

    return {
      from,
      to,
      operating: { lines: op, total: t(op) },
      investing: { lines: inv, total: t(inv) },
      financing: { lines: fin, total: t(fin) },
      net_change: net,
      opening_cash: opening,
      closing_cash: r2(opening + cashMove),
      reconciles: net === cashMove,
    };
  }

  static async generalLedger(companyId: number, accountId: number, from: string, to: string) {
    const acct = await one(
      `SELECT * FROM accounts WHERE id = $1 AND company_id = $2`,
      [accountId, companyId]
    );
    if (!acct) throw new HttpError(404, 'Account not found');

    const op = await one(
      `SELECT COALESCE(SUM(l.debit - l.credit), 0) v 
       FROM journal_lines l 
       JOIN journal_entries e ON e.id = l.entry_id 
       WHERE l.account_id = $1 AND e.entry_date < $2`,
      [accountId, from]
    );

    const lines = await query(
      `SELECT l.id, e.id AS entry_id, e.entry_no, e.entry_date, e.source, 
              COALESCE(l.narration, e.narration) AS narration, l.debit, l.credit, p.name AS party
       FROM journal_lines l 
       JOIN journal_entries e ON e.id = l.entry_id 
       LEFT JOIN parties p ON p.id = l.party_id
       WHERE l.account_id = $1 AND e.entry_date BETWEEN $2 AND $3 
       ORDER BY e.entry_date, e.id, l.id`,
      [accountId, from, to]
    );

    let bal = Number(op!.v);
    const rows = lines.map(l => ({ ...l, balance: (bal = r2(bal + l.debit - l.credit)) }));

    return {
      account: acct,
      from,
      to,
      opening: Number(op!.v),
      rows,
      closing: bal,
      normal_debit: NORMAL_DEBIT.includes(acct.type),
    };
  }

  static async partyLedger(companyId: number, partyId: number, from: string, to: string) {
    const party = await one(
      `SELECT * FROM parties WHERE id = $1 AND company_id = $2`,
      [partyId, companyId]
    );
    if (!party) throw new HttpError(404, 'Party not found');

    const cond = `l.party_id = $1 AND a.subtype IN ('RECEIVABLE','PAYABLE')`;
    const op = await one(
      `SELECT COALESCE(SUM(l.debit - l.credit), 0) v 
       FROM journal_lines l 
       JOIN journal_entries e ON e.id = l.entry_id 
       JOIN accounts a ON a.id = l.account_id 
       WHERE ${cond} AND e.entry_date < $2`,
      [partyId, from]
    );

    const lines = await query(
      `SELECT e.id AS entry_id, e.entry_no, e.entry_date, e.source, e.narration, l.debit, l.credit 
       FROM journal_lines l 
       JOIN journal_entries e ON e.id = l.entry_id
       JOIN accounts a ON a.id = l.account_id 
       WHERE ${cond} AND e.entry_date BETWEEN $2 AND $3 
       ORDER BY e.entry_date, e.id`,
      [partyId, from, to]
    );

    let bal = Number(op!.v);
    return {
      party,
      from,
      to,
      opening: Number(op!.v),
      rows: lines.map(l => ({ ...l, balance: (bal = r2(bal + l.debit - l.credit)) })),
      closing: bal,
    };
  }

  static async ageing(companyId: number, side: 'AR' | 'AP', asOf: string) {
    const kinds = side === 'AR' ? ['SALE', 'CREDIT_NOTE'] : ['PURCHASE', 'DEBIT_NOTE'];
    const docs = await query(
      `SELECT party_id, party_name, kind, doc_no, doc_date, due_date, outstanding 
       FROM v_invoice_outstanding
       WHERE company_id = $1 AND kind = ANY($2) AND status IN ('POSTED','PARTIAL') 
         AND doc_date <= $3 AND outstanding > 0`,
      [companyId, kinds, asOf]
    );

    const B = ['not_due', 'd0_30', 'd31_60', 'd61_90', 'd90p'] as const;
    const parties: Record<number, any> = {};

    for (const d of docs) {
      const sign = d.kind === 'CREDIT_NOTE' || d.kind === 'DEBIT_NOTE' ? -1 : 1;
      const od = Math.round((Date.parse(asOf) - Date.parse(d.due_date ?? d.doc_date)) / 86400e3);
      const b =
        od <= 0
          ? 'not_due'
          : od <= 30
          ? 'd0_30'
          : od <= 60
          ? 'd31_60'
          : od <= 90
          ? 'd61_90'
          : 'd90p';

      const p = (parties[d.party_id] ??= {
        party_id: d.party_id,
        party: d.party_name,
        total: 0,
        ...Object.fromEntries(B.map(k => [k, 0])),
      });

      p[b] = r2(p[b] + sign * d.outstanding);
      p.total = r2(p.total + sign * d.outstanding);
    }

    const rows = Object.values(parties).sort((a: any, b: any) => b.total - a.total);
    const totals: any = { total: 0 };
    for (const k of B) {
      totals[k] = r2(rows.reduce((s: number, r: any) => s + r[k], 0));
    }
    totals.total = r2(rows.reduce((s: number, r: any) => s + r.total, 0));

    return { side, as_of: asOf, rows, totals };
  }

  /**
   * GST Returns with legal set-off sequence
   */
  static async gstReturns(companyId: number, from: string, to: string) {
    const co = await one(`SELECT gstin, state_code FROM companies WHERE id = $1`, [companyId]);
    const docs = await query(
      `SELECT i.id, i.kind, i.doc_no, i.doc_date, i.place_of_supply, i.reverse_charge, 
              i.taxable_value, i.cgst, i.sgst, i.igst, i.total,
              p.name AS party, p.gstin 
       FROM invoices i 
       JOIN parties p ON p.id = i.party_id
       WHERE i.company_id = $1 AND i.doc_date BETWEEN $2 AND $3 
         AND i.status <> 'DRAFT' AND i.status <> 'CANCELLED' 
         AND NOT i.is_opening`,
      [companyId, from, to]
    );

    const sales = docs.filter(d => d.kind === 'SALE');
    const cn = docs.filter(d => d.kind === 'CREDIT_NOTE');
    const b2b = sales.filter(d => d.gstin);
    const b2cl = sales.filter(
      d => !d.gstin && d.place_of_supply !== co!.state_code && d.total > 100000
    );

    const b2cs: Record<string, any> = {};
    for (const d of sales.filter(d => !d.gstin && !b2cl.includes(d))) {
      const k = d.place_of_supply;
      const r = (b2cs[k] ??= { place_of_supply: k, taxable: 0, cgst: 0, sgst: 0, igst: 0 });
      for (const f of ['taxable_value', 'cgst', 'sgst', 'igst']) {
        r[f === 'taxable_value' ? 'taxable' : f] = r2(
          r[f === 'taxable_value' ? 'taxable' : f] + d[f]
        );
      }
    }

    const hsn = await query(
      `SELECT COALESCE(l.hsn_sac, '—') AS hsn_sac, l.gst_rate, SUM(l.qty) qty, 
              SUM(CASE WHEN i.kind = 'SALE' THEN l.taxable ELSE -l.taxable END) taxable,
              SUM(CASE WHEN i.kind = 'SALE' THEN l.cgst ELSE -l.cgst END) cgst, 
              SUM(CASE WHEN i.kind = 'SALE' THEN l.sgst ELSE -l.sgst END) sgst,
              SUM(CASE WHEN i.kind = 'SALE' THEN l.igst ELSE -l.igst END) igst
       FROM invoice_lines l 
       JOIN invoices i ON i.id = l.invoice_id
       WHERE i.company_id = $1 AND i.kind IN ('SALE','CREDIT_NOTE') 
         AND i.doc_date BETWEEN $2 AND $3 
         AND i.status NOT IN ('DRAFT','CANCELLED') 
         AND NOT i.is_opening
       GROUP BY 1, 2 
       ORDER BY 1, 2`,
      [companyId, from, to]
    );

    const agg = (xs: any[], sign = 1) => ({
      taxable: r2(sign * xs.reduce((s, d) => s + d.taxable_value, 0)),
      igst: r2(sign * xs.reduce((s, d) => s + d.igst, 0)),
      cgst: r2(sign * xs.reduce((s, d) => s + d.cgst, 0)),
      sgst: r2(sign * xs.reduce((s, d) => s + d.sgst, 0)),
    });

    const add = (a: any, b: any) => ({
      taxable: r2(a.taxable + b.taxable),
      igst: r2(a.igst + b.igst),
      cgst: r2(a.cgst + b.cgst),
      sgst: r2(a.sgst + b.sgst),
    });

    const outward = add(agg(sales), agg(cn, -1));
    const purchases = docs.filter(d => d.kind === 'PURCHASE');
    const dn = docs.filter(d => d.kind === 'DEBIT_NOTE');
    const rcm = agg(purchases.filter(d => d.reverse_charge));
    const itc = add(agg(purchases), agg(dn, -1));

    // Statutory set-off hierarchy:
    // IGST credit -> IGST, CGST, SGST
    // CGST credit -> CGST, IGST
    // SGST credit -> SGST, IGST
    const liab = {
      igst: r2(outward.igst + rcm.igst),
      cgst: r2(outward.cgst + rcm.cgst),
      sgst: r2(outward.sgst + rcm.sgst),
    };
    const cr = { igst: itc.igst, cgst: itc.cgst, sgst: itc.sgst };

    const use = (fromKey: 'igst' | 'cgst' | 'sgst', toKey: 'igst' | 'cgst' | 'sgst') => {
      const u = Math.min(cr[fromKey], liab[toKey]);
      cr[fromKey] = r2(cr[fromKey] - u);
      liab[toKey] = r2(liab[toKey] - u);
    };

    use('igst', 'igst');
    use('igst', 'cgst');
    use('igst', 'sgst');
    use('cgst', 'cgst');
    use('cgst', 'igst');
    use('sgst', 'sgst');
    use('sgst', 'igst');

    return {
      from,
      to,
      gstin: co!.gstin,
      gstr1: { b2b, b2cl, b2cs: Object.values(b2cs), credit_notes: cn, hsn, totals: outward },
      gstr3b: {
        outward,
        reverse_charge: rcm,
        itc,
        cash_payable: liab,
        credit_carried_forward: cr,
        total_payable: r2(liab.igst + liab.cgst + liab.sgst),
      },
    };
  }

  static async dashboard(companyId: number) {
    const t = today();
    const fy = await one(
      `SELECT * FROM fiscal_years WHERE company_id = $1 AND $2 BETWEEN start_date AND end_date`,
      [companyId, t]
    );

    const fyStartDate = fy?.start_date ?? t.slice(0, 4) + '-04-01';
    const ms = t.slice(0, 8) + '01';

    const [cash, ar, ap, ytd, mtd, monthly, overdue, recon, run, gst, co] = await Promise.all([
      query(
        `SELECT a.id, a.name, a.subtype, COALESCE(SUM(l.debit - l.credit), 0) bal 
         FROM accounts a 
         LEFT JOIN journal_lines l ON l.account_id = a.id
         WHERE a.company_id = $1 AND a.subtype IN ('BANK','CASH') 
         GROUP BY a.id 
         ORDER BY a.code`,
        [companyId]
      ),
      one(
        `SELECT COALESCE(SUM(l.debit - l.credit), 0) v 
         FROM journal_lines l 
         JOIN accounts a ON a.id = l.account_id
         WHERE a.company_id = $1 AND a.subtype = 'RECEIVABLE'`,
        [companyId]
      ),
      one(
        `SELECT COALESCE(SUM(l.credit - l.debit), 0) v 
         FROM journal_lines l 
         JOIN accounts a ON a.id = l.account_id
         WHERE a.company_id = $1 AND a.subtype = 'PAYABLE'`,
        [companyId]
      ),
      this.profitLoss(companyId, fyStartDate, t),
      this.profitLoss(companyId, ms, t),
      query(
        `SELECT to_char(date_trunc('month', e.entry_date), 'Mon YY') label, 
                date_trunc('month', e.entry_date)::date m,
                COALESCE(SUM(l.credit - l.debit) FILTER (WHERE a.type = 'INCOME'), 0) income, 
                COALESCE(SUM(l.debit - l.credit) FILTER (WHERE a.type = 'EXPENSE'), 0) expense
         FROM journal_lines l 
         JOIN journal_entries e ON e.id = l.entry_id 
         JOIN accounts a ON a.id = l.account_id
         WHERE a.company_id = $1 AND a.type IN ('INCOME','EXPENSE') 
           AND e.source <> 'YEAR_CLOSE' 
           AND e.entry_date >= ($2::date - interval '11 months')
         GROUP BY 1, 2 
         ORDER BY 2`,
        [companyId, ms]
      ),
      query(
        `SELECT id, kind, doc_no, party_name, due_date, outstanding, days_overdue 
         FROM v_invoice_outstanding
         WHERE company_id = $1 AND kind IN ('SALE','PURCHASE') 
           AND status IN ('POSTED','PARTIAL') AND due_date < $2 
         ORDER BY due_date 
         LIMIT 8`,
        [companyId, t]
      ),
      one(
        `SELECT COUNT(*) FILTER (WHERE matched_line_id IS NULL) unmatched 
         FROM bank_statement_lines 
         WHERE company_id = $1`,
        [companyId]
      ),
      one(
        `SELECT period, status, net, employer_cost 
         FROM payroll_runs 
         WHERE company_id = $1 
         ORDER BY period DESC 
         LIMIT 1`,
        [companyId]
      ),
      this.gstReturns(companyId, ms, t),
      one(
        `SELECT name, industry, gstin, lock_date FROM companies WHERE id = $1`,
        [companyId]
      ),
    ]);

    return {
      company: co,
      fy,
      cash,
      cash_total: r2(cash.reduce((s, c) => s + c.bal, 0)),
      receivables: ar!.v,
      payables: ap!.v,
      ytd: {
        revenue: ytd.revenue.total,
        gross_profit: ytd.gross_profit,
        net_profit: ytd.net_profit,
        net_margin: ytd.net_margin,
      },
      mtd: {
        revenue: mtd.revenue.total,
        expenses: r2(mtd.revenue.total + mtd.other_income.total - mtd.net_profit),
        net_profit: mtd.net_profit,
      },
      monthly,
      overdue,
      recon_unmatched: Number(recon!.unmatched ?? 0),
      last_payroll: run,
      gst_payable_mtd: gst.gstr3b.total_payable,
    };
  }

  static async dayBook(companyId: number, date: string) {
    return query(
      `SELECT e.id, e.entry_no, e.source, e.narration, 
              json_agg(json_build_object('account', a.name, 'debit', l.debit, 'credit', l.credit) ORDER BY l.debit DESC) lines
       FROM journal_entries e 
       JOIN journal_lines l ON l.entry_id = e.id 
       JOIN accounts a ON a.id = l.account_id
       WHERE e.company_id = $1 AND e.entry_date = $2 
       GROUP BY e.id 
       ORDER BY e.id`,
      [companyId, date]
    );
  }

  static async closeYear(companyId: number, uid: number, fyId: number) {
    return tx(async c => {
      const { rows: [fy] } = await c.query(
        `SELECT * FROM fiscal_years WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [fyId, companyId]
      );
      if (!fy) throw new HttpError(404, 'Financial year not found');
      if (fy.closed) throw new HttpError(422, 'Year already closed');

      const { rows: drafts } = await c.query(
        `SELECT COUNT(*)::int n FROM invoices 
         WHERE company_id = $1 AND status = 'DRAFT' AND doc_date BETWEEN $2 AND $3`,
        [companyId, fy.start_date, fy.end_date]
      );
      if (drafts[0].n) {
        throw new HttpError(422, `${drafts[0].n} draft document(s) are dated in this year — post or cancel them first`);
      }

      const { rows: bals } = await c.query(
        `SELECT a.id, SUM(l.debit - l.credit) bal 
         FROM accounts a 
         JOIN journal_lines l ON l.account_id = a.id 
         JOIN journal_entries e ON e.id = l.entry_id
         WHERE a.company_id = $1 AND a.type IN ('INCOME','EXPENSE') 
           AND e.entry_date BETWEEN $2 AND $3 
         GROUP BY a.id 
         HAVING SUM(l.debit - l.credit) <> 0`,
        [companyId, fy.start_date, fy.end_date]
      );

      let entry: number | null = null;
      if (bals.length) {
        const profit = r2(-bals.reduce((s, b) => s + Number(b.bal), 0));
        entry = await LedgerService.postJournal(c, companyId, uid, {
          date: fy.end_date,
          source: 'YEAR_CLOSE',
          narration: `Closing entry ${fy.label}: profit ${profit} to retained earnings`,
          lines: [
            ...bals.map(b => ({ account_id: b.id, debit: -Number(b.bal) })),
            { key: 'RE', credit: profit },
          ],
        });
      }

      await c.query(`UPDATE fiscal_years SET closed = TRUE WHERE id = $1`, [fyId]);
      await c.query(
        `UPDATE companies SET lock_date = GREATEST(COALESCE(lock_date, '1900-01-01'), $2) WHERE id = $1`,
        [companyId, fy.end_date]
      );

      const next = addDays(fy.end_date, 1);
      await c.query(
        `INSERT INTO fiscal_years(company_id, label, start_date, end_date) 
         VALUES ($1, fy_label($1, $2), $2, ($2::date + interval '1 year' - interval '1 day')::date)
         ON CONFLICT (company_id, start_date) DO NOTHING`,
        [companyId, next]
      );

      return { closed: fy.label, entry_id: entry };
    });
  }
}

