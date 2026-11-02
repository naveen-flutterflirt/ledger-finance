import { Request, Response } from 'express';
import { AssetService } from '../services/asset.service.js';
import { assetSchema } from '../models/schemas.js';
import { z } from 'zod';
import { date, month } from '../models/schemas.js';

export class AssetController {
  static async list(req: Request, res: Response) {
    const list = await AssetService.assetRegister(req.session!.companyId);
    res.json(list);
  }

  static async getSchedule(req: Request, res: Response) {
    const schedule = await AssetService.assetSchedule(
      req.session!.companyId,
      Number(req.params.id)
    );
    res.json(schedule);
  }

  static async create(req: Request, res: Response) {
    const data = assetSchema.parse(req.body);
    const asset = await AssetService.createAsset(
      req.session!.companyId,
      req.session!.uid,
      data
    );
    res.status(201).json(asset);
  }

  static async runDepreciation(req: Request, res: Response) {
    const data = z.object({ period: month }).parse(req.body);
    const result = await AssetService.runDepreciation(
      req.session!.companyId,
      req.session!.uid,
      data.period
    );
    res.json(result);
  }

  static async dispose(req: Request, res: Response) {
    const data = z
      .object({
        date,
        sale_amount: z.coerce.number().min(0),
        account_id: z.coerce.number().optional(),
      })
      .parse(req.body);

    const result = await AssetService.disposeAsset(
      req.session!.companyId,
      req.session!.uid,
      Number(req.params.id),
      data
    );
    res.json(result);
  }
}

