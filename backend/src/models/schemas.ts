import { z } from 'zod';
import { validGstin, GST_STATES } from '../utils/gst.js';

export const money = z.coerce.number().nonnegative().multipleOf(0.01, 'Max 2 decimals');
export const pos = z.coerce.number().positive().multipleOf(0.01, 'Max 2 decimals');
export const id = z.coerce.number().int().positive();
export const optId = z
  .union([id, z.literal(''), z.null()])
  .optional()
  .transform(v => (v ? Number(v) : null));
export const optStr = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform(v => (v ? v : null));
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const month = z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM');
export const state = z.string().refine(s => s in GST_STATES, 'Unknown GST state code');
export const gstin = optStr.refine(g => !g || validGstin(g), 'Invalid GSTIN format');

export const INDUSTRIES = [
  'RETAIL',
  'RESTAURANT',
  'MANUFACTURING',
  'TRADING',
  'SERVICES',
  'IT_SOFTWARE',
  'CONSTRUCTION',
  'HEALTHCARE',
  'EDUCATION',
  'TRANSPORT',
  'AGRICULTURE',
  'REAL_ESTATE',
  'NGO',
  'OTHER',
] as const;

export const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  company_name: z.string().trim().min(2),
  industry: z.enum(INDUSTRIES),
  state_code: state,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  company_id: z.number().optional(),
});

export const companySchema = z.object({
  name: z.string().trim().min(2),
  legal_name: optStr,
  industry: z.enum(INDUSTRIES),
  gstin,
  pan: optStr,
  state_code: state,
  address: optStr,
  email: optStr,
  phone: optStr,
  fy_start_month: z.coerce.number().int().min(1).max(12).optional(),
  lock_date: date.optional().nullable().or(z.literal('')).transform(v => v || null),
  payroll_settings: z
    .object({
      pf_rate: z.number(),
      pf_employer_rate: z.number(),
      pf_wage_ceiling: z.number(),
      pf_cap_at_ceiling: z.boolean(),
      labour_code_50pct_wage: z.boolean(),
      esi_employee_rate: z.number(),
      esi_employer_rate: z.number(),
      esi_ceiling: z.number(),
      pt_slabs: z.array(z.object({ from: z.number(), to: z.number(), amount: z.number() })),
    })
    .optional(),
});

export const memberSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['OWNER', 'ACCOUNTANT', 'HR', 'AUDITOR', 'EMPLOYEE']),
  permissions: z
    .object({
      sales: z.boolean().optional(),
      purchases: z.boolean().optional(),
      accounting: z.boolean().optional(),
      payroll: z.boolean().optional(),
      reports: z.boolean().optional(),
    })
    .optional(),
});

export const accountSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  subtype: z.string(),
  bank_name: optStr,
  bank_acc_last4: optStr,
  ifsc: optStr,
  active: z.coerce.boolean().default(true),
});

export const partySchema = z
  .object({
    name: z.string().trim().min(1),
    kind: z.enum(['CUSTOMER', 'VENDOR', 'BOTH']),
    gstin,
    pan: optStr,
    state_code: state.optional().nullable(),
    address: optStr,
    email: optStr,
    phone: optStr,
    credit_days: z.coerce.number().int().min(0).default(30),
  })
  .refine(
    p => !p.gstin || !p.state_code || p.gstin.slice(0, 2) === p.state_code,
    'GSTIN state code does not match the selected state'
  );

export const itemSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(['GOODS', 'SERVICE']),
  hsn_sac: optStr,
  unit: z.string().default('NOS'),
  sale_price: money.default(0),
  purchase_price: money.default(0),
  gst_rate: z.coerce
    .number()
    .refine(r => [0, 0.25, 3, 5, 12, 18, 28, 40].includes(r), 'Invalid GST rate'),
  income_account_id: optId,
  expense_account_id: optId,
  active: z.coerce.boolean().default(true),
});

export const docSchema = z.object({
  doc_no: optStr,
  doc_date: date,
  due_date: date.optional().nullable().or(z.literal('')).transform(v => v || null),
  party_id: id,
  place_of_supply: state,
  against_id: optId,
  reverse_charge: z.coerce.boolean().default(false),
  is_opening: z.coerce.boolean().default(false),
  notes: optStr,
  post: z.coerce.boolean().default(false),
  lines: z
    .array(
      z.object({
        item_id: optId,
        description: z.string().trim().min(1),
        hsn_sac: optStr,
        qty: z.coerce.number().positive(),
        rate: money,
        discount: money.default(0),
        gst_rate: z.coerce
          .number()
          .refine(r => [0, 0.25, 3, 5, 12, 18, 28, 40].includes(r), 'Invalid GST rate'),
        account_id: id,
      })
    )
    .min(1, 'Add at least one line'),
});

export const voucherSchema = z.object({
  kind: z.enum(['RECEIPT', 'PAYMENT']),
  voucher_date: date,
  party_id: id,
  bank_account_id: id,
  amount: pos,
  tds_amount: money.default(0),
  mode: z
    .enum(['BANK', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'CHEQUE', 'CASH', 'CARD'])
    .default('BANK'),
  reference: optStr,
  notes: optStr,
  allocations: z.array(z.object({ invoice_id: id, amount: pos })).default([]),
});

export const journalSchema = z.object({
  date,
  narration: z.string().trim().min(2),
  source: z.enum(['MANUAL', 'CONTRA', 'OPENING']).default('MANUAL'),
  lines: z
    .array(
      z.object({
        account_id: id.optional(),
        key: z.string().optional(),
        party_id: optId,
        debit: money.default(0),
        credit: money.default(0),
        narration: optStr,
      })
    )
    .min(1),
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason'),
});

export const importSchema = z.object({
  bank_account_id: id,
  rows: z
    .array(
      z.object({
        txn_date: date,
        description: z.string().min(1),
        reference: optStr,
        withdrawal: money.default(0),
        deposit: money.default(0),
        balance: z.coerce.number().optional().nullable(),
      })
    )
    .min(1)
    .max(5000),
});

export const assetSchema = z
  .object({
    name: z.string().trim().min(1),
    category: z.string().trim().min(1),
    asset_account_id: id,
    purchase_date: date,
    put_to_use_date: date.optional(),
    cost: pos,
    salvage_value: money.default(0),
    method: z.enum(['SLM', 'WDV']),
    useful_life_years: z.coerce.number().positive().optional(),
    wdv_rate: z.coerce.number().positive().max(99).optional(),
    funding: z.enum(['BILL', 'BANK', 'OPENING']),
    bill_id: optId,
    paid_from_account_id: optId,
    opening_date: date.optional(),
    opening_acc_dep: money.default(0),
  })
  .refine(
    a => (a.method === 'SLM' ? !!a.useful_life_years : !!a.wdv_rate),
    'Give useful life (SLM) or WDV rate'
  )
  .refine(
    a => a.funding !== 'BANK' || !!a.paid_from_account_id,
    'Choose the bank/cash account it was paid from'
  )
  .refine(
    a => a.funding !== 'OPENING' || !!a.opening_date,
    'Opening date required'
  );

export const employeeSchema = z.object({
  emp_code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  user_id: optId,
  designation: optStr,
  department: optStr,
  pan: optStr,
  uan: optStr,
  esi_no: optStr,
  bank_name: optStr,
  bank_acc_last4: optStr,
  join_date: date,
  exit_date: date.optional().nullable().or(z.literal('')).transform(v => v || null),
  basic: money,
  hra: money.default(0),
  special: money.default(0),
  other_allow: money.default(0),
  pf_applicable: z.coerce.boolean().default(true),
  esi_applicable: z.coerce.boolean().default(true),
  pt_applicable: z.coerce.boolean().default(true),
  monthly_tds: money.default(0),
  active: z.coerce.boolean().default(true),
});
