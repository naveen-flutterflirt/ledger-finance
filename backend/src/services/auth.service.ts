import bcrypt from 'bcryptjs';
import { query, one, tx } from '../config/database.js';
import { signSession, resolvePermissions } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { Role } from '../models/types.js';

export class AuthService {
  static async login(email: string, pass: string, companyId?: number) {
    const u = await one(
      `SELECT * FROM users WHERE lower(email) = lower($1) AND active = true`,
      [email]
    );

    if (!u || !(await bcrypt.compare(pass, u.password_hash))) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const cos = await query(
      `SELECT c.id, c.name, c.industry, m.role, m.permissions 
       FROM memberships m 
       JOIN companies c ON c.id = m.company_id 
       WHERE m.user_id = $1 
       ORDER BY c.name`,
      [u.id]
    );

    if (!cos.length) {
      throw new HttpError(403, 'You are not a member of any company');
    }

    const enrichedCos = cos.map(c => ({
      ...c,
      permissions: resolvePermissions(c.role as Role, c.permissions),
    }));

    const co =
      enrichedCos.find(c => c.id === companyId) ??
      enrichedCos.find(c => c.id === u.last_company_id) ??
      enrichedCos[0];

    const role = co.role as Role;
    const permissions = co.permissions;

    const token = await signSession({
      uid: u.id,
      name: u.name,
      email: u.email,
      companyId: co.id,
      role,
      permissions,
    });

    return {
      token,
      user: { id: u.id, name: u.name, email: u.email },
      company: co,
      companies: enrichedCos,
      role,
      permissions,
    };
  }

  static async getCompaniesForUser(userId: number, companyId?: number) {
    const cos = await query(
      `SELECT c.id, c.name, c.industry, m.role, m.permissions 
       FROM memberships m 
       JOIN companies c ON c.id = m.company_id 
       WHERE m.user_id = $1 
       ORDER BY c.name`,
      [userId]
    );

    const co =
      cos.find(c => c.id === companyId) ??
      cos[0] ??
      null;

    return {
      company: co,
      companies: cos,
    };
  }

  static async register(d: any) {
    const r = await tx(async c => {
      const { rows: [u] } = await c.query(
        `INSERT INTO users(name, email, password_hash) 
         VALUES ($1, lower($2), $3) 
         RETURNING id, name, email`,
        [d.name, d.email, await bcrypt.hash(d.password, 10)]
      );

      const { rows: [co] } = await c.query(
        `SELECT create_company($1, $2, $3, $4) AS id`,
        [d.company_name, d.industry, d.state_code, u.id]
      );

      await c.query(`UPDATE users SET last_company_id = $1 WHERE id = $2`, [co.id, u.id]);
      return { u, companyId: co.id };
    });

    const permissions = resolvePermissions('OWNER');
    const token = await signSession({
      uid: r.u.id,
      name: r.u.name,
      email: r.u.email,
      companyId: r.companyId,
      role: 'OWNER',
      permissions,
    });

    return {
      token,
      user: r.u,
      company: { id: r.companyId, name: d.company_name, role: 'OWNER', permissions },
      role: 'OWNER',
      permissions,
    };
  }

  static async switchCompany(userId: number, session: any, companyId: number) {
    const m = await one(
      `SELECT role, permissions FROM memberships WHERE company_id = $1 AND user_id = $2`,
      [companyId, userId]
    );
    if (!m) throw new HttpError(403, 'Not a member of that company');

    await one(`UPDATE users SET last_company_id = $1 WHERE id = $2`, [companyId, userId]);

    const role = m.role as Role;
    const permissions = resolvePermissions(role, m.permissions);

    const token = await signSession({
      ...session,
      companyId,
      role,
      permissions,
    });

    return { token, role, permissions };
  }
}

