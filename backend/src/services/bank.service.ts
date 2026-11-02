import { randomUUID } from 'crypto';
import { query, one, tx } from '../config/database.js';
import { HttpError } from '../middleware/error.js';
import { LedgerService } from './ledger.service.js';
import { r2 } from '../utils/money.js';

const candidatesSql = `
SELECT l.id AS line_id, e.entry_no, e.entry_date, e.narration, l.debit, l.credit, p.name AS party
FROM journal_lines l 
JOIN journal_entries e ON e.id = l.entry_id 
LEFT JOIN parties p ON p.id = l.party_id
WHERE l.account_id = $1 
  AND NOT EXISTS (SELECT 1 FROM bank_statement_lines b WHERE b.matched_line_id = l.id)
  AND e.reversed_by IS NULL 
  AND e.reversal_of IS NULL`;

export class BankService {
  static async importStatement(companyId: number, bankAccountId: number, rows: any[]) {
    return tx(async c => {
      const { rows: [a] } = await c.query(
        `SELECT subtype FROM accounts WHERE id = $1 AND company_id = $2`,
        [bankAccountId, companyId]
      );
      if (!a || a.subtype !== 'BANK') {
        throw new HttpError(422, 'Choose a valid bank account');
      }

      const batch = randomUUID();
      let inserted = 0;

      for (const r of rows) {
        const res = await c.query(
          `INSERT INTO bank_statement_lines(company_id, bank_account_id, txn_date, description, 
                                            reference, withdrawal, deposit, balance, import_batch)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
           ON CONFLICT DO NOTHING`,
          [
            companyId,
            bankAccountId,
            r.txn_date,
            r.description,
            r.reference || null,
            r.withdrawal || 0,
            r.deposit || 0,
            r.balance ?? null,
            batch,
          ]
        );
        inserted += res.rowCount ?? 0;
      }

      return { inserted, skipped: rows.length - inserted, batch };
    });
  }

  static async autoMatch(companyId: number, bankAccountId: number) {
    return tx(async c => {
      const { rows: st } = await c.query(
        `SELECT * FROM bank_statement_lines 
         WHERE company_id = $1 AND bank_account_id = $2 AND matched_line_id IS NULL 
         ORDER BY txn_date`,
        [companyId, bankAccountId]
      );

      const { rows: book } = await c.query(candidatesSql, [bankAccountId]);
      const used = new Set<number>();
      let matched = 0;

      for (const s of st) {
        const amt = Number(s.deposit) || Number(s.withdrawal);
        const isDep = Number(s.deposit) > 0;

        const best = book
          .filter(
            b =>
              !used.has(b.line_id) &&
              Number(isDep ? b.debit : b.credit) === amt &&
              Math.abs(Date.parse(b.entry_date) - Date.parse(s.txn_date)) <= 5 * 86400e3
          )
          .sort(
            (x, y) =>
              Math.abs(Date.parse(x.entry_date) - Date.parse(s.txn_date)) -
              Math.abs(Date.parse(y.entry_date) - Date.parse(s.txn_date))
          )[0];

        if (best) {
          used.add(best.line_id);
          matched++;
          await c.query(
            `UPDATE bank_statement_lines SET matched_line_id = $2 WHERE id = $1`,
            [s.id, best.line_id]
          );
        }
      }

      return { matched, remaining: st.length - matched };
    });
  }

  static async matchLine(companyId: number, stmtId: number, lineId: number | null) {
    const s = await one(
      `SELECT * FROM bank_statement_lines WHERE id = $1 AND company_id = $2`,
      [stmtId, companyId]
    );
    if (!s) throw new HttpError(404, 'Statement line not found');

    if (lineId) {
      const l = await one(
        `SELECT l.* FROM journal_lines l WHERE l.id = $1 AND l.account_id = $2`,
        [lineId, s.bank_account_id]
      );
      if (!l) throw new HttpError(422, 'That ledger line is not on this bank account');

      const amt = Number(s.deposit) || Number(s.withdrawal);
      if (Number(Number(s.deposit) > 0 ? l.debit : l.credit) !== amt) {
        throw new HttpError(422, 'Amount or direction does not match the statement line');
      }
    }

    return one(
      `UPDATE bank_statement_lines SET matched_line_id = $2 WHERE id = $1 RETURNING *`,
      [stmtId, lineId]
    );
  }

  static async createFromStatement(
    companyId: number,
    uid: number,
    stmtId: number,
    d: { account_id: number; party_id?: number | null; narration?: string }
  ) {
    return tx(async c => {
      const { rows: [s] } = await c.query(
        `SELECT * FROM bank_statement_lines WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [stmtId, companyId]
      );
      if (!s) throw new HttpError(404, 'Statement line not found');
      if (s.matched_line_id) throw new HttpError(422, 'Already matched');

      const dep = Number(s.deposit);
      const wd = Number(s.withdrawal);

      const je = await LedgerService.postJournal(c, companyId, uid, {
        date: s.txn_date,
        source: 'BANK_ENTRY',
        narration: d.narration || s.description,
        lines: [
          { account_id: s.bank_account_id, debit: dep, credit: wd },
          { account_id: d.account_id, party_id: d.party_id ?? null, debit: wd, credit: dep },
        ],
      });

      const { rows: [l] } = await c.query(
        `SELECT id FROM journal_lines WHERE entry_id = $1 AND account_id = $2`,
        [je, s.bank_account_id]
      );

      await c.query(
        `UPDATE bank_statement_lines SET matched_line_id = $2 WHERE id = $1`,
        [stmtId, l.id]
      );

      return { entry_id: je };
    });
  }

  static async reconciliation(companyId: number, bankAccountId: number, asOf: string) {
    const acct = await one(
      `SELECT id, name, bank_name, bank_acc_last4 
       FROM accounts 
       WHERE id = $1 AND company_id = $2 AND subtype = 'BANK'`,
      [bankAccountId, companyId]
    );
    if (!acct) throw new HttpError(404, 'Bank account not found');

    const book = await one(
      `SELECT COALESCE(SUM(l.debit - l.credit), 0) AS bal 
       FROM journal_lines l 
       JOIN journal_entries e ON e.id = l.entry_id
       WHERE l.account_id = $1 AND e.entry_date <= $2`,
      [bankAccountId, asOf]
    );

    const statement = await query(
      `SELECT b.*, e.entry_no 
       FROM bank_statement_lines b 
       LEFT JOIN journal_lines l ON l.id = b.matched_line_id
       LEFT JOIN journal_entries e ON e.id = l.entry_id 
       WHERE b.bank_account_id = $1 AND b.txn_date <= $2 
       ORDER BY b.txn_date, b.id`,
      [bankAccountId, asOf]
    );

    const unmatchedBook = await query(
      candidatesSql + ` AND e.entry_date <= $2 ORDER BY e.entry_date`,
      [bankAccountId, asOf]
    );

    const last = [...statement].reverse().find(s => s.balance != null);
    const stmtBal = last ? Number(last.balance) : null;

    const notInBankDeposits = r2(
      unmatchedBook.reduce((s, b) => s + Number(b.debit), 0)
    );
    const notInBankPayments = r2(
      unmatchedBook.reduce((s, b) => s + Number(b.credit), 0)
    );

    const unmatchedStmt = statement.filter(s => !s.matched_line_id);
    const notInBooksDep = r2(
      unmatchedStmt.reduce((s, b) => s + Number(b.deposit), 0)
    );
    const notInBooksWd = r2(
      unmatchedStmt.reduce((s, b) => s + Number(b.withdrawal), 0)
    );

    const adjusted = r2(
      Number(book!.bal) - notInBankDeposits + notInBankPayments + notInBooksDep - notInBooksWd
    );

    return {
      account: acct,
      as_of: asOf,
      book_balance: Number(book!.bal),
      statement_balance: stmtBal,
      not_in_bank: { deposits: notInBankDeposits, payments: notInBankPayments },
      not_in_books: { deposits: notInBooksDep, withdrawals: notInBooksWd },
      adjusted_book_balance: adjusted,
      difference: stmtBal == null ? null : r2(stmtBal - adjusted),
      statement,
      unmatched_book: unmatchedBook,
      matched: statement.length - unmatchedStmt.length,
      unmatched: unmatchedStmt.length,
    };
  }

  static async candidatesFor(companyId: number, stmtId: number) {
    const s = await one(
      `SELECT * FROM bank_statement_lines WHERE id = $1 AND company_id = $2`,
      [stmtId, companyId]
    );
    if (!s) throw new HttpError(404, 'Not found');
    const amt = Number(s.deposit) || Number(s.withdrawal);

    return query(
      candidatesSql +
        ` AND ${Number(s.deposit) > 0 ? 'l.debit' : 'l.credit'} = $2 
         ORDER BY abs(e.entry_date - $3::date) LIMIT 20`,
      [s.bank_account_id, amt, s.txn_date]
    );
  }
}

