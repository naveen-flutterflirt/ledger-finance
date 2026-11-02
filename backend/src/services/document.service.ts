import { PoolClient } from 'pg';
import { query, one, tx } from '../config/database.js';
import { HttpError } from '../middleware/error.js';
import { computeGst } from '../utils/gst.js';
import { LedgerService } from './ledger.service.js';
import { r2 } from '../utils/money.js';
import { addDays, today } from '../utils/dates.js';
import { DocKind } from '../models/types.js';

const PREFIX: Record<DocKind, string> = {
  SALE: 'INV',
  PURCHASE: 'BILL',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE: 'DN',
};

const KINDS: Record<string, DocKind> = {
  sales: 'SALE',
  purchases: 'PURCHASE',
  'credit-notes': 'CREDIT_NOTE',
  'debit-notes': 'DEBIT_NOTE',
};

export const kindOf = (k: string): DocKind => {
  const v = KINDS[k];
  if (!v) throw new HttpError(404, 'Unknown document type');
  return v;
};

const isSalesSide = (k: DocKind) => k === 'SALE' || k === 'CREDIT_NOTE';

export class DocumentService {
  static async listDocs(
    companyId: number,
    kind: DocKind,
    status?: string,
    partyId?: number
  ) {
    return query(
      `SELECT id, kind, doc_no, doc_date, due_date, party_id, party_name, party_gstin, 
              place_of_supply, status, is_opening, taxable_value, cgst, sgst, igst, 
              total, settled, outstanding, days_overdue, against_id
       FROM v_invoice_outstanding 
       WHERE company_id = $1 AND kind = $2
         AND ($3::text IS NULL OR ($3 = 'OPEN' AND status IN ('POSTED','PARTIAL')) OR status::text = $3)
         AND ($4::int IS NULL OR party_id = $4)
       ORDER BY doc_date DESC, id DESC 
       LIMIT 500`,
      [companyId, kind, status ?? null, partyId ?? null]
    );
  }

  static async getDoc(companyId: number, id: number) {
    const d = await one(
      `SELECT v.*, p.address AS party_address, p.state_code AS party_state, p.pan AS party_pan,
              je.entry_no, a.doc_no AS against_no
       FROM v_invoice_outstanding v 
       JOIN parties p ON p.id = v.party_id
       LEFT JOIN journal_entries je ON je.id = v.journal_entry_id 
       LEFT JOIN invoices a ON a.id = v.against_id
       WHERE v.company_id = $1 AND v.id = $2`,
      [companyId, id]
    );

    if (!d) throw new HttpError(404, 'Document not found');

    const lines = await query(
      `SELECT l.*, a.code AS account_code, a.name AS account_name 
       FROM invoice_lines l
       JOIN accounts a ON a.id = l.account_id 
       WHERE invoice_id = $1 
       ORDER BY l.id`,
      [id]
    );

    const settlements = await query(
      `SELECT a.amount, COALESCE(v.voucher_no, n.doc_no) AS ref, 
              COALESCE(v.voucher_date, n.doc_date) AS date,
              CASE WHEN v.id IS NOT NULL THEN v.kind ELSE n.kind END AS via
       FROM allocations a 
       LEFT JOIN vouchers v ON v.id = a.voucher_id 
       LEFT JOIN invoices n ON n.id = a.note_id
       WHERE a.invoice_id = $1 
         AND COALESCE(v.status, 'POSTED') = 'POSTED' 
         AND COALESCE(n.status::text, 'POSTED') <> 'CANCELLED' 
       ORDER BY date`,
      [id]
    );

    const company = await one(
      `SELECT name, legal_name, gstin, pan, state_code, address, email, phone 
       FROM companies 
       WHERE id = $1`,
      [companyId]
    );

    return { ...d, lines, settlements, company };
  }

  private static async writeLines(
    c: PoolClient,
    companyId: number,
    invId: number,
    kind: DocKind,
    d: any
  ) {
    const { rows: [co] } = await c.query(
      `SELECT state_code FROM companies WHERE id = $1`,
      [companyId]
    );

    for (const l of d.lines) {
      const { rows: [a] } = await c.query(
        `SELECT type, subtype FROM accounts WHERE id = $1 AND company_id = $2 AND active = true`,
        [l.account_id, companyId]
      );
      if (!a) throw new HttpError(422, 'Unknown account on a line');

      if (isSalesSide(kind) && a.type !== 'INCOME') {
        throw new HttpError(422, 'Sales lines must post to an income account');
      }
      if (
        !isSalesSide(kind) &&
        !(a.type === 'EXPENSE' || ['FIXED_ASSET', 'INVENTORY', 'CURRENT_ASSET'].includes(a.subtype))
      ) {
        throw new HttpError(422, 'Purchase lines must post to an expense, inventory or fixed-asset account');
      }
    }

    const g = computeGst(d.lines, co.state_code, d.place_of_supply, !!d.is_opening);

    await c.query(`DELETE FROM invoice_lines WHERE invoice_id = $1`, [invId]);

    for (const l of g.lines as any[]) {
      await c.query(
        `INSERT INTO invoice_lines(invoice_id, item_id, description, hsn_sac, qty, rate, discount, 
                                   gst_rate, account_id, taxable, cgst, sgst, igst)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          invId,
          l.item_id ?? null,
          l.description,
          l.hsn_sac ?? null,
          l.qty,
          l.rate,
          l.discount ?? 0,
          d.is_opening ? 0 : l.gst_rate,
          l.account_id,
          l.taxable,
          l.cgst,
          l.sgst,
          l.igst,
        ]
      );
    }

    await c.query(
      `UPDATE invoices 
       SET taxable_value = $2, cgst = $3, sgst = $4, igst = $5, round_off = $6, total = $7 
       WHERE id = $1`,
      [invId, g.taxable, g.cgst, g.sgst, g.igst, g.round_off, g.total]
    );

    return g;
  }

  static async createDoc(companyId: number, uid: number, kind: DocKind, d: any) {
    const id = await tx(async c => {
      const { rows: [p] } = await c.query(
        `SELECT * FROM parties WHERE id = $1 AND company_id = $2`,
        [d.party_id, companyId]
      );
      if (!p) throw new HttpError(422, 'Unknown party');

      if (d.against_id) {
        const { rows: [o] } = await c.query(
          `SELECT kind, status, party_id FROM invoices WHERE id = $1 AND company_id = $2`,
          [d.against_id, companyId]
        );
        const need = kind === 'CREDIT_NOTE' ? 'SALE' : 'PURCHASE';
        if (!o || o.kind !== need || o.party_id !== d.party_id) {
          throw new HttpError(422, `Note must reference a ${need.toLowerCase()} document of the same party`);
        }
      }

      const due = d.due_date ?? addDays(d.doc_date, p.credit_days ?? 30);

      const { rows: [inv] } = await c.query(
        `INSERT INTO invoices(company_id, kind, doc_no, doc_date, due_date, party_id, 
                              place_of_supply, against_id, reverse_charge, is_opening, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
         RETURNING id`,
        [
          companyId,
          kind,
          kind === 'PURCHASE' ? d.doc_no : null,
          d.doc_date,
          due,
          d.party_id,
          d.place_of_supply,
          d.against_id ?? null,
          !!d.reverse_charge,
          !!d.is_opening,
          d.notes ?? null,
          uid,
        ]
      );

      await this.writeLines(c, companyId, inv.id, kind, d);

      if (d.post) {
        await this.postDocTx(c, companyId, uid, inv.id);
      }

      return inv.id;
    });

    return this.getDoc(companyId, id);
  }

  static async updateDraft(companyId: number, id: number, d: any) {
    await tx(async c => {
      const { rows: [inv] } = await c.query(
        `SELECT * FROM invoices WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [id, companyId]
      );
      if (!inv) throw new HttpError(404, 'Not found');
      if (inv.status !== 'DRAFT') {
        throw new HttpError(422, 'Only drafts can be edited; cancel and re-issue a posted document');
      }

      await c.query(
        `UPDATE invoices 
         SET doc_no = $2, doc_date = $3, due_date = $4, party_id = $5, place_of_supply = $6, 
             reverse_charge = $7, notes = $8 
         WHERE id = $1`,
        [
          id,
          inv.kind === 'PURCHASE' ? d.doc_no : null,
          d.doc_date,
          d.due_date ?? inv.due_date,
          d.party_id,
          d.place_of_supply,
          !!d.reverse_charge,
          d.notes ?? null,
        ]
      );

      await this.writeLines(c, companyId, id, inv.kind, { ...d, is_opening: inv.is_opening });
    });

    return this.getDoc(companyId, id);
  }

  private static async postDocTx(c: PoolClient, companyId: number, uid: number, id: number) {
    const { rows: [inv] } = await c.query(
      `SELECT * FROM invoices WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [id, companyId]
    );
    if (!inv) throw new HttpError(404, 'Not found');
    if (inv.status !== 'DRAFT') {
      throw new HttpError(422, `Document is already ${inv.status}`);
    }

    const { rows: lines } = await c.query(
      `SELECT * FROM invoice_lines WHERE invoice_id = $1`,
      [id]
    );
    if (!lines.length) throw new HttpError(422, 'Add at least one line');
    if (Number(inv.total) <= 0) throw new HttpError(422, 'Document total must be greater than zero');

    const kind: DocKind = inv.kind;
    let docNo = inv.doc_no;
    if (kind !== 'PURCHASE' || !docNo) {
      const { rows: [n] } = await c.query(
        `SELECT next_doc_no($1, $2, $3) AS no`,
        [companyId, PREFIX[kind], inv.doc_date]
      );
      docNo = n.no;
    }

    const total = Number(inv.total);
    const P = inv.party_id;
    const L: any[] = [];
    const sign = kind === 'SALE' || kind === 'PURCHASE' ? 1 : -1;

    if (inv.is_opening) {
      if (isSalesSide(kind)) {
        L.push({ key: 'AR', party_id: P, debit: total * sign }, { key: 'OBE', credit: total * sign });
      } else {
        L.push({ key: 'OBE', debit: total * sign }, { key: 'AP', party_id: P, credit: total * sign });
      }
    } else if (isSalesSide(kind)) {
      L.push({ key: 'AR', party_id: P, debit: total * sign });
      for (const l of lines) {
        L.push({ account_id: l.account_id, credit: Number(l.taxable) * sign });
      }
      L.push(
        { key: 'OUT_CGST', credit: Number(inv.cgst) * sign },
        { key: 'OUT_SGST', credit: Number(inv.sgst) * sign },
        { key: 'OUT_IGST', credit: Number(inv.igst) * sign },
        { key: 'ROUND_OFF', credit: Number(inv.round_off) * sign }
      );
    } else {
      for (const l of lines) {
        L.push({ account_id: l.account_id, debit: Number(l.taxable) * sign });
      }
      L.push(
        { key: 'IN_CGST', debit: Number(inv.cgst) * sign },
        { key: 'IN_SGST', debit: Number(inv.sgst) * sign },
        { key: 'IN_IGST', debit: Number(inv.igst) * sign }
      );

      if (inv.reverse_charge) {
        const tax = r2(Number(inv.cgst) + Number(inv.sgst) + Number(inv.igst));
        L.push(
          { key: 'OUT_CGST', credit: Number(inv.cgst) * sign },
          { key: 'OUT_SGST', credit: Number(inv.sgst) * sign },
          { key: 'OUT_IGST', credit: Number(inv.igst) * sign },
          { key: 'AP', party_id: P, credit: r2(total - tax - Number(inv.round_off)) * sign }
        );
      } else {
        L.push(
          { key: 'ROUND_OFF', debit: Number(inv.round_off) * sign },
          { key: 'AP', party_id: P, credit: total * sign }
        );
      }
    }

    const labelMap: Record<DocKind, string> = {
      SALE: 'Sales invoice',
      PURCHASE: 'Purchase bill',
      CREDIT_NOTE: 'Credit note',
      DEBIT_NOTE: 'Debit note',
    };

    const source = kind === 'SALE' ? 'SALES_INVOICE' : kind === 'PURCHASE' ? 'PURCHASE_BILL' : kind;

    const je = await LedgerService.postJournal(c, companyId, uid, {
      date: inv.doc_date,
      source,
      source_id: id,
      narration: `${labelMap[kind]} ${docNo}${inv.is_opening ? ' (opening balance)' : ''}`,
      lines: L,
    });

    await c.query(
      `UPDATE invoices SET doc_no = $2, status = 'POSTED', journal_entry_id = $3 WHERE id = $1`,
      [id, docNo, je]
    );

    // Credit and Debit notes automatically settle against the original base document
    if ((kind === 'CREDIT_NOTE' || kind === 'DEBIT_NOTE') && inv.against_id) {
      const { rows: [o] } = await c.query(
        `SELECT outstanding FROM v_invoice_outstanding WHERE id = $1`,
        [inv.against_id]
      );
      const amt = Math.min(total, Number(o.outstanding));
      if (amt > 0) {
        await c.query(
          `INSERT INTO allocations(note_id, invoice_id, amount) VALUES ($1, $2, $3)`,
          [id, inv.against_id, amt]
        );
        await c.query(
          `INSERT INTO allocations(note_id, invoice_id, amount) VALUES ($1, $1, $2)`,
          [id, amt]
        );
      }
    }

    return je;
  }

  static async postDoc(companyId: number, uid: number, id: number) {
    await tx(c => this.postDocTx(c, companyId, uid, id));
    return this.getDoc(companyId, id);
  }

  static async cancelDoc(companyId: number, uid: number, id: number, reason: string) {
    await tx(async c => {
      const { rows: [inv] } = await c.query(
        `SELECT * FROM invoices WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [id, companyId]
      );
      if (!inv) throw new HttpError(404, 'Not found');
      if (inv.status === 'CANCELLED') throw new HttpError(422, 'Already cancelled');

      if (inv.status !== 'DRAFT') {
        const { rows: [s] } = await c.query(
          `SELECT COUNT(*)::int n FROM allocations WHERE invoice_id = $1 AND (note_id IS NULL OR note_id <> $1)`,
          [id]
        );
        if (s.n > 0) {
          throw new HttpError(422, 'Payments or notes are applied to this document; cancel those first');
        }

        const effectiveDate = today() < inv.doc_date ? inv.doc_date : today();
        await LedgerService.reverseJournal(c, companyId, uid, inv.journal_entry_id, effectiveDate, reason || 'Document cancelled');

        const { rows: applied } = await c.query(
          `DELETE FROM allocations WHERE note_id = $1 RETURNING invoice_id`,
          [id]
        );

        await c.query(`UPDATE invoices SET status = 'CANCELLED' WHERE id = $1`, [id]);

        for (const a of applied) {
          if (a.invoice_id !== id) {
            await c.query(`SELECT recompute_invoice_status($1)`, [a.invoice_id]);
          }
        }
      } else {
        await c.query(`UPDATE invoices SET status = 'CANCELLED' WHERE id = $1`, [id]);
      }
    });

    return this.getDoc(companyId, id);
  }
}

