import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import SessionBox from './SessionBox.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Layers,
  LayoutDashboard,
  FileText,
  FileMinus,
  Receipt,
  Users,
  ShoppingBag,
  FilePlus,
  CreditCard,
  Building2,
  BookOpen,
  BookText,
  Landmark,
  Coins,
  Package,
  Banknote,
  UserCheck,
  BarChart3,
  ListTree,
  Clock,
  Percent,
  CalendarDays,
  Wallet,
  Settings,
  LucideIcon,
} from 'lucide-react';

interface SidebarLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

export default function Sidebar() {
  const { role, canAccess } = useAuth();
  const location = useLocation();

  const isLinkActive = (to: string, end?: boolean) => {
    const [targetPath, targetQuery] = to.split('?');
    const currentPath = location.pathname;
    const currentQuery = location.search.replace(/^\?/, '');

    if (targetQuery) {
      return currentPath === targetPath && currentQuery.includes(targetQuery);
    }

    if (end) {
      return currentPath === targetPath && !location.search;
    }

    return currentPath === targetPath || currentPath.startsWith(targetPath + '/');
  };

  const NavItem = ({ to, icon: Icon, label, end }: SidebarLinkProps) => {
    const active = isLinkActive(to, end);
    return (
      <Link
        to={to}
        className={`side-nav-item ${active ? 'active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <Icon className="side-nav-icon" size={17} />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <aside className="side">
      {/* Brand Header */}
      <div className="brand-wrapper">
        <div className="brand-logo-icon">
          <Layers size={18} strokeWidth={2.4} />
        </div>
        <div className="brand-text">
          Ledger<span>Pilot</span>
        </div>
        <span className="brand-badge">PRO</span>
      </div>

      {/* Active Session & Company */}
      <SessionBox />

      {/* Navigation Sections */}
      <nav className="sidebar-nav">
        {canAccess('dashboard') && (
          <div className="side-section">
            <div className="side-section-title">Overview</div>
            <div className="side-links-group">
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" end />
            </div>
          </div>
        )}

        {canAccess('sales') && (
          <div className="side-section">
            <div className="side-section-title">Sales</div>
            <div className="side-links-group">
              <NavItem to="/docs/sales" icon={FileText} label="Sales invoices" />
              <NavItem to="/docs/credit-notes" icon={FileMinus} label="Credit notes" />
              <NavItem to="/vouchers?kind=RECEIPT" icon={Receipt} label="Receipts" />
              <NavItem to="/parties?kind=CUSTOMER" icon={Users} label="Customers" />
            </div>
          </div>
        )}

        {canAccess('purchases') && (
          <div className="side-section">
            <div className="side-section-title">Purchases</div>
            <div className="side-links-group">
              <NavItem to="/docs/purchases" icon={ShoppingBag} label="Purchase bills" />
              <NavItem to="/docs/debit-notes" icon={FilePlus} label="Debit notes" />
              <NavItem to="/vouchers?kind=PAYMENT" icon={CreditCard} label="Payments" />
              <NavItem to="/parties?kind=VENDOR" icon={Building2} label="Vendors" />
            </div>
          </div>
        )}

        {canAccess('accounting') && (
          <div className="side-section">
            <div className="side-section-title">Accounting</div>
            <div className="side-links-group">
              <NavItem to="/accounts" icon={BookOpen} label="Chart of accounts" />
              <NavItem to="/journals" icon={BookText} label="Journal entries" />
              <NavItem to="/banking" icon={Landmark} label="Bank reconciliation" />
              <NavItem to="/assets" icon={Coins} label="Fixed assets" />
              <NavItem to="/items" icon={Package} label="Items & services" />
            </div>
          </div>
        )}

        {canAccess('payroll') && (
          <div className="side-section">
            <div className="side-section-title">Payroll</div>
            <div className="side-links-group">
              <NavItem to="/payroll" icon={Banknote} label="Payroll runs" />
              <NavItem to="/employees" icon={UserCheck} label="Employees" />
            </div>
          </div>
        )}

        {canAccess('reports') && (
          <div className="side-section">
            <div className="side-section-title">Reports</div>
            <div className="side-links-group">
              <NavItem to="/reports" icon={BarChart3} label="Financial statements" end />
              <NavItem to="/reports/ledger" icon={ListTree} label="Ledgers" />
              <NavItem to="/reports/ageing" icon={Clock} label="Ageing" />
              <NavItem to="/reports/gst" icon={Percent} label="GST returns" />
              <NavItem to="/reports/daybook" icon={CalendarDays} label="Day book" />
            </div>
          </div>
        )}

        <div className="side-section">
          <div className="side-section-title">Account</div>
          <div className="side-links-group">
            <NavItem to="/me/payslips" icon={Wallet} label="My payslips" />
            {(role === 'OWNER' || role === 'ACCOUNTANT' || role === 'HR') && (
              <NavItem to="/settings" icon={Settings} label="Company & team" />
            )}
          </div>
        </div>
      </nav>
    </aside>
  );
}
