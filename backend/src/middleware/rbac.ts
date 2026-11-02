import { Request, Response, NextFunction } from 'express';
import { Role } from '../models/types.js';

export const FIN_READ: Role[] = ['OWNER', 'ACCOUNTANT', 'AUDITOR'];
export const FIN_WRITE: Role[] = ['OWNER', 'ACCOUNTANT'];
export const PAY_READ: Role[] = ['OWNER', 'HR', 'ACCOUNTANT', 'AUDITOR'];
export const PAY_WRITE: Role[] = ['OWNER', 'HR'];

function getModuleFromRequest(req: Request): string | null {
  const full = (req.baseUrl || '') + (req.path || '') + (req.originalUrl || '');

  // Payroll & Employees
  if (full.includes('/payroll') || full.includes('/employees') || full.includes('/payslips')) {
    return 'payroll';
  }

  // Dashboard
  if (full.includes('/reports/dashboard')) {
    return 'dashboard';
  }

  // Reports
  if (full.includes('/reports')) {
    return 'reports';
  }

  // Documents: Sales vs Purchases
  if (full.includes('/docs/sales') || full.includes('/docs/credit-notes')) {
    return 'sales';
  }
  if (full.includes('/docs/purchases') || full.includes('/docs/debit-notes')) {
    return 'purchases';
  }

  // Vouchers: Receipts (Sales) vs Payments (Purchases)
  if (full.includes('/vouchers')) {
    const kind = req.query.kind || req.body?.kind;
    if (kind === 'RECEIPT') return 'sales';
    if (kind === 'PAYMENT') return 'purchases';
    return 'sales';
  }

  // Parties: Customers (Sales) vs Vendors (Purchases)
  if (full.includes('/parties')) {
    const kind = req.query.kind || req.body?.kind;
    if (kind === 'CUSTOMER') return 'sales';
    if (kind === 'VENDOR') return 'purchases';
    return 'sales';
  }

  // Accounting core
  if (
    full.includes('/accounts') ||
    full.includes('/journals') ||
    full.includes('/banking') ||
    full.includes('/assets') ||
    full.includes('/items')
  ) {
    return 'accounting';
  }

  return null;
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { role, permissions } = req.session;

    // 1. Owner always has full access
    if (role === 'OWNER') {
      next();
      return;
    }

    // 2. Check granular module permission if applicable
    const mod = getModuleFromRequest(req);
    if (mod) {
      // If module is dashboard, allow if they have access to dashboard OR any business module
      if (mod === 'dashboard') {
        const canDash =
          permissions?.dashboard !== false &&
          (permissions?.dashboard === true ||
            permissions?.sales ||
            permissions?.purchases ||
            permissions?.accounting ||
            permissions?.payroll ||
            permissions?.reports ||
            role === 'ACCOUNTANT' ||
            role === 'AUDITOR');
        if (canDash) {
          next();
          return;
        }
      }

      if (permissions && typeof permissions[mod as keyof typeof permissions] === 'boolean') {
        const allowed = permissions[mod as keyof typeof permissions];
        if (allowed === true) {
          // If write action (POST/PUT/DELETE) and user is AUDITOR, block write
          if (role === 'AUDITOR' && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
            res.status(403).json({ error: 'Auditors have read-only access' });
            return;
          }
          next();
          return;
        }
        if (allowed === false) {
          res.status(403).json({ error: `Access denied to ${mod} module. Contact company owner.` });
          return;
        }
      }
    }

    // 3. Fallback to role check
    if (roles.length > 0 && !roles.includes(role)) {
      res.status(403).json({ error: 'Your role cannot do this' });
      return;
    }

    next();
  };
}

