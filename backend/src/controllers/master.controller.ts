import { Request, Response } from 'express';
import { AccountRepository } from '../repositories/account.repo.js';
import { PartyRepository } from '../repositories/party.repo.js';
import { ItemRepository } from '../repositories/item.repo.js';
import { EmployeeRepository } from '../repositories/employee.repo.js';
import {
  accountSchema,
  partySchema,
  itemSchema,
  employeeSchema,
} from '../models/schemas.js';
import { HttpError } from '../middleware/error.js';

export class MasterController {
  // Accounts
  static async listAccounts(req: Request, res: Response) {
    const list = await AccountRepository.listWithBalances(req.session!.companyId);
    res.json(list);
  }

  static async createAccount(req: Request, res: Response) {
    const data = accountSchema.parse(req.body);
    const item = await AccountRepository.create(req.session!.companyId, data);
    res.status(201).json(item);
  }

  static async updateAccount(req: Request, res: Response) {
    const data = accountSchema.partial().parse(req.body);
    const item = await AccountRepository.update(
      req.session!.companyId,
      Number(req.params.id),
      data
    );
    if (!item) throw new HttpError(404, 'Account not found');
    res.json(item);
  }

  // Parties (Customers & Vendors)
  static async listParties(req: Request, res: Response) {
    const kind = req.query.kind as string | undefined;
    const list = await PartyRepository.list(req.session!.companyId, kind);
    res.json(list);
  }

  static async createParty(req: Request, res: Response) {
    const data = partySchema.parse(req.body);
    const item = await PartyRepository.create(req.session!.companyId, data);
    res.status(201).json(item);
  }

  static async updateParty(req: Request, res: Response) {
    const data = partySchema.parse(req.body);
    const item = await PartyRepository.update(
      req.session!.companyId,
      Number(req.params.id),
      data
    );
    if (!item) throw new HttpError(404, 'Party not found');
    res.json(item);
  }

  // Items & Services
  static async listItems(req: Request, res: Response) {
    const list = await ItemRepository.list(req.session!.companyId);
    res.json(list);
  }

  static async createItem(req: Request, res: Response) {
    const data = itemSchema.parse(req.body);
    const item = await ItemRepository.create(req.session!.companyId, data);
    res.status(201).json(item);
  }

  static async updateItem(req: Request, res: Response) {
    const data = itemSchema.partial().parse(req.body);
    const item = await ItemRepository.update(
      req.session!.companyId,
      Number(req.params.id),
      data
    );
    if (!item) throw new HttpError(404, 'Item not found');
    res.json(item);
  }

  // Employees
  static async listEmployees(req: Request, res: Response) {
    const list = await EmployeeRepository.list(req.session!.companyId);
    res.json(list);
  }

  static async createEmployee(req: Request, res: Response) {
    const data = employeeSchema.parse(req.body);
    const item = await EmployeeRepository.create(req.session!.companyId, data);
    res.status(201).json(item);
  }

  static async updateEmployee(req: Request, res: Response) {
    const data = employeeSchema.partial().parse(req.body);
    const item = await EmployeeRepository.update(
      req.session!.companyId,
      Number(req.params.id),
      data
    );
    if (!item) throw new HttpError(404, 'Employee not found');
    res.json(item);
  }
}

