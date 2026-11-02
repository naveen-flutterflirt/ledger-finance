import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { loginSchema, registerSchema } from '../models/schemas.js';
import { COOKIE_NAME } from '../middleware/auth.js';
import { ENV } from '../config/env.js';

export class AuthController {
  static async login(req: Request, res: Response): Promise<void> {
    const data = loginSchema.parse(req.body);
    const result = await AuthService.login(data.email, data.password, data.company_id);

    res.cookie(COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: ENV.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 86400 * 1000,
    });

    res.json(result);
  }

  static async register(req: Request, res: Response): Promise<void> {
    const data = registerSchema.parse(req.body);
    const result = await AuthService.register(data);

    res.cookie(COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: ENV.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 86400 * 1000,
    });

    res.status(201).json(result);
  }

  static async switchCompany(req: Request, res: Response): Promise<void> {
    const companyId = Number(req.body.company_id);
    const result = await AuthService.switchCompany(req.session!.uid, req.session, companyId);

    res.cookie(COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: ENV.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 86400 * 1000,
    });

    res.json(result);
  }

  static async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  }

  static async me(req: Request, res: Response): Promise<void> {
    const s = req.session!;
    const { company, companies } = await AuthService.getCompaniesForUser(s.uid, s.companyId);
    res.json({
      user: { id: s.uid, name: s.name, email: s.email },
      role: s.role,
      permissions: s.permissions,
      company: company ? { ...company, permissions: s.permissions } : null,
      companies,
    });
  }
}

