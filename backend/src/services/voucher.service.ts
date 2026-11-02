import { query, one, tx } from '../config/database.js';
import { HttpError } from '../middleware/error.js';
import { LedgerService } from './ledger.service.js';
import { r2 } from '../utils/money.js';
import { today } from '../utils/dates.js';

export class VoucherService {
  static async listVouchers(companyId: number, kind?: string) {
    return query(
      `SELECT v.*, p.name AS party, a.name AS bank,
              COALESCE((SELECT SUM(amount) FROM allocations WHERE voucher_id = v.id), 0) AS allocated
       FROM vouchers v 
       JOIN parties p ON p.id = v.party_id 
       JOIN accounts a ON a.id = v.bank_account_id
       WHERE v.company_id = $1 AND ($2::text IS NULL OR v.kind = $2) 
       ORDER BY v.voucher_date DESC, v.id DESC 
       LIMIT 500`,
      [companyId, kind ?? null]
    );
  }

  static async getVoucher(companyId: number, id: number) {
    const v = await one(
      `SELECT v.*, p.name AS party, a.name AS bank, je.entry_no 
       FROM vouchers v 
       JOIN parties p ON p.id = v.party_id
       JOIN accounts a ON a.id = v.bank_account_id 
       LEFT JOIN journal_entries je ON je.id = v.journal_entry_id
       WHERE v.company_id = $1 AND v.id = $2`,
      [companyId, id]
    );

    if (!v) throw new HttpError(404, 'Not found');

    const allocations = await query(
      `SELECT a.amount, i.doc_no, i.doc_date, i.total 
       FROM allocations a 
       JOIN invoices i ON i.id = a.invoice_id 
       WHERE a.voucher_id = $1`,
      [id]
    );

    return { ...v, allocations };
  }

  static async createVoucher(companyId: number, uid: number, d: any) {
    return tx(async c => {
      const { rows: [bank] } = await c.query(
        `SELECT subtype FROM accounts WHERE id = $1 AND company_id = $2 AND active = true`,
        [d.bank_account_id, companyId]
      );

      if (!bank || !['BANK', 'CASH'].includes(bank.subtype)) {
        throw new HttpError(422, 'Choose a bank or cash account');
      }

      const gross = r2(d.amount + (d.tds_amount ?? 0));
      const allocTotal = r2(
        (d.allocations ?? []).reduce((s: number, a: any) => s + a.amount, 0)
      );

      if (allocTotal > gross) {
        throw new HttpError(422, `Allocated ${allocTotal} is more than the voucher value ${gross}`);
      }

      const docKind = d.kind === 'RECEIPT' ? 'SALE' : 'PURCHASE';
      for (const a of d.allocations ?? []) {
        const { rows: [i] } = await c.query(
          `SELECT kind, party_id, status FROM invoices WHERE id = $1 AND company_id = $2`,
          [a.invoice_id, companyId]
        );
        if (!i || i.kind !== docKind || i.party_id !== d.party_id) {
          throw new HttpError(422, 'Allocation must be to an open document of the same party');
        }
      }

      const prefix = d.kind === 'RECEIPT' ? 'RCT' : 'PAY';
      const { rows: [v] } = await c.query(
        `INSERT INTO vouchers(company_id, kind, voucher_no, voucher_date, party_id, 
                              bank_account_id, amount, tds_amount, mode, reference, notes, created_by)
         VALUES ($1, $2, next_doc_no($1, $3, $4), $4, $5, $6, $7, $8, $9, $10, $11, $12) 
         RETURNING *`,
        [
          companyId,
          d.kind,
          prefix,
          d.voucher_date,
          d.party_id,
          d.bank_account_id,
          d.amount,
          d.tds_amount ?? 0,
          d.mode,
          d.reference,
          d.notes,
          uid,
        ]
      );

      const tds = d.tds_amount ?? 0;
      const lines =
        d.kind === 'RECEIPT'
          ? [
              { account_id: d.bank_account_id, debit: d.amount },
              { key: 'TDS_REC', debit: tds },
              { key: 'AR', party_id: d.party_id, credit: gross },
            ]
          : [
              { key: 'AP', party_id: d.party_id, debit: gross },
              { account_id: d.bank_account_id, credit: d.amount },
              { key: 'TDS_PAY', credit: tds },
            ];

      const je = await LedgerService.postJournal(c, companyId, uid, {
        date: d.voucher_date,
        source: d.kind,
        source_id: v.id,
        narration: `${d.kind === 'RECEIPT' ? 'Receipt' : 'Payment'} ${v.voucher_no}${
          d.reference ? ' · ' + d.reference : ''
        }`,
        lines,
      });

      await c.query(`UPDATE vouchers SET journal_entry_id = $2 WHERE id = $1`, [v.id, je]);

      for (const a of d.allocations ?? []) {
        if (a.amount > 0) {
          await c.query(
            `INSERT INTO allocations(voucher_id, invoice_id, amount) VALUES ($1, $2, $3)`,
            [v.id, a.invoice_id, a.amount]
          );
        }
      }

      return { ...v, journal_entry_id: je, unallocated: r2(gross - allocTotal) };
    });
  }

  static async cancelVoucher(companyId: number, uid: number, id: number, reason: string) {
    return tx(async c => {
      const { rows: [v] } = await c.query(
        `SELECT * FROM vouchers WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [id, companyId]
      );
      if (!v) throw new HttpError(404, 'Not found');
      if (v.status === 'CANCELLED') throw new HttpError(422, 'Already cancelled');

      const { rows: [m] } = await c.query(
        `SELECT COUNT(*)::int n 
         FROM bank_statement_lines b 
         JOIN journal_lines l ON l.id = b.matched_line_id 
         WHERE l.entry_id = $1`,
        [v.journal_entry_id]
      );
      if (m.n) {
        throw new HttpError(422, 'This voucher is reconciled with a bank statement line; unmatch it first');
      }

      const effectiveDate = today() < v.voucher_date ? v.voucher_date : today();
      await LedgerService.reverseJournal(c, companyId, uid, v.journal_entry_id, effectiveDate, reason || 'Voucher cancelled');

      await c.query(`UPDATE vouchers SET status = 'CANCELLED' WHERE id = $1`, [id]);

      const { rows: inv } = await c.query(
        `SELECT DISTINCT invoice_id FROM allocations WHERE voucher_id = $1`,
        [id]
      );

      for (const i of inv) {
        await c.query(`SELECT recompute_invoice_status($1)`, [i.invoice_id]);
      }

      return { ok: true };
    });
  }
}

