import { PoolClient } from 'pg';
import { query, one } from '../config/database.js';
import { HttpError } from '../middleware/error.js';
import { r2 } from '../utils/money.js';
import { JournalEntryPayload, JournalLine } from '../models/types.js';

export class LedgerService {
  /**
   * Resolve a system-mapped account ID (e.g. AR, AP, OUT_CGST)
   */
  static async accountByKey(
    c: PoolClient,
    companyId: number,
    key: string
  ): Promise<number> {
    const { rows } = await c.query(
      `SELECT id FROM accounts WHERE company_id = $1 AND system_key = $2`,
      [companyId, key]
    );
    if (!rows[0]) {
      throw new HttpError(422, `System account "${key}" is missing in the chart of accounts`);
    }
    return rows[0].id;
  }

  /**
   * Post a balanced journal entry inside a database transaction.
   * Enforces that debits equal credits and merges duplicate account lines.
   */
  static async postJournal(
    c: PoolClient,
    companyId: number,
    uid: number | null,
    e: JournalEntryPayload
  ): Promise<number> {
    type MergedLine = {
      account_id: number;
      party_id: number | null;
      net: number;
      narration: string | null;
    };

    const merged: MergedLine[] = [];

    for (const l of e.lines) {
      const net = r2((l.debit ?? 0) - (l.credit ?? 0));
      if (net === 0) continue;

      const account_id = l.account_id ?? (await this.accountByKey(c, companyId, l.key!));
      const party_id = l.party_id ?? null;
      const narration = l.narration ?? null;

      const same = merged.find(
        x =>
          x.account_id === account_id &&
          x.party_id === party_id &&
          x.narration === narration &&
          Math.sign(x.net) === Math.sign(net)
      );

      if (same) {
        same.net = r2(same.net + net);
      } else {
        merged.push({ account_id, party_id, net, narration });
      }
    }

    const lines = merged.map(m => ({
      ...m,
      debit: m.net > 0 ? m.net : 0,
      credit: m.net < 0 ? -m.net : 0,
    }));

    const dr = r2(lines.reduce((s, l) => s + l.debit, 0));
    const cr = r2(lines.reduce((s, l) => s + l.credit, 0));

    if (lines.length < 2) {
      throw new HttpError(422, 'A journal entry needs at least two non-zero lines');
    }
    if (dr !== cr) {
      throw new HttpError(422, `Entry is not balanced (debit ${dr} ≠ credit ${cr})`);
    }

    // Insert journal master
    const { rows: jeRows } = await c.query(
      `INSERT INTO journal_entries(company_id, entry_no, entry_date, source, source_id, narration, created_by)
       VALUES ($1, next_doc_no($1, 'JV', $2), $2, $3, $4, $5, $6) 
       RETURNING id`,
      [companyId, e.date, e.source, e.source_id ?? null, e.narration ?? null, uid]
    );

    const jeId = jeRows[0].id;

    // Insert journal detail lines
    for (const l of lines) {
      await c.query(
        `INSERT INTO journal_lines(entry_id, account_id, party_id, debit, credit, narration)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [jeId, l.account_id, l.party_id, l.debit, l.credit, l.narration]
      );
    }

    return jeId;
  }

  /**
   * Reverse an existing journal with a bidirectional audit trail
   */
  static async reverseJournal(
    c: PoolClient,
    companyId: number,
    uid: number | null,
    entryId: number,
    date: string,
    reason: string
  ): Promise<number> {
    const { rows: eRows } = await c.query(
      `SELECT * FROM journal_entries WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [entryId, companyId]
    );

    const e = eRows[0];
    if (!e) throw new HttpError(404, 'Journal entry not found');
    if (e.reversed_by) throw new HttpError(422, 'Entry is already reversed');
    if (e.reversal_of) throw new HttpError(422, 'A reversal entry cannot itself be reversed');

    const { rows: lines } = await c.query(
      `SELECT * FROM journal_lines WHERE entry_id = $1`,
      [entryId]
    );

    // Swap debits and credits
    const revId = await this.postJournal(c, companyId, uid, {
      date,
      source: 'REVERSAL',
      source_id: e.source_id,
      narration: `Reversal of ${e.entry_no}: ${reason}`,
      lines: lines.map((l: any) => ({
        account_id: l.account_id,
        party_id: l.party_id,
        debit: Number(l.credit),
        credit: Number(l.debit),
        narration: l.narration,
      })),
    });

    await c.query(`UPDATE journal_entries SET reversal_of = $2 WHERE id = $1`, [revId, entryId]);
    await c.query(`UPDATE journal_entries SET reversed_by = $2 WHERE id = $1`, [entryId, revId]);

    return revId;
  }

  static async listJournals(
    companyId: number,
    f: { from?: string; to?: string; source?: string; q?: string }
  ) {
    return query(
      `SELECT e.id, e.entry_no, e.entry_date, e.source, e.narration, e.reversed_by, e.reversal_of, 
              u.name AS created_by,
              (SELECT SUM(debit) FROM journal_lines WHERE entry_id = e.id) AS amount
       FROM journal_entries e 
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.company_id = $1 
         AND ($2::date IS NULL OR e.entry_date >= $2) 
         AND ($3::date IS NULL OR e.entry_date <= $3)
         AND ($4::text IS NULL OR e.source::text = $4) 
         AND ($5::text IS NULL OR e.narration ILIKE '%'||$5||'%' OR e.entry_no ILIKE '%'||$5||'%')
       ORDER BY e.entry_date DESC, e.id DESC 
       LIMIT 300`,
      [companyId, f.from ?? null, f.to ?? null, f.source ?? null, f.q ?? null]
    );
  }

  static async getJournal(companyId: number, id: number) {
    const e = await one(
      `SELECT e.*, u.name AS created_by_name, r.entry_no AS reversed_by_no, o.entry_no AS reversal_of_no 
       FROM journal_entries e
       LEFT JOIN users u ON u.id = e.created_by 
       LEFT JOIN journal_entries r ON r.id = e.reversed_by
       LEFT JOIN journal_entries o ON o.id = e.reversal_of
       WHERE e.company_id = $1 AND e.id = $2`,
      [companyId, id]
    );

    if (!e) throw new HttpError(404, 'Journal entry not found');

    const lines = await query(
      `SELECT l.*, a.code, a.name AS account, p.name AS party 
       FROM journal_lines l 
       JOIN accounts a ON a.id = l.account_id
       LEFT JOIN parties p ON p.id = l.party_id 
       WHERE entry_id = $1 
       ORDER BY l.debit DESC, l.id`,
      [id]
    );

    return { ...e, lines };
  }
}

