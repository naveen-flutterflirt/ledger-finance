import { Request, Response } from 'express';
import { PayrollService } from '../services/payroll.service.js';
import { month, date } from '../models/schemas.js';
import { z } from 'zod';

export class PayrollController {
  static async listRuns(req: Request, res: Response) {
    const list = await PayrollService.listRuns(req.session!.companyId);
    res.json(list);
  }

  static async getRun(req: Request, res: Response) {
    const run = await PayrollService.getRun(
      req.session!.companyId,
      Number(req.params.id)
    );
    res.json(run);
  }

  static async createRun(req: Request, res: Response) {
    const data = z.object({ period: month }).parse(req.body);
    const run = await PayrollService.createRun(
      req.session!.companyId,
      req.session!.uid,
      data.period
    );
    res.status(201).json(run);
  }

  static async updateSlip(req: Request, res: Response) {
    const data = z
      .object({
        lop_days: z.coerce.number().min(0),
        bonus: z.coerce.number().min(0).default(0),
        other_deduction: z.coerce.number().min(0).default(0),
      })
      .parse(req.body);

    const result = await PayrollService.updateSlip(
      req.session!.companyId,
      Number(req.params.id),
      Number(req.params.emp),
      data
    );
    res.json(result);
  }

  static async postRun(req: Request, res: Response) {
    const result = await PayrollService.postRun(
      req.session!.companyId,
      req.session!.uid,
      Number(req.params.id)
    );
    res.json(result);
  }

  static async payRun(req: Request, res: Response) {
    const data = z
      .object({
        bank_account_id: z.coerce.number(),
        date,
      })
      .parse(req.body);

    const result = await PayrollService.payRun(
      req.session!.companyId,
      req.session!.uid,
      Number(req.params.id),
      data
    );
    res.json(result);
  }

  static async getPayslip(req: Request, res: Response) {
    const s = req.session!;
    const payslip = await PayrollService.getPayslip(
      s.companyId,
      Number(req.params.id),
      s.role === 'EMPLOYEE' ? s.uid : undefined
    );
    res.json(payslip);
  }

  static async myPayslips(req: Request, res: Response) {
    const s = req.session!;
    const list = await PayrollService.myPayslips(s.companyId, s.uid);
    res.json(list);
  }
}

