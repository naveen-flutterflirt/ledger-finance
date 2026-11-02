import { Request, Response } from 'express';
import { BankService } from '../services/bank.service.js';
import { importSchema } from '../models/schemas.js';
import { today } from '../utils/dates.js';
import { z } from 'zod';
import { HttpError } from '../middleware/error.js';

export class BankController {
  static async importStatement(req: Request, res: Response) {
    const data = importSchema.parse(req.body);
    const result = await BankService.importStatement(
      req.session!.companyId,
      data.bank_account_id,
      data.rows
    );
    res.json(result);
  }

  static async autoMatch(req: Request, res: Response) {
    const data = z.object({ bank_account_id: z.coerce.number() }).parse(req.body);
    const result = await BankService.autoMatch(
      req.session!.companyId,
      data.bank_account_id
    );
    res.json(result);
  }

  static async match(req: Request, res: Response) {
    const data = z.object({ line_id: z.coerce.number().nullable() }).parse(req.body);
    const result = await BankService.matchLine(
      req.session!.companyId,
      Number(req.params.id),
      data.line_id
    );
    res.json(result);
  }

  static async createFromStatement(req: Request, res: Response) {
    const data = z
      .object({
        account_id: z.coerce.number(),
        party_id: z.coerce.number().nullable().optional(),
        narration: z.string().optional(),
      })
      .parse(req.body);

    const result = await BankService.createFromStatement(
      req.session!.companyId,
      req.session!.uid,
      Number(req.params.id),
      data
    );
    res.json(result);
  }

  static async getReconciliation(req: Request, res: Response) {
    const bankAccountId = req.query.bank_account_id
      ? Number(req.query.bank_account_id)
      : undefined;
    if (!bankAccountId) throw new HttpError(400, 'bank_account_id is required');

    const asOf = (req.query.as_of as string) ?? today();
    const result = await BankService.reconciliation(
      req.session!.companyId,
      bankAccountId,
      asOf
    );
    res.json(result);
  }

  static async getCandidates(req: Request, res: Response) {
    const list = await BankService.candidatesFor(
      req.session!.companyId,
      Number(req.params.id)
    );
    res.json(list);
  }
}

