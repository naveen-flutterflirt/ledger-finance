-- ==============================================================================
-- LedgerPilot Database Optimization Script
-- Applied non-destructively: Safe for production with ZERO business logic changes
-- ==============================================================================

-- 1. Memberships & Users: Instant lookups during login & tenant switching
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_users_lower_email ON users(lower(email));

-- 2. Journal Lines: High-performance financial reporting (P&L, Balance Sheet, Ledgers)
CREATE INDEX IF NOT EXISTS idx_jl_company_account ON journal_lines(company_id, account_id);
CREATE INDEX IF NOT EXISTS idx_jl_party_account ON journal_lines(party_id, account_id);
CREATE INDEX IF NOT EXISTS idx_jl_account_amounts ON journal_lines(account_id, debit, credit);

-- 3. Invoices & Billing: Speed up document listing and settlement allocation checks
CREATE INDEX IF NOT EXISTS idx_inv_company_party_status ON invoices(company_id, party_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_against ON invoices(against_id) WHERE against_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_il_invoice ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_il_item ON invoice_lines(item_id) WHERE item_id IS NOT NULL;

-- 4. Vouchers & Allocations: Eliminate N*M sequential table scans on payment settlement
CREATE INDEX IF NOT EXISTS idx_vouchers_company_date ON vouchers(company_id, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_company_party ON vouchers(company_id, party_id);
CREATE INDEX IF NOT EXISTS idx_alloc_voucher ON allocations(voucher_id);
CREATE INDEX IF NOT EXISTS idx_alloc_note ON allocations(note_id);

-- 5. Bank Reconciliation: Partial index on unreconciled statement lines
CREATE INDEX IF NOT EXISTS idx_bsl_unmatched ON bank_statement_lines(company_id, bank_account_id) WHERE matched_line_id IS NULL;

-- 6. Fixed Assets & Payroll: Fast employee payslips and asset bill associations
CREATE INDEX IF NOT EXISTS idx_fa_bill ON fixed_assets(bill_id) WHERE bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emp_user ON employees(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);

-- 7. High-Performance View: Aggregated join avoids running 2 correlated subqueries per row
CREATE OR REPLACE VIEW v_invoice_outstanding AS
WITH alloc_summary AS (
  SELECT a.invoice_id, SUM(a.amount) AS settled
  FROM allocations a
  LEFT JOIN vouchers v ON v.id = a.voucher_id
  LEFT JOIN invoices n ON n.id = a.note_id
  WHERE COALESCE(v.status, 'POSTED') = 'POSTED'
    AND COALESCE(n.status::text, 'POSTED') <> 'CANCELLED'
  GROUP BY a.invoice_id
)
SELECT i.*, p.name AS party_name, p.gstin AS party_gstin,
       COALESCE(s.settled, 0) AS settled,
       i.total - COALESCE(s.settled, 0) AS outstanding,
       GREATEST(CURRENT_DATE - i.due_date, 0) AS days_overdue
FROM invoices i
JOIN parties p ON p.id = i.party_id
LEFT JOIN alloc_summary s ON s.invoice_id = i.id;

