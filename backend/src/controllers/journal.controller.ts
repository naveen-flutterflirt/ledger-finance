import { Request, Response } from 'express';
import { LedgerService } from '../services/ledger.service.js';
import { journalSchema, reasonSchema } from '../models/schemas.js';
import { tx } from '../config/database.js';
import { HttpError } from '../middleware/error.js';
import { today } from '../utils/dates.js';

export class JournalController {
  static async list(req: Request, res: Response) {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const source = req.query.source as string | undefined;
    const q = req.query.q as string | undefined;

    const list = await LedgerService.listJournals(req.session!.companyId, {
      from,
      to,
      source,
      q,
    });
    res.json(list);
  }

  static async getOne(req: Request, res: Response) {
    const journal = await LedgerService.getJournal(
      req.session!.companyId,
      Number(req.params.id)
    );
    res.json(journal);
  }

  static async create(req: Request, res: Response) {
    const d = journalSchema.parse(req.body);
    const companyId = req.session!.companyId;
    const uid = req.session!.uid;

    const result = await tx(async c => {
      const lines: any[] = [...d.lines];

      if (d.source === 'OPENING') {
        const diff = lines.reduce(
          (s, l) => s + (l.debit ?? 0) - (l.credit ?? 0),
          0
        );
        if (Math.abs(diff) >= 0.01) {
          lines.push({
            key: 'OBE',
            debit: diff < 0 ? -diff : 0,
            credit: diff > 0 ? diff : 0,
            narration: 'Balancing to opening balance equity',
          });
        }
      }

      if (d.source === 'CONTRA') {
        const { rows } = await c.query(
          `SELECT COUNT(*)::int n FROM accounts 
           WHERE id = ANY($1) AND subtype NOT IN ('BANK','CASH')`,
          [lines.map(l => l.account_id).filter(Boolean)]
        );
        if (rows[0].n) {
          throw new HttpError(422, 'Contra entries may only use bank and cash accounts');
        }
      }

      const id = await LedgerService.postJournal(c, companyId, uid, {
        date: d.date,
        source: d.source,
        narration: d.narration,
        lines,
      });

      return { id };
    });

    res.status(201).json(result);
  }

  static async reverse(req: Request, res: Response) {
    const data = reasonSchema.parse(req.body);
    const companyId = req.session!.companyId;
    const uid = req.session!.uid;
    const id = Number(req.params.id);

    const result = await tx(async c => {
      const { rows: [e] } = await c.query(
        `SELECT source FROM journal_entries WHERE id = $1 AND company_id = $2`,
        [id, companyId]
      );
      if (!e) throw new HttpError(404, 'Not found');

      if (!['MANUAL', 'CONTRA', 'OPENING', 'BANK_ENTRY'].includes(e.source)) {
        throw new HttpError(
          422,
          `This entry was created by a ${e.source
            .replace('_', ' ')
            .toLowerCase()} — cancel it from that document instead`
        );
      }

      return {
        id: await LedgerService.reverseJournal(c, companyId, uid, id, today(), data.reason),
      };
    });

    res.json(result);
  }
}
