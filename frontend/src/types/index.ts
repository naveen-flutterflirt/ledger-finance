export type Role = 'OWNER' | 'ACCOUNTANT' | 'HR' | 'AUDITOR' | 'EMPLOYEE';

export type Industry =
  | 'RETAIL'
  | 'RESTAURANT'
  | 'MANUFACTURING'
  | 'TRADING'
  | 'SERVICES'
  | 'IT_SOFTWARE'
  | 'CONSTRUCTION'
  | 'HEALTHCARE'
  | 'EDUCATION'
  | 'TRANSPORT'
  | 'AGRICULTURE'
  | 'REAL_ESTATE'
  | 'NGO'
  | 'OTHER';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export type DocKind = 'sales' | 'purchases' | 'credit-notes' | 'debit-notes';

export interface ModulePermissions {
  dashboard?: boolean;
  sales?: boolean;
  purchases?: boolean;
  accounting?: boolean;
  payroll?: boolean;
  reports?: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Company {
  id: number;
  name: string;
  legal_name?: string;
  industry: Industry;
  gstin?: string;
  pan?: string;
  state_code: string;
  address?: string;
  email?: string;
  phone?: string;
  lock_date?: string | null;
  role: Role;
  permissions?: ModulePermissions;
  years?: any[];
}

export interface Member {
  id: number;
  name: string;
  email: string;
  role: Role;
  permissions?: ModulePermissions | null;
  effective_permissions?: ModulePermissions;
}

export interface Session {
  token: string;
  user: User;
  company: Company;
  companies: Company[];
}

