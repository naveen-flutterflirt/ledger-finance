# LedgerPilot — Enterprise Double-Entry Accounting & Financial Management

A complete company finance and double-entry accounting web platform designed for multi-industry businesses with full Indian statutory compliance (GST, Labour Codes PF/ESI/PT/TDS, Schedule III Financial Statements, Asset Depreciation, and Bank Reconciliation).

---

## Architecture Overview

LedgerPilot is built as a **decoupled, professional full-stack application**:

```
d:\ledeger-pilot\
├── backend/                  # Node.js + Express + TypeScript REST API
│   ├── db/                   # PostgreSQL schema, constraints, deferred triggers, and seed
│   ├── scripts/              # DB migration runner & 7-month API verification script
│   └── src/
│       ├── config/           # Database pool, environment variables
│       ├── controllers/      # HTTP request handlers & response formatters
│       ├── middleware/       # JWT authentication, role guards (RBAC), error handling
│       ├── models/           # Domain interfaces & Zod validation schemas
│       ├── repositories/     # Data access layer (DAO / raw SQL queries)
│       ├── routes/           # Express REST routers
│       ├── services/         # Accounting engine, GST math, payroll, BRS, assets
│       └── utils/            # Timezone-safe dates, currency math (r2 paise), GST rules
│
└── frontend/                 # React 18 + Vite + TypeScript Web Application
    └── src/
        ├── api/              # HTTP client with JWT interceptor & reactive useData hook
        ├── components/       # MasterPage, DocForm, UI components, SVG financial charts
        ├── context/          # Auth & company session state with RBAC helpers
        ├── pages/            # Dashboard, Invoices, Vouchers, Banking, Payroll, Reports, Settings
        ├── styles/           # Modern tabular design system & print-to-PDF stylesheets
        ├── types/            # TypeScript interfaces
        └── utils/            # Indian currency (₹) & date formatting
```

---

## Quick Start Guide

### 1. Database Setup & Initialization

Ensure your PostgreSQL instance (e.g. Neon DB or local PostgreSQL) is configured in `backend/.env`.

Run the automated database initialization script:
```bash
cd backend
npm run db:init
```
*This executes `backend/db/schema.sql` (tables, triggers, constraints) and `backend/db/seed.sql` (default users, companies, accounts, parties).*

### 2. Start the Backend API Server

```bash
cd backend
npm run dev
```
*The REST API will launch at `http://localhost:5000`.*

### 3. Start the Frontend Web Application

```bash
cd frontend
npm run dev
```
*The web application will launch at `http://localhost:3000` (proxied to port 5000).*

---

## Demo Credentials

All seeded demo accounts use password: `Admin@123`

| Role | Email | Permissions |
| :--- | :--- | :--- |
| **Owner** | `owner@fin.local` | Full access, settings, period close, user management |
| **Accountant** | `accounts@fin.local` | Invoices, vouchers, journals, banking, asset depreciation, reports |
| **HR Manager** | `hr@fin.local` | Employees, payroll runs, salary disbursements |
| **Auditor** | `auditor@fin.local` | Read-only access to general ledger and financial reports |
| **Employee** | `employee@fin.local` | Self-service portal to view and download personal payslips |

