import { Request, Response } from 'express';
import { VoucherService } from '../services/voucher.service.js';
import { voucherSchema, reasonSchema } from '../models/schemas.js';

export class VoucherController {
  static async list(req: Request, res: Response) {
    const kind = req.query.kind as string | undefined;
    const list = await VoucherService.listVouchers(req.session!.companyId, kind);
    res.json(list);
  }

  static async getOne(req: Request, res: Response) {
    const voucher = await VoucherService.getVoucher(
      req.session!.companyId,
      Number(req.params.id)
    );
    res.json(voucher);
  }

  static async create(req: Request, res: Response) {
    const data = voucherSchema.parse(req.body);
    const voucher = await VoucherService.createVoucher(
      req.session!.companyId,
      req.session!.uid,
      data
    );
    res.status(201).json(voucher);
  }

  static async cancel(req: Request, res: Response) {
    const data = reasonSchema.parse(req.body);
    const result = await VoucherService.cancelVoucher(
      req.session!.companyId,
      req.session!.uid,
      Number(req.params.id),
      data.reason
    );
    res.json(result);
  }
}

