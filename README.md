# LedgerPilot — Enterprise Double-Entry Accounting & Financial Management

LedgerPilot is an enterprise-grade double-entry accounting, compliance, and financial management web platform. Designed for multi-entity businesses, it offers complete Indian statutory compliance, automated transaction workflows, banking reconciliation, payroll processing, and Schedule III financial statements.

---

## Key Features

- **Strict Double-Entry Ledger Engine**: Immutable journals, automated balanced dual-leg postings, running account balances, and period locking.
- **Indian Statutory GST Compliance**:
  - Auto-calculation for Intra-state (CGST + SGST) and Inter-state (IGST) transactions.
  - HSN/SAC code management and reverse charge mechanisms.
  - One-click GSTR-1 and GSTR-3B filing summaries with JSON/tabular exports.
- **Statutory Payroll & HR Engine**:
  - Automated calculation of Provident Fund (PF), Employee State Insurance (ESI), Professional Tax (PT), and TDS deductions.
  - Monthly batch payroll runs, automated ledger journal creation, and printable employee payslips.
- **Banking & Reconciliation (BRS)**:
  - Bank and cash account management.
  - Transaction clearing, statement upload, and real-time reconciliation against ledger records.
- **Fixed Asset Management**:
  - Asset acquisition tracking, salvage value handling, and depreciation schedules (Straight Line Method & Written Down Value).
- **Financial Reporting**:
  - Schedule III compliant Balance Sheet and Profit & Loss (P&L) statements.
  - Real-time Trial Balance, General Ledger view, Day Book, and AR/AP Ageing analysis.
- **Enterprise Security & Multi-Tenancy**:
  - Multi-tenant company switching.
  - Fine-grained Role-Based Access Control (RBAC) with secure JWT authentication and bcrypt password hashing.

---

## Tech Stack

### Backend
- **Runtime & Language**: Node.js, TypeScript (ESM)
- **Framework**: Express.js
- **Database**: PostgreSQL (with connection pooling, deferred triggers, and index optimizations)
- **Validation & Auth**: Zod schemas, `jose` JWT tokens, `bcryptjs`
- **Deployment**: Serverless ready (Vercel) or standalone Node server

### Frontend
- **Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, PostCSS, responsive tabular layouts
- **Icons & Visuals**: Lucide React, pure SVG financial charts
- **State & Networking**: Context API (Auth, Session, Toast), Axios/Fetch with JWT auto-refresh

---

## Project Structure

```
ledeger-pilot/
├── backend/                      # Node.js + Express + TypeScript REST API
│   ├── api/                      # Serverless entrypoint (Vercel)
│   ├── db/                       # PostgreSQL schema, migrations & seed scripts
│   │   ├── schema.sql            # Core tables, constraints & triggers
│   │   ├── seed.sql              # Default chart of accounts, master data & demo fixtures
│   │   └── optimize_indexes.sql  # High-performance indexes for reporting
│   ├── scripts/                  # Database management & CLI tools
│   │   ├── init-db.ts            # Schema and seed runner
│   │   ├── optimize-db.ts        # Performance index runner
│   │   └── demo.mjs              # Multi-month automated transaction simulator
│   └── src/
│       ├── config/               # Database pool & environment variables
│       ├── controllers/          # HTTP request controllers
│       ├── middleware/           # JWT authentication, RBAC, error handling, rate limiting
│       ├── models/               # Domain interfaces & Zod schemas
│       ├── repositories/         # SQL query access layer (DAO)
│       ├── routes/               # Express API route modules
│       ├── services/             # Core accounting, GST, payroll & report engines
│       └── utils/                # Date formatting, GST computation, currency math
│
├── frontend/                     # React 18 + Vite + TypeScript Web Application
│   ├── public/                   # Static assets & favicons
│   │   ├── favicon.ico
│   │   └── logo.png
│   └── src/
│       ├── api/                  # API client & reactive data fetcher
│       ├── components/           # Reusable UI components, master forms, charts & layout
│       │   ├── common/           # Form builders, KPI cards, table skeletons, UI controls
│       │   └── layout/           # Header, sidebar navigation, company session selector
│       ├── context/              # Authentication & global notification state
│       ├── pages/                # Views (Dashboard, Invoices, Vouchers, Banking, Payroll, Reports)
│       ├── styles/               # Global CSS & Tailwind design directives
│       ├── types/                # TypeScript shared models
│       └── utils/                # Formatting utilities & constants
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 18+ or 20+
- PostgreSQL database (Local or hosted service like Neon DB, AWS RDS, Supabase)
- npm or pnpm

---

### Step 1: Environment Configuration

Create a `.env` file in the `backend/` directory by copying `.env.example`:

```bash
cd backend
cp .env.example .env
```

Fill in your configuration details (**never commit `.env` to source control**):

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database>?sslmode=require
JWT_SECRET=<your-secure-random-secret-at-least-32-chars>
CORS_ORIGINS=http://localhost:3000
```

Create a `.env` file in the `frontend/` directory by copying `.env.example`:

```bash
cd ../frontend
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:5000
```

---

### Step 2: Database Setup & Migration

Initialize the schema and seed default chart of accounts:

```bash
cd backend
npm install
npm run db:init
```

Apply high-performance reporting indexes:

```bash
npm run db:optimize
```

---

### Step 3: Run the Application

#### Start the Backend Server:
```bash
cd backend
npm run dev
```
The REST API will be running at `http://localhost:5000`.

#### Start the Frontend Web App:
```bash
cd frontend
npm install
npm run dev
```
The frontend application will be accessible at `http://localhost:3000`.



### Backend Production Build
```bash
cd backend
npm run build
npm start
```

### Frontend Production Build
```bash
cd frontend
npm run build
```
The compiled SPA will be output to `frontend/dist/`.

### Vercel Deployment
- Both `backend/` and `frontend/` include `vercel.json` configurations.
- For backend, requests are rewritten to the serverless handler `api/index.ts`.
- For frontend, client-side routing is handled via SPA rewrites to `/index.html`.
- Set the environment variables in your Vercel Project Settings without committing secrets.

---

## License

This project is proprietary and intended for authorized internal use.
