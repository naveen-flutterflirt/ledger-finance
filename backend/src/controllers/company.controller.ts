import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { CompanyRepository } from '../repositories/company.repo.js';
import { AccountRepository } from '../repositories/account.repo.js';
import { PartyRepository } from '../repositories/party.repo.js';
import { ItemRepository } from '../repositories/item.repo.js';
import { companySchema, memberSchema } from '../models/schemas.js';
import { HttpError } from '../middleware/error.js';
import { resolvePermissions } from '../middleware/auth.js';
import { GST_STATES } from '../utils/gst.js';
import { query, one, tx } from '../config/database.js';

export class CompanyController {
  static async getCompany(req: Request, res: Response) {
    const c = await CompanyRepository.findById(req.session!.companyId);
    const years = await CompanyRepository.getFiscalYears(req.session!.companyId);
    res.json({ ...c, years });
  }

  static async updateCompany(req: Request, res: Response) {
    const data = companySchema.parse(req.body);
    const companyId = req.session!.companyId;

    const closed = await one(
      `SELECT MAX(end_date) d FROM fiscal_years WHERE company_id = $1 AND closed = true`,
      [companyId]
    );

    if (closed?.d && (!data.lock_date || data.lock_date < closed.d)) {
      throw new HttpError(
        422,
        `Lock date cannot be before the last closed year end (${closed.d})`
      );
    }

    const updated = await CompanyRepository.update(companyId, data);
    res.json(updated);
  }

  static async createAdditionalCompany(req: Request, res: Response) {
    const data = companySchema.parse(req.body);
    const s = req.session!;

    const r = await one(
      `SELECT create_company($1, $2, $3, $4) AS id`,
      [data.name, data.industry, data.state_code, s.uid]
    );

    const updated = await one(
      `UPDATE companies SET gstin = $2, legal_name = $3 WHERE id = $1 RETURNING *`,
      [r!.id, data.gstin, data.legal_name]
    );

    res.status(201).json(updated);
  }

  static async listMembers(req: Request, res: Response) {
    const members = await CompanyRepository.listMembers(req.session!.companyId);
    const enriched = members.map((m: any) => ({
      ...m,
      effective_permissions: resolvePermissions(m.role, m.permissions),
    }));
    res.json(enriched);
  }

  static async addMember(req: Request, res: Response) {
    const d = memberSchema.parse(req.body);
    const companyId = req.session!.companyId;

    const result = await tx(async c => {
      let { rows: [u] } = await c.query(
        `SELECT id FROM users WHERE lower(email) = lower($1)`,
        [d.email]
      );

      if (!u) {
        if (!d.name || !d.password) {
          throw new HttpError(400, 'New user needs a name and a password (8+ characters)');
        }
        const pw = await bcrypt.hash(d.password, 10);
        const { rows: [newUser] } = await c.query(
          `INSERT INTO users(name, email, password_hash) VALUES ($1, lower($2), $3) RETURNING id`,
          [d.name, d.email, pw]
        );
        u = newUser;
      }

      await c.query(
        `INSERT INTO memberships(company_id, user_id, role, permissions) VALUES ($1, $2, $3, $4)
         ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role, permissions = EXCLUDED.permissions`,
        [companyId, u.id, d.role, d.permissions ? JSON.stringify(d.permissions) : null]
      );

      return { ok: true, user_id: u.id };
    });

    res.json(result);
  }

  static async updateMemberPermissions(req: Request, res: Response) {
    const { user_id, role, permissions } = req.body;
    const companyId = req.session!.companyId;
    const targetUserId = Number(user_id);

    if (!targetUserId) throw new HttpError(400, 'User ID is required');

    await one(
      `UPDATE memberships 
       SET role = COALESCE($3, role),
           permissions = $4
       WHERE company_id = $1 AND user_id = $2`,
      [companyId, targetUserId, role ?? null, permissions ? JSON.stringify(permissions) : null]
    );

    res.json({ ok: true });
  }

  static async removeMember(req: Request, res: Response) {
    const targetUserId = Number(req.body.user_id);
    if (targetUserId === req.session!.uid) {
      throw new HttpError(422, 'You cannot remove yourself');
    }

    await one(
      `DELETE FROM memberships WHERE company_id = $1 AND user_id = $2`,
      [req.session!.companyId, targetUserId]
    );
    res.json({ ok: true });
  }

  static async getLookups(req: Request, res: Response) {
    const s = req.session!;
    const company = await one(
      `SELECT id, name, state_code, gstin, industry FROM companies WHERE id = $1`,
      [s.companyId]
    );

    const hasAnyAccess =
      s.role !== 'EMPLOYEE' ||
      s.permissions?.sales ||
      s.permissions?.purchases ||
      s.permissions?.accounting ||
      s.permissions?.payroll ||
      s.permissions?.reports;

    if (!hasAnyAccess) {
      res.json({ company, states: GST_STATES });
      return;
    }

    const [accounts, parties, items] = await Promise.all([
      query(
        `SELECT id, code, name, type, subtype, system_key FROM accounts 
         WHERE company_id = $1 AND active = true ORDER BY code`,
        [s.companyId]
      ),
      query(
        `SELECT id, name, kind, gstin, state_code, credit_days FROM parties 
         WHERE company_id = $1 ORDER BY name`,
        [s.companyId]
      ),
      query(
        `SELECT * FROM items WHERE company_id = $1 AND active = true ORDER BY name`,
        [s.companyId]
      ),
    ]);

    res.json({ company, accounts, parties, items, states: GST_STATES });
  }
}

