import { Request, Response } from 'express';
import { ReportService } from '../services/report.service.js';
import { today, fyStart } from '../utils/dates.js';
import { HttpError } from '../middleware/error.js';

export class ReportController {
  static async dashboard(req: Request, res: Response) {
    const data = await ReportService.dashboard(req.session!.companyId);
    res.json(data);
  }

  static async trialBalance(req: Request, res: Response) {
    const companyId = req.session!.companyId;
    const from = (req.query.from as string) ?? fyStart();
    const to = (req.query.to as string) ?? today();
    const data = await ReportService.trialBalance(companyId, from, to);
    res.json(data);
  }

  static async profitLoss(req: Request, res: Response) {
    const companyId = req.session!.companyId;
    const from = (req.query.from as string) ?? fyStart();
    const to = (req.query.to as string) ?? today();
    const data = await ReportService.profitLoss(companyId, from, to);
    res.json(data);
  }

  static async balanceSheet(req: Request, res: Response) {
    const companyId = req.session!.companyId;
    const asOf = (req.query.as_of as string) ?? today();
    const data = await ReportService.balanceSheet(companyId, asOf);
    res.json(data);
  }

  static async cashFlow(req: Request, res: Response) {
    const companyId = req.session!.companyId;
    const from = (req.query.from as string) ?? fyStart();
    const to = (req.query.to as string) ?? today();
    const data = await ReportService.cashFlow(companyId, from, to);
    res.json(data);
  }

  static async generalLedger(req: Request, res: Response) {
    const companyId = req.session!.companyId;
    const accountId = Number(req.query.account_id);
    if (!accountId) throw new HttpError(400, 'account_id is required');

    const from = (req.query.from as string) ?? fyStart();
    const to = (req.query.to as string) ?? today();
    const data = await ReportService.generalLedger(companyId, accountId, from, to);
    res.json(data);
  }

  static async partyLedger(req: Request, res: Response) {
    const companyId = req.session!.companyId;
    const partyId = Number(req.query.party_id);
    if (!partyId) throw new HttpError(400, 'party_id is required');

    const from = (req.query.from as string) ?? fyStart();
    const to = (req.query.to as string) ?? today();
    const data = await ReportService.partyLedger(companyId, partyId, from, to);
    res.json(data);
  }

  static async ageing(req: Request, res: Response) {
    const companyId = req.session!.companyId;
    const side = (req.query.side as 'AR' | 'AP') === 'AP' ? 'AP' : 'AR';
    const asOf = (req.query.as_of as string) ?? today();
    const data = await ReportService.ageing(companyId, side, asOf);
    res.json(data);
  }

  static async gstReturns(req: Request, res: Response) {
    const companyId = req.session!.companyId;
    const from = (req.query.from as string) ?? today().slice(0, 8) + '01';
    const to = (req.query.to as string) ?? today();
    const data = await ReportService.gstReturns(companyId, from, to);
    res.json(data);
  }

  static async dayBook(req: Request, res: Response) {
    const companyId = req.session!.companyId;
    const date = (req.query.date as string) ?? today();
    const data = await ReportService.dayBook(companyId, date);
    res.json(data);
  }

  static async closeYear(req: Request, res: Response) {
    const companyId = req.session!.companyId;
    const uid = req.session!.uid;
    const fyId = Number(req.params.id);
    const result = await ReportService.closeYear(companyId, uid, fyId);
    res.json(result);
  }
}

