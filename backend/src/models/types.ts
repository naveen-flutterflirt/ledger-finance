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

export type DocKind = 'SALE' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';

export type DocStatus = 'DRAFT' | 'POSTED' | 'PARTIAL' | 'PAID' | 'CANCELLED';

export interface ModulePermissions {
  dashboard?: boolean;
  sales?: boolean;
  purchases?: boolean;
  accounting?: boolean;
  payroll?: boolean;
  reports?: boolean;
}

export interface Session {
  uid: number;
  name: string;
  email: string;
  companyId: number;
  role: Role;
  permissions?: ModulePermissions;
}

export interface User {
  id: number;
  name: string;
  email: string;
  last_company_id?: number;
  active: boolean;
  created_at: string;
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
  currency: string;
  fy_start_month: number;
  lock_date?: string | null;
  payroll_settings: PayrollSettings;
  created_at: string;
}

export interface PayrollSettings {
  pf_rate: number;
  pf_employer_rate: number;
  pf_wage_ceiling: number;
  pf_cap_at_ceiling: boolean;
  labour_code_50pct_wage: boolean;
  esi_employee_rate: number;
  esi_employer_rate: number;
  esi_ceiling: number;
  pt_slabs: { from: number; to: number; amount: number }[];
}

export interface JournalLine {
  account_id?: number;
  key?: string;
  party_id?: number | null;
  debit?: number;
  credit?: number;
  narration?: string | null;
}

export interface JournalEntryPayload {
  date: string;
  source: string;
  source_id?: number | null;
  narration?: string | null;
  lines: JournalLine[];
}

