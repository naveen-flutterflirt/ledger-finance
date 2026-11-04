import { Request, Response } from 'express';
import { DocumentService, kindOf } from '../services/document.service.js';
import { docSchema, reasonSchema } from '../models/schemas.js';

export class DocumentController {
  static async list(req: Request, res: Response) {
    const kind = kindOf(req.params.kind);
    const status = req.query.status as string | undefined;
    const partyId = req.query.party_id ? Number(req.query.party_id) : undefined;

    const list = await DocumentService.listDocs(
      req.session!.companyId,
      kind,
      status,
      partyId
    );
    res.json(list);
  }

  static async getOne(req: Request, res: Response) {
    const doc = await DocumentService.getDoc(
      req.session!.companyId,
      Number(req.params.id)
    );
    res.json(doc);
  }

  static async create(req: Request, res: Response) {
    const kind = kindOf(req.params.kind);
    const data = docSchema.parse(req.body);

    const doc = await DocumentService.createDoc(
      req.session!.companyId,
      req.session!.uid,
      kind,
      data
    );
    res.status(201).json(doc);
  }

  static async updateDraft(req: Request, res: Response) {
    const data = docSchema.parse(req.body);
    const doc = await DocumentService.updateDraft(
      req.session!.companyId,
      Number(req.params.id),
      data
    );
    res.json(doc);
  }

  static async postDoc(req: Request, res: Response) {
    const doc = await DocumentService.postDoc(
      req.session!.companyId,
      req.session!.uid,
      Number(req.params.id)
    );
    res.json(doc);
  }

  static async cancelDoc(req: Request, res: Response) {
    const data = reasonSchema.parse(req.body);
    const doc = await DocumentService.cancelDoc(
      req.session!.companyId,
      req.session!.uid,
      Number(req.params.id),
      data.reason
    );
    res.json(doc);
  }

  static async deleteDoc(req: Request, res: Response) {
    const result = await DocumentService.deleteDoc(
      req.session!.companyId,
      req.session!.uid,
      Number(req.params.id)
    );
    res.json(result);
  }
}

