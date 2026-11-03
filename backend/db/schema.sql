-- =====================================================================
--  LedgerPilot — Complete Company Finance (double-entry accounting)
--  GST sales & purchases · Banking & reconciliation · Fixed assets · Payroll
--  PostgreSQL 14+
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE industry      AS ENUM ('RETAIL','RESTAURANT','MANUFACTURING','TRADING','SERVICES','IT_SOFTWARE','CONSTRUCTION',
  'HEALTHCARE','EDUCATION','TRANSPORT','AGRICULTURE','REAL_ESTATE','NGO','OTHER');
CREATE TYPE fin_role      AS ENUM ('OWNER','ACCOUNTANT','HR','AUDITOR','EMPLOYEE');
CREATE TYPE acct_type     AS ENUM ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE');
-- subtype drives report grouping and system postings
CREATE TYPE acct_subtype  AS ENUM ('BANK','CASH','RECEIVABLE','INVENTORY','CURRENT_ASSET','TAX_INPUT','FIXED_ASSET','ACC_DEPRECIATION',
  'PAYABLE','CURRENT_LIABILITY','TAX_OUTPUT','PAYROLL_LIABILITY','LOAN','CAPITAL','RETAINED_EARNINGS',
  'SALES','OTHER_INCOME','COGS','DIRECT_EXPENSE','INDIRECT_EXPENSE','PAYROLL_EXPENSE','DEPRECIATION','FINANCE_COST','ROUND_OFF');
CREATE TYPE je_source     AS ENUM ('MANUAL','OPENING','SALES_INVOICE','PURCHASE_BILL','CREDIT_NOTE','DEBIT_NOTE','RECEIPT','PAYMENT',
  'CONTRA','DEPRECIATION','ASSET_DISPOSAL','ASSET_PURCHASE','PAYROLL','PAYROLL_PAYMENT','BANK_ENTRY','YEAR_CLOSE','REVERSAL');
CREATE TYPE doc_status    AS ENUM ('DRAFT','POSTED','PARTIAL','PAID','CANCELLED');

-- ---------- Companies & users ----------------------------------------
CREATE TABLE companies (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  legal_name      TEXT,
  industry        industry NOT NULL DEFAULT 'OTHER',
  gstin           TEXT,
  pan             TEXT,
  state_code      CHAR(2) NOT NULL DEFAULT '23',      -- GST state code (23 = Madhya Pradesh)
  address         TEXT,
  email           TEXT,
  phone           TEXT,
  currency        CHAR(3) NOT NULL DEFAULT 'INR',
  fy_start_month  INT NOT NULL DEFAULT 4 CHECK (fy_start_month BETWEEN 1 AND 12),
  lock_date       DATE,                                -- no postings on/before this date
  -- payroll statutory settings (editable; verify with EPFO / ESIC / state PT rules)
  payroll_settings JSONB NOT NULL DEFAULT '{
     "pf_rate": 12, "pf_employer_rate": 12, "pf_wage_ceiling": 25000, "pf_cap_at_ceiling": true,
     "labour_code_50pct_wage": true,
     "esi_employee_rate": 0.75, "esi_employer_rate": 3.25, "esi_ceiling": 21000,
     "pt_slabs": [{"from": 0, "to": 14999, "amount": 0}, {"from": 15000, "to": 9999999, "amount": 200}]
  }',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  last_company_id INT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       fin_role NOT NULL,
  permissions JSONB DEFAULT NULL,
  PRIMARY KEY (company_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_users_lower_email ON users(lower(email));

CREATE TABLE fiscal_years (
  id         SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,                 -- 2026-27
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  closed     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (company_id, start_date),
  CHECK (end_date > start_date)
);

-- ---------- Chart of accounts -----------------------------------------
CREATE TABLE accounts (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        acct_type NOT NULL,
  subtype     acct_subtype NOT NULL,
  parent_id   INT REFERENCES accounts(id),
  system_key  TEXT,                         -- AR, AP, OUT_CGST … used by the posting engine
  bank_name   TEXT,
  bank_acc_last4 TEXT,
  ifsc        TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (company_id, code),
  UNIQUE (company_id, system_key)
);

CREATE TABLE coa_templates (
  industry   industry,                       -- NULL = every company
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  type       acct_type NOT NULL,
  subtype    acct_subtype NOT NULL,
  system_key TEXT
);

-- ---------- Parties, items -------------------------------------------
CREATE TABLE parties (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (kind IN ('CUSTOMER','VENDOR','BOTH')),
  gstin       TEXT,
  pan         TEXT,
  state_code  CHAR(2),
  address     TEXT,
  email       TEXT,
  phone       TEXT,
  credit_days INT NOT NULL DEFAULT 30,
  UNIQUE (company_id, name)
);

CREATE TABLE items (
  id                 SERIAL PRIMARY KEY,
  company_id         INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  kind               TEXT NOT NULL DEFAULT 'GOODS' CHECK (kind IN ('GOODS','SERVICE')),
  hsn_sac            TEXT,
  unit               TEXT NOT NULL DEFAULT 'NOS',
  sale_price         NUMERIC(16,2) NOT NULL DEFAULT 0,
  purchase_price     NUMERIC(16,2) NOT NULL DEFAULT 0,
  gst_rate           NUMERIC(5,2) NOT NULL DEFAULT 18 CHECK (gst_rate IN (0,0.25,3,5,12,18,28,40)),
  income_account_id  INT REFERENCES accounts(id),
  expense_account_id INT REFERENCES accounts(id),
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (company_id, name)
);

-- ---------- Document numbering per financial year ----------------------
CREATE TABLE doc_series (company_id INT, doc_type TEXT, fy TEXT, last_no INT NOT NULL DEFAULT 0, PRIMARY KEY (company_id, doc_type, fy));

CREATE OR REPLACE FUNCTION fy_label(p_company INT, p_date DATE) RETURNS TEXT AS $$
DECLARE m INT; y INT;
BEGIN
  SELECT fy_start_month INTO m FROM companies WHERE id = p_company;
  y := EXTRACT(YEAR FROM p_date)::INT - CASE WHEN EXTRACT(MONTH FROM p_date) < m THEN 1 ELSE 0 END;
  IF m = 1 THEN RETURN y::TEXT; END IF;
  RETURN y || '-' || lpad(((y + 1) % 100)::TEXT, 2, '0');
END $$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION next_doc_no(p_company INT, p_type TEXT, p_date DATE) RETURNS TEXT AS $$
DECLARE n INT; f TEXT := fy_label(p_company, p_date);
BEGIN
  INSERT INTO doc_series VALUES (p_company, p_type, f, 1)
  ON CONFLICT (company_id, doc_type, fy) DO UPDATE SET last_no = doc_series.last_no + 1 RETURNING last_no INTO n;
  RETURN p_type || '/' || f || '/' || lpad(n::TEXT, 4, '0');      -- INV/2026-27/0001 (≤16 chars for GST)
END $$ LANGUAGE plpgsql;

-- ---------- General ledger (the heart) -------------------------------
CREATE TABLE journal_entries (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_no    TEXT NOT NULL,
  entry_date  DATE NOT NULL,
  source      je_source NOT NULL DEFAULT 'MANUAL',
  source_id   INT,
  narration   TEXT,
  reversed_by BIGINT REFERENCES journal_entries(id),
  reversal_of BIGINT REFERENCES journal_entries(id),
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, entry_no)
);
CREATE INDEX idx_je_company_date ON journal_entries(company_id, entry_date);
CREATE INDEX idx_je_source ON journal_entries(source, source_id);

CREATE TABLE journal_lines (
  id         BIGSERIAL PRIMARY KEY,
  entry_id   BIGINT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  company_id INT NOT NULL,
  account_id INT NOT NULL REFERENCES accounts(id),
  party_id   INT REFERENCES parties(id),
  debit      NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit     NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  narration  TEXT,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX idx_jl_account ON journal_lines(account_id);
CREATE INDEX idx_jl_party   ON journal_lines(party_id);
CREATE INDEX idx_jl_entry   ON journal_lines(entry_id);
CREATE INDEX idx_jl_company_account ON journal_lines(company_id, account_id);
CREATE INDEX idx_jl_party_account ON journal_lines(party_id, account_id);
CREATE INDEX idx_jl_account_amounts ON journal_lines(account_id, debit, credit);

-- (1) every entry must balance — checked at COMMIT so lines can be inserted one by one
CREATE OR REPLACE FUNCTION check_entry_balanced() RETURNS TRIGGER AS $$
DECLARE dr NUMERIC; cr NUMERIC; n INT; e BIGINT := COALESCE(NEW.entry_id, OLD.entry_id);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE id = e) THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0), COUNT(*) INTO dr, cr, n FROM journal_lines WHERE entry_id = e;
  IF n < 2 THEN RAISE EXCEPTION 'Journal entry % needs at least two lines', e USING ERRCODE = 'check_violation'; END IF;
  IF dr <> cr THEN RAISE EXCEPTION 'Journal entry % is not balanced: debit % ≠ credit %', e, dr, cr USING ERRCODE = 'check_violation'; END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER trg_entry_balanced AFTER INSERT OR UPDATE OR DELETE ON journal_lines
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_entry_balanced();

-- (2) lines must use the entry's company accounts/parties; no group or inactive accounts
CREATE OR REPLACE FUNCTION check_line() RETURNS TRIGGER AS $$
BEGIN
  SELECT company_id INTO NEW.company_id FROM journal_entries WHERE id = NEW.entry_id;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = NEW.account_id AND company_id = NEW.company_id AND active) THEN
    RAISE EXCEPTION 'Account % is not an active account of this company', NEW.account_id USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.party_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM parties WHERE id = NEW.party_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Party does not belong to this company' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_line_check BEFORE INSERT ON journal_lines FOR EACH ROW EXECUTE FUNCTION check_line();

-- (3) period lock & closed years; (4) posted entries are immutable (reverse instead)
CREATE OR REPLACE FUNCTION check_period() RETURNS TRIGGER AS $$
DECLARE lk DATE;
BEGIN
  SELECT lock_date INTO lk FROM companies WHERE id = NEW.company_id;
  IF lk IS NOT NULL AND NEW.entry_date <= lk THEN
    RAISE EXCEPTION 'Books are locked up to %; choose a later date', lk USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM fiscal_years WHERE company_id = NEW.company_id AND closed AND NEW.entry_date BETWEEN start_date AND end_date)
     AND NEW.source <> 'YEAR_CLOSE' THEN
    RAISE EXCEPTION 'Financial year containing % is closed', NEW.entry_date USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_je_period BEFORE INSERT ON journal_entries FOR EACH ROW EXECUTE FUNCTION check_period();

CREATE OR REPLACE FUNCTION je_immutable() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Posted journal entries cannot be deleted; reverse them'; END IF;
  IF NEW.entry_date <> OLD.entry_date OR NEW.company_id <> OLD.company_id OR NEW.entry_no <> OLD.entry_no THEN
    RAISE EXCEPTION 'Posted journal entries cannot be changed; reverse them';
  END IF;
  RETURN NEW;                                  -- only reversed_by / narration may change
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_je_immutable BEFORE UPDATE OR DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION je_immutable();

CREATE OR REPLACE FUNCTION jl_immutable() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'Journal lines cannot be changed or deleted; post a reversal'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_jl_immutable BEFORE UPDATE OR DELETE ON journal_lines FOR EACH ROW EXECUTE FUNCTION jl_immutable();

-- ---------- Sales invoices / purchase bills / notes (GST) -------------
CREATE TABLE invoices (
  id              SERIAL PRIMARY KEY,
  company_id      INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('SALE','PURCHASE','CREDIT_NOTE','DEBIT_NOTE')),
  doc_no          TEXT,                      -- our number (sales/CN) or vendor's bill number (purchase/DN ref)
  doc_date        DATE NOT NULL,
  due_date        DATE,
  party_id        INT NOT NULL REFERENCES parties(id),
  place_of_supply CHAR(2) NOT NULL,          -- GST state code; ≠ company state → IGST
  against_id      INT REFERENCES invoices(id), -- credit/debit note against an invoice/bill
  reverse_charge  BOOLEAN NOT NULL DEFAULT FALSE,
  is_opening      BOOLEAN NOT NULL DEFAULT FALSE,   -- opening receivable/payable (no GST, posts to Opening Balance Equity)
  status          doc_status NOT NULL DEFAULT 'DRAFT',
  taxable_value   NUMERIC(16,2) NOT NULL DEFAULT 0,
  cgst            NUMERIC(16,2) NOT NULL DEFAULT 0,
  sgst            NUMERIC(16,2) NOT NULL DEFAULT 0,
  igst            NUMERIC(16,2) NOT NULL DEFAULT 0,
  round_off       NUMERIC(16,2) NOT NULL DEFAULT 0,
  total           NUMERIC(16,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  created_by      INT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_company ON invoices(company_id, kind, status, doc_date);
CREATE INDEX idx_inv_company_party_status ON invoices(company_id, party_id, status);
CREATE INDEX idx_inv_against ON invoices(against_id) WHERE against_id IS NOT NULL;
CREATE UNIQUE INDEX uq_purchase_bill ON invoices(company_id, party_id, doc_no) WHERE kind = 'PURCHASE' AND status <> 'CANCELLED';

CREATE TABLE invoice_lines (
  id          SERIAL PRIMARY KEY,
  invoice_id  INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id     INT REFERENCES items(id),
  description TEXT NOT NULL,
  hsn_sac     TEXT,
  qty         NUMERIC(14,3) NOT NULL CHECK (qty > 0),
  rate        NUMERIC(16,2) NOT NULL CHECK (rate >= 0),
  discount    NUMERIC(16,2) NOT NULL DEFAULT 0,
  gst_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  account_id  INT NOT NULL REFERENCES accounts(id),   -- income (sales) or expense/asset (purchase)
  taxable     NUMERIC(16,2) NOT NULL DEFAULT 0,
  cgst        NUMERIC(16,2) NOT NULL DEFAULT 0,
  sgst        NUMERIC(16,2) NOT NULL DEFAULT 0,
  igst        NUMERIC(16,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_il_invoice ON invoice_lines(invoice_id);
CREATE INDEX idx_il_item ON invoice_lines(item_id) WHERE item_id IS NOT NULL;

-- ---------- Receipts & payments with allocation to invoices -----------
CREATE TABLE vouchers (
  id               SERIAL PRIMARY KEY,
  company_id       INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('RECEIPT','PAYMENT')),
  voucher_no       TEXT NOT NULL,
  voucher_date     DATE NOT NULL,
  party_id         INT NOT NULL REFERENCES parties(id),
  bank_account_id  INT NOT NULL REFERENCES accounts(id),
  amount           NUMERIC(16,2) NOT NULL CHECK (amount > 0),
  tds_amount       NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (tds_amount >= 0),   -- TDS deducted by customer / by us
  mode             TEXT NOT NULL DEFAULT 'BANK',
  reference        TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','CANCELLED')),
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  created_by       INT REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, voucher_no)
);
CREATE INDEX idx_vouchers_company_date ON vouchers(company_id, voucher_date DESC);
CREATE INDEX idx_vouchers_company_party ON vouchers(company_id, party_id);

CREATE TABLE allocations (
  id          SERIAL PRIMARY KEY,
  voucher_id  INT REFERENCES vouchers(id) ON DELETE CASCADE,
  note_id     INT REFERENCES invoices(id) ON DELETE CASCADE,   -- credit/debit note applied to an invoice
  invoice_id  INT NOT NULL REFERENCES invoices(id),
  amount      NUMERIC(16,2) NOT NULL CHECK (amount > 0),
  CHECK ((voucher_id IS NULL) <> (note_id IS NULL))
);
CREATE INDEX idx_alloc_invoice ON allocations(invoice_id);
CREATE INDEX idx_alloc_voucher ON allocations(voucher_id);
CREATE INDEX idx_alloc_note ON allocations(note_id);

-- outstanding = total − settled; keeps status POSTED / PARTIAL / PAID and blocks over-allocation
CREATE OR REPLACE FUNCTION recompute_invoice_status(inv_id INT) RETURNS VOID AS $$
DECLARE tot NUMERIC; settled NUMERIC; st doc_status;
BEGIN
  SELECT total, status INTO tot, st FROM invoices WHERE id = inv_id;
  IF st IN ('DRAFT','CANCELLED') THEN RETURN; END IF;
  SELECT COALESCE(SUM(a.amount),0) INTO settled FROM allocations a
    LEFT JOIN vouchers v ON v.id = a.voucher_id LEFT JOIN invoices n ON n.id = a.note_id
   WHERE a.invoice_id = inv_id AND COALESCE(v.status, 'POSTED') = 'POSTED' AND COALESCE(n.status::text, 'POSTED') <> 'CANCELLED';
  IF settled > tot THEN RAISE EXCEPTION 'Allocation % exceeds document total %', settled, tot USING ERRCODE = 'check_violation'; END IF;
  UPDATE invoices SET status = CASE WHEN settled = 0 THEN 'POSTED' WHEN settled < tot THEN 'PARTIAL' ELSE 'PAID' END::doc_status
   WHERE id = inv_id;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_invoice_status() RETURNS TRIGGER AS $$
DECLARE inv_id INT := COALESCE(NEW.invoice_id, OLD.invoice_id); st doc_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO st FROM invoices WHERE id = inv_id;
    IF st IN ('DRAFT','CANCELLED') THEN RAISE EXCEPTION 'Cannot settle a % document', st USING ERRCODE = 'check_violation'; END IF;
  END IF;
  PERFORM recompute_invoice_status(inv_id);
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_alloc_status AFTER INSERT OR DELETE ON allocations FOR EACH ROW EXECUTE FUNCTION refresh_invoice_status();

-- ---------- Bank reconciliation ---------------------------------------
CREATE TABLE bank_statement_lines (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id INT NOT NULL REFERENCES accounts(id),
  txn_date        DATE NOT NULL,
  description     TEXT NOT NULL,
  reference       TEXT,
  withdrawal      NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (withdrawal >= 0),
  deposit         NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (deposit >= 0),
  balance         NUMERIC(16,2),
  matched_line_id BIGINT UNIQUE REFERENCES journal_lines(id),
  import_batch    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((withdrawal > 0) <> (deposit > 0))
);
CREATE INDEX idx_bsl_account ON bank_statement_lines(bank_account_id, txn_date);
CREATE INDEX idx_bsl_unmatched ON bank_statement_lines(company_id, bank_account_id) WHERE matched_line_id IS NULL;
CREATE UNIQUE INDEX uq_bsl_dedupe ON bank_statement_lines(bank_account_id, txn_date, withdrawal, deposit, COALESCE(reference,''), description);

-- ---------- Fixed assets & depreciation --------------------------------
CREATE TABLE fixed_assets (
  id                     SERIAL PRIMARY KEY,
  company_id             INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_no               TEXT NOT NULL,
  name                   TEXT NOT NULL,
  category               TEXT NOT NULL,                 -- Computers, Vehicles, Plant & Machinery …
  asset_account_id       INT NOT NULL REFERENCES accounts(id),
  acc_dep_account_id     INT NOT NULL REFERENCES accounts(id),
  dep_expense_account_id INT NOT NULL REFERENCES accounts(id),
  purchase_date          DATE NOT NULL,
  put_to_use_date        DATE NOT NULL,
  cost                   NUMERIC(16,2) NOT NULL CHECK (cost > 0),
  salvage_value          NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (salvage_value >= 0),
  method                 TEXT NOT NULL DEFAULT 'SLM' CHECK (method IN ('SLM','WDV')),
  useful_life_years      NUMERIC(5,2),                  -- SLM
  wdv_rate               NUMERIC(5,2),                  -- WDV % per year
  bill_id                INT REFERENCES invoices(id),
  status                 TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISPOSED')),
  disposed_on            DATE,
  sale_amount            NUMERIC(16,2),
  UNIQUE (company_id, asset_no),
  CHECK (salvage_value < cost),
  CHECK ((method = 'SLM' AND useful_life_years > 0) OR (method = 'WDV' AND wdv_rate > 0 AND wdv_rate < 100))
);
CREATE INDEX idx_fa_bill ON fixed_assets(bill_id) WHERE bill_id IS NOT NULL;
CREATE TABLE depreciation_entries (
  id               SERIAL PRIMARY KEY,
  asset_id         INT NOT NULL REFERENCES fixed_assets(id),
  period           DATE NOT NULL,          -- first day of month
  amount           NUMERIC(16,2) NOT NULL CHECK (amount > 0),
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  UNIQUE (asset_id, period)
);

-- ---------- Payroll -----------------------------------------------------
CREATE TABLE employees (
  id             SERIAL PRIMARY KEY,
  company_id     INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  emp_code       TEXT NOT NULL,
  name           TEXT NOT NULL,
  user_id        INT REFERENCES users(id),        -- login to see own payslips
  designation    TEXT,
  department     TEXT,
  pan            TEXT,
  uan            TEXT,
  esi_no         TEXT,
  bank_name      TEXT,
  bank_acc_last4 TEXT,
  join_date      DATE NOT NULL,
  exit_date      DATE,
  basic          NUMERIC(14,2) NOT NULL CHECK (basic >= 0),   -- monthly
  hra            NUMERIC(14,2) NOT NULL DEFAULT 0,
  special        NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_allow    NUMERIC(14,2) NOT NULL DEFAULT 0,
  pf_applicable  BOOLEAN NOT NULL DEFAULT TRUE,
  esi_applicable BOOLEAN NOT NULL DEFAULT TRUE,
  pt_applicable  BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_tds    NUMERIC(14,2) NOT NULL DEFAULT 0,             -- from employee's tax projection
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (company_id, emp_code)
);
CREATE INDEX idx_emp_user ON employees(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE payroll_runs (
  id               SERIAL PRIMARY KEY,
  company_id       INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period           DATE NOT NULL,                  -- first day of month
  status           TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','PAID')),
  gross            NUMERIC(16,2) NOT NULL DEFAULT 0,
  deductions       NUMERIC(16,2) NOT NULL DEFAULT 0,
  net              NUMERIC(16,2) NOT NULL DEFAULT 0,
  employer_cost    NUMERIC(16,2) NOT NULL DEFAULT 0,
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  payment_entry_id BIGINT REFERENCES journal_entries(id),
  created_by       INT REFERENCES users(id),
  UNIQUE (company_id, period)
);
CREATE TABLE payslips (
  id              SERIAL PRIMARY KEY,
  run_id          INT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id     INT NOT NULL REFERENCES employees(id),
  days_in_month   INT NOT NULL,
  lop_days        NUMERIC(4,1) NOT NULL DEFAULT 0,
  paid_days       NUMERIC(4,1) NOT NULL,
  basic           NUMERIC(14,2) NOT NULL, hra NUMERIC(14,2) NOT NULL, special NUMERIC(14,2) NOT NULL,
  other_allow     NUMERIC(14,2) NOT NULL, bonus NUMERIC(14,2) NOT NULL DEFAULT 0,
  gross           NUMERIC(14,2) NOT NULL,
  pf_wage         NUMERIC(14,2) NOT NULL DEFAULT 0,
  pf_employee     NUMERIC(14,2) NOT NULL DEFAULT 0,
  pf_employer     NUMERIC(14,2) NOT NULL DEFAULT 0,
  esi_employee    NUMERIC(14,2) NOT NULL DEFAULT 0,
  esi_employer    NUMERIC(14,2) NOT NULL DEFAULT 0,
  pt              NUMERIC(14,2) NOT NULL DEFAULT 0,
  tds             NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(14,2) NOT NULL,
  net_pay         NUMERIC(14,2) NOT NULL,
  UNIQUE (run_id, employee_id)
);
CREATE INDEX idx_payslips_employee ON payslips(employee_id);

-- ---------- Audit -------------------------------------------------------
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY, company_id INT, user_id INT, action TEXT NOT NULL, entity TEXT NOT NULL,
  entity_id TEXT, detail JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Views --------------------------------------------------------
-- account balances (signed: debit positive)
CREATE VIEW v_ledger AS
SELECT l.id AS line_id, l.company_id, e.id AS entry_id, e.entry_no, e.entry_date, e.source, e.source_id, e.narration AS entry_narration,
       l.account_id, a.code, a.name AS account_name, a.type, a.subtype, l.party_id, l.debit, l.credit, l.narration
FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id JOIN accounts a ON a.id = l.account_id;

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

-- ---------- Chart-of-accounts templates per industry ------------------
INSERT INTO coa_templates(industry,code,name,type,subtype,system_key) VALUES
 (NULL,'1100','Cash in Hand','ASSET','CASH','CASH'),
 (NULL,'1110','Bank – Current Account','ASSET','BANK','BANK'),
 (NULL,'1200','Accounts Receivable (Debtors)','ASSET','RECEIVABLE','AR'),
 (NULL,'1400','Input CGST','ASSET','TAX_INPUT','IN_CGST'),
 (NULL,'1401','Input SGST','ASSET','TAX_INPUT','IN_SGST'),
 (NULL,'1402','Input IGST','ASSET','TAX_INPUT','IN_IGST'),
 (NULL,'1410','TDS Receivable','ASSET','CURRENT_ASSET','TDS_REC'),
 (NULL,'1420','Advances & Prepaid Expenses','ASSET','CURRENT_ASSET','ADVANCES'),
 (NULL,'1500','Furniture & Fixtures','ASSET','FIXED_ASSET',NULL),
 (NULL,'1510','Computers & IT Equipment','ASSET','FIXED_ASSET',NULL),
 (NULL,'1520','Office Equipment','ASSET','FIXED_ASSET',NULL),
 (NULL,'1590','Accumulated Depreciation','ASSET','ACC_DEPRECIATION','ACC_DEP'),
 (NULL,'2100','Accounts Payable (Creditors)','LIABILITY','PAYABLE','AP'),
 (NULL,'2200','Output CGST','LIABILITY','TAX_OUTPUT','OUT_CGST'),
 (NULL,'2201','Output SGST','LIABILITY','TAX_OUTPUT','OUT_SGST'),
 (NULL,'2202','Output IGST','LIABILITY','TAX_OUTPUT','OUT_IGST'),
 (NULL,'2210','TDS Payable (Vendors)','LIABILITY','CURRENT_LIABILITY','TDS_PAY'),
 (NULL,'2300','Salary Payable','LIABILITY','PAYROLL_LIABILITY','SAL_PAY'),
 (NULL,'2310','PF Payable','LIABILITY','PAYROLL_LIABILITY','PF_PAY'),
 (NULL,'2320','ESI Payable','LIABILITY','PAYROLL_LIABILITY','ESI_PAY'),
 (NULL,'2330','Professional Tax Payable','LIABILITY','PAYROLL_LIABILITY','PT_PAY'),
 (NULL,'2340','TDS on Salary Payable','LIABILITY','PAYROLL_LIABILITY','TDS_SAL_PAY'),
 (NULL,'2400','Secured Loans','LIABILITY','LOAN',NULL),
 (NULL,'2500','Advances from Customers','LIABILITY','CURRENT_LIABILITY',NULL),
 (NULL,'3100','Capital / Share Capital','EQUITY','CAPITAL','CAPITAL'),
 (NULL,'3200','Retained Earnings','EQUITY','RETAINED_EARNINGS','RE'),
 (NULL,'3300','Opening Balance Equity','EQUITY','CAPITAL','OBE'),
 (NULL,'4100','Sales','INCOME','SALES','SALES'),
 (NULL,'4200','Service Income','INCOME','SALES',NULL),
 (NULL,'4900','Other Income','INCOME','OTHER_INCOME',NULL),
 (NULL,'4910','Interest Income','INCOME','OTHER_INCOME',NULL),
 (NULL,'4920','Gain on Sale of Assets','INCOME','OTHER_INCOME','GAIN_DISPOSAL'),
 (NULL,'5100','Purchases','EXPENSE','COGS','PURCHASES'),
 (NULL,'6100','Salaries & Wages','EXPENSE','PAYROLL_EXPENSE','SALARY_EXP'),
 (NULL,'6110','Employer PF Contribution','EXPENSE','PAYROLL_EXPENSE','PF_EXP'),
 (NULL,'6120','Employer ESI Contribution','EXPENSE','PAYROLL_EXPENSE','ESI_EXP'),
 (NULL,'6200','Rent','EXPENSE','INDIRECT_EXPENSE',NULL),
 (NULL,'6210','Electricity','EXPENSE','INDIRECT_EXPENSE',NULL),
 (NULL,'6220','Telephone & Internet','EXPENSE','INDIRECT_EXPENSE',NULL),
 (NULL,'6230','Travel & Conveyance','EXPENSE','INDIRECT_EXPENSE',NULL),
 (NULL,'6240','Printing & Stationery','EXPENSE','INDIRECT_EXPENSE',NULL),
 (NULL,'6250','Advertising & Marketing','EXPENSE','INDIRECT_EXPENSE',NULL),
 (NULL,'6260','Professional & Legal Fees','EXPENSE','INDIRECT_EXPENSE',NULL),
 (NULL,'6270','Repairs & Maintenance','EXPENSE','INDIRECT_EXPENSE',NULL),
 (NULL,'6280','Insurance','EXPENSE','INDIRECT_EXPENSE',NULL),
 (NULL,'6290','Office Expenses','EXPENSE','INDIRECT_EXPENSE',NULL),
 (NULL,'6800','Depreciation','EXPENSE','DEPRECIATION','DEP_EXP'),
 (NULL,'6810','Loss on Sale of Assets','EXPENSE','INDIRECT_EXPENSE','LOSS_DISPOSAL'),
 (NULL,'6900','Bank Charges','EXPENSE','FINANCE_COST','BANK_CHG'),
 (NULL,'6910','Interest on Loans','EXPENSE','FINANCE_COST',NULL),
 (NULL,'6990','Round Off','EXPENSE','ROUND_OFF','ROUND_OFF'),
 ('RETAIL','1300','Inventory – Stock-in-Trade','ASSET','INVENTORY',NULL),
 ('RETAIL','4110','Counter Sales','INCOME','SALES',NULL),
 ('RETAIL','4120','Online Marketplace Sales','INCOME','SALES',NULL),
 ('RETAIL','5110','Freight Inward','EXPENSE','DIRECT_EXPENSE',NULL),
 ('RETAIL','6300','Marketplace Commission','EXPENSE','INDIRECT_EXPENSE',NULL),
 ('RESTAURANT','1300','Inventory – Food & Beverages','ASSET','INVENTORY',NULL),
 ('RESTAURANT','4110','Food Sales','INCOME','SALES',NULL),
 ('RESTAURANT','4120','Beverage Sales','INCOME','SALES',NULL),
 ('RESTAURANT','4130','Delivery Platform Sales','INCOME','SALES',NULL),
 ('RESTAURANT','5110','Food Raw Material','EXPENSE','COGS',NULL),
 ('RESTAURANT','5120','Gas & Fuel','EXPENSE','DIRECT_EXPENSE',NULL),
 ('RESTAURANT','6300','Delivery Platform Commission','EXPENSE','INDIRECT_EXPENSE',NULL),
 ('RESTAURANT','1530','Kitchen Equipment','ASSET','FIXED_ASSET',NULL),
 ('MANUFACTURING','1300','Raw Material Inventory','ASSET','INVENTORY',NULL),
 ('MANUFACTURING','1310','Work-in-Progress','ASSET','INVENTORY',NULL),
 ('MANUFACTURING','1320','Finished Goods','ASSET','INVENTORY',NULL),
 ('MANUFACTURING','1530','Plant & Machinery','ASSET','FIXED_ASSET',NULL),
 ('MANUFACTURING','1540','Factory Building','ASSET','FIXED_ASSET',NULL),
 ('MANUFACTURING','4110','Scrap Sales','INCOME','SALES',NULL),
 ('MANUFACTURING','5110','Raw Material Consumed','EXPENSE','COGS',NULL),
 ('MANUFACTURING','5120','Power & Fuel','EXPENSE','DIRECT_EXPENSE',NULL),
 ('MANUFACTURING','5130','Factory Wages','EXPENSE','DIRECT_EXPENSE',NULL),
 ('MANUFACTURING','5140','Job Work Charges','EXPENSE','DIRECT_EXPENSE',NULL),
 ('TRADING','1300','Stock-in-Trade','ASSET','INVENTORY',NULL),
 ('TRADING','4110','Commission Income','INCOME','SALES',NULL),
 ('TRADING','5110','Freight Inward','EXPENSE','DIRECT_EXPENSE',NULL),
 ('TRADING','6300','Carriage Outward','EXPENSE','INDIRECT_EXPENSE',NULL),
 ('SERVICES','4110','Consulting Fees','INCOME','SALES',NULL),
 ('SERVICES','5110','Subcontractor Charges','EXPENSE','DIRECT_EXPENSE',NULL),
 ('IT_SOFTWARE','4110','Software Development Income','INCOME','SALES',NULL),
 ('IT_SOFTWARE','4120','SaaS Subscription Income','INCOME','SALES',NULL),
 ('IT_SOFTWARE','4130','AMC & Support Income','INCOME','SALES',NULL),
 ('IT_SOFTWARE','5110','Cloud Hosting','EXPENSE','DIRECT_EXPENSE',NULL),
 ('IT_SOFTWARE','5120','Software Licences','EXPENSE','DIRECT_EXPENSE',NULL),
 ('IT_SOFTWARE','5130','Contractor Payments','EXPENSE','DIRECT_EXPENSE',NULL),
 ('CONSTRUCTION','1330','Work-in-Progress (Projects)','ASSET','INVENTORY',NULL),
 ('CONSTRUCTION','1430','Retention Money Receivable','ASSET','CURRENT_ASSET',NULL),
 ('CONSTRUCTION','1550','Construction Equipment','ASSET','FIXED_ASSET',NULL),
 ('CONSTRUCTION','4110','Contract Revenue','INCOME','SALES',NULL),
 ('CONSTRUCTION','5110','Construction Materials','EXPENSE','COGS',NULL),
 ('CONSTRUCTION','5120','Labour Charges','EXPENSE','DIRECT_EXPENSE',NULL),
 ('CONSTRUCTION','5130','Equipment Hire','EXPENSE','DIRECT_EXPENSE',NULL),
 ('HEALTHCARE','1300','Medicine & Consumables Inventory','ASSET','INVENTORY',NULL),
 ('HEALTHCARE','1560','Medical Equipment','ASSET','FIXED_ASSET',NULL),
 ('HEALTHCARE','4110','Consultation Fees','INCOME','SALES',NULL),
 ('HEALTHCARE','4120','Pharmacy Sales','INCOME','SALES',NULL),
 ('HEALTHCARE','4130','Lab & Diagnostics Income','INCOME','SALES',NULL),
 ('HEALTHCARE','5110','Medicines & Consumables','EXPENSE','COGS',NULL),
 ('EDUCATION','2510','Fees Received in Advance','LIABILITY','CURRENT_LIABILITY',NULL),
 ('EDUCATION','4110','Tuition Fees','INCOME','SALES',NULL),
 ('EDUCATION','4120','Admission Fees','INCOME','SALES',NULL),
 ('EDUCATION','4130','Hostel & Transport Fees','INCOME','SALES',NULL),
 ('EDUCATION','5110','Faculty Salaries','EXPENSE','PAYROLL_EXPENSE',NULL),
 ('EDUCATION','6300','Books & Library','EXPENSE','INDIRECT_EXPENSE',NULL),
 ('TRANSPORT','1570','Vehicles','ASSET','FIXED_ASSET',NULL),
 ('TRANSPORT','4110','Freight Income','INCOME','SALES',NULL),
 ('TRANSPORT','5110','Fuel','EXPENSE','DIRECT_EXPENSE',NULL),
 ('TRANSPORT','5120','Driver Wages','EXPENSE','DIRECT_EXPENSE',NULL),
 ('TRANSPORT','5130','Tolls & Permits','EXPENSE','DIRECT_EXPENSE',NULL),
 ('TRANSPORT','5140','Vehicle Repairs','EXPENSE','DIRECT_EXPENSE',NULL),
 ('AGRICULTURE','1300','Produce Inventory','ASSET','INVENTORY',NULL),
 ('AGRICULTURE','1580','Farm Equipment','ASSET','FIXED_ASSET',NULL),
 ('AGRICULTURE','4110','Crop Sales','INCOME','SALES',NULL),
 ('AGRICULTURE','4120','Government Subsidy','INCOME','OTHER_INCOME',NULL),
 ('AGRICULTURE','5110','Seeds & Fertilisers','EXPENSE','COGS',NULL),
 ('AGRICULTURE','5120','Farm Labour','EXPENSE','DIRECT_EXPENSE',NULL),
 ('REAL_ESTATE','1340','Properties Held for Sale','ASSET','INVENTORY',NULL),
 ('REAL_ESTATE','2520','Customer Booking Advances','LIABILITY','CURRENT_LIABILITY',NULL),
 ('REAL_ESTATE','4110','Property Sales','INCOME','SALES',NULL),
 ('REAL_ESTATE','4120','Rental Income','INCOME','SALES',NULL),
 ('REAL_ESTATE','5110','Land & Construction Cost','EXPENSE','COGS',NULL),
 ('REAL_ESTATE','6300','Brokerage Paid','EXPENSE','INDIRECT_EXPENSE',NULL),
 ('NGO','3150','Corpus Fund','EQUITY','CAPITAL',NULL),
 ('NGO','4110','Donations Received','INCOME','SALES',NULL),
 ('NGO','4120','Grants Received','INCOME','SALES',NULL),
 ('NGO','5110','Programme Expenses','EXPENSE','DIRECT_EXPENSE',NULL);

-- Create a company: chart of accounts for its industry + current financial year + owner
CREATE OR REPLACE FUNCTION create_company(p_name TEXT, p_industry industry, p_state CHAR(2), p_owner INT, p_fy_month INT DEFAULT 4)
RETURNS INT AS $$
DECLARE c INT; fy_start DATE;
BEGIN
  INSERT INTO companies(name, industry, state_code, fy_start_month) VALUES (p_name, p_industry, p_state, p_fy_month) RETURNING id INTO c;
  INSERT INTO memberships VALUES (c, p_owner, 'OWNER');
  INSERT INTO accounts(company_id, code, name, type, subtype, system_key)
    SELECT c, code, name, type, subtype, system_key FROM coa_templates WHERE industry IS NULL OR industry = p_industry;
  fy_start := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT - CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) < p_fy_month THEN 1 ELSE 0 END, p_fy_month, 1);
  INSERT INTO fiscal_years(company_id, label, start_date, end_date)
    VALUES (c, fy_label(c, fy_start), fy_start, (fy_start + interval '1 year' - interval '1 day')::date);
  RETURN c;
END $$ LANGUAGE plpgsql;
