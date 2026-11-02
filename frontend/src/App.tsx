import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { ToastProvider } from './context/ToastContext.js';
import AppLayout from './components/layout/AppLayout.js';

// Pages
import Login from './pages/auth/Login.js';
import Register from './pages/auth/Register.js';
import Dashboard from './pages/dashboard/Dashboard.js';
import DocList from './pages/docs/DocList.js';
import DocView from './pages/docs/DocView.js';
import NewDoc from './pages/docs/NewDoc.js';
import Vouchers from './pages/vouchers/Vouchers.js';
import Banking from './pages/banking/Banking.js';
import Assets from './pages/assets/Assets.js';
import Payroll from './pages/payroll/Payroll.js';
import PayrollRun from './pages/payroll/PayrollRun.js';
import PayslipView from './pages/payroll/PayslipView.js';
import MyPayslips from './pages/payroll/MyPayslips.js';
import Journals from './pages/journals/Journals.js';
import NewJournal from './pages/journals/NewJournal.js';
import JournalView from './pages/journals/JournalView.js';
import Accounts from './pages/masters/Accounts.js';
import Parties from './pages/masters/Parties.js';
import Items from './pages/masters/Items.js';
import Employees from './pages/masters/Employees.js';
import Statements from './pages/reports/Statements.js';
import GstReturns from './pages/reports/GstReturns.js';
import Ledger from './pages/reports/Ledger.js';
import Ageing from './pages/reports/Ageing.js';
import DayBook from './pages/reports/DayBook.js';
import Settings from './pages/settings/Settings.js';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Application Routes */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />

            {/* Sales & Purchases */}
            <Route path="/docs/:kind" element={<DocList />} />
            <Route path="/docs/:kind/new" element={<NewDoc />} />
            <Route path="/docs/:kind/:id" element={<DocView />} />

            {/* Receipts & Payments */}
            <Route path="/vouchers" element={<Vouchers />} />

            {/* Accounting & Banking */}
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/journals" element={<Journals />} />
            <Route path="/journals/new" element={<NewJournal />} />
            <Route path="/journals/:id" element={<JournalView />} />
            <Route path="/banking" element={<Banking />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/items" element={<Items />} />
            <Route path="/parties" element={<Parties />} />

            {/* Payroll & Payslips */}
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/payroll/:id" element={<PayrollRun />} />
            <Route path="/payslips/:id" element={<PayslipView />} />
            <Route path="/me/payslips" element={<MyPayslips />} />
            <Route path="/employees" element={<Employees />} />

            {/* Financial Statements & Statutory Reports */}
            <Route path="/reports" element={<Statements />} />
            <Route path="/reports/gst" element={<GstReturns />} />
            <Route path="/reports/ledger" element={<Ledger />} />
            <Route path="/reports/ageing" element={<Ageing />} />
            <Route path="/reports/daybook" element={<DayBook />} />

            {/* Settings & Admin */}
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);
}

