import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar.js';
import { useAuth } from '../../context/AuthContext.js';
import { Skeleton, DashboardSkeleton } from '../common/Skeleton.js';
import { Menu, Layers } from 'lucide-react';

export default function AppLayout() {
  const { user, company, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="app">
        <aside className="side">
          <div className="brand-wrapper">
            <img
              src="/logo.png"
              alt="Bluepeak"
              width={32}
              height={32}
              className="app-brand-logo"
            />
            <div className="brand-text">
              Blue<span>peak</span>
            </div>
          </div>
          <div className="px-1 pb-4">
            <Skeleton width="100%" height={38} borderRadius={8} className="mb-2.5" />
            <Skeleton width="60%" height={14} borderRadius={4} />
          </div>
          <div className="flex flex-col gap-3 mt-4">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <Skeleton key={i} width="92%" height={28} borderRadius={6} />
            ))}
          </div>
        </aside>
        <main className="main">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app">
      {/* Mobile Sticky Header */}
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>
        <div className="mobile-brand">
          <img
            src="/logo.png"
            alt="Bluepeak"
            width={26}
            height={26}
            className="mobile-brand-logo"
          />
          <span className="brand-text">
            Blue<span>peak</span>
          </span>
        </div>
        <div className="mobile-header-meta">
          {company && (
            <span className="mobile-co-badge" title={company.name}>
              {company.name}
            </span>
          )}
        </div>
      </header>

      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

