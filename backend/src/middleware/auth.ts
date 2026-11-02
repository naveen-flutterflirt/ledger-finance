import { Request, Response, NextFunction } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { ENV } from '../config/env.js';
import { Session, Role } from '../models/types.js';
import { one } from '../config/database.js';

export const COOKIE_NAME = 'lp_session';

const secretKey = () => new TextEncoder().encode(ENV.JWT_SECRET);

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey());
}

export async function verifyToken(token?: string | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, secretKey());
    return verified.payload as unknown as Session;
  } catch {
    return null;
  }
}

// Extend Express Request interface to include session
declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

export function resolvePermissions(role: Role, custom?: any): Record<string, boolean> {
  const full = { dashboard: true, sales: true, purchases: true, accounting: true, payroll: true, reports: true };
  if (role === 'OWNER') return full;

  const defaults: Record<Role, Record<string, boolean>> = {
    OWNER: full,
    ACCOUNTANT: { dashboard: true, sales: true, purchases: true, accounting: true, payroll: false, reports: true },
    HR: { dashboard: true, sales: false, purchases: false, accounting: false, payroll: true, reports: false },
    AUDITOR: { dashboard: true, sales: true, purchases: true, accounting: true, payroll: true, reports: true },
    EMPLOYEE: { dashboard: false, sales: false, purchases: false, accounting: false, payroll: false, reports: false },
  };

  const base = defaults[role] || defaults.EMPLOYEE;
  if (!custom || typeof custom !== 'object') return base;

  return {
    dashboard: typeof custom.dashboard === 'boolean' ? custom.dashboard : base.dashboard,
    sales: typeof custom.sales === 'boolean' ? custom.sales : base.sales,
    purchases: typeof custom.purchases === 'boolean' ? custom.purchases : base.purchases,
    accounting: typeof custom.accounting === 'boolean' ? custom.accounting : base.accounting,
    payroll: typeof custom.payroll === 'boolean' ? custom.payroll : base.payroll,
    reports: typeof custom.reports === 'boolean' ? custom.reports : base.reports,
  };
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;

  // 1. Check Bearer Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // 2. Fallback to Cookie header if Bearer not present
  if (!token && req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(c => {
        const [k, ...v] = c.trim().split('=');
        return [k, decodeURIComponent(v.join('='))];
      })
    );
    token = cookies[COOKIE_NAME];
  }

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const s = await verifyToken(token);
  if (!s) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  // Live role lookup: Re-check role from database to ensure immediate permission update
  const membership = await one(
    `SELECT m.role, m.permissions FROM memberships m JOIN users u ON u.id = m.user_id 
     WHERE m.company_id = $1 AND m.user_id = $2 AND u.active = true`,
    [s.companyId, s.uid]
  );

  if (!membership) {
    res.status(403).json({ error: 'Membership not found or user inactive' });
    return;
  }

  const role = membership.role as Role;
  const permissions = resolvePermissions(role, membership.permissions);

  req.session = { ...s, role, permissions };
  next();
}

