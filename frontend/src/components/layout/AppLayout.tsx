import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar.js';
import { useAuth } from '../../context/AuthContext.js';
import { Skeleton, DashboardSkeleton } from '../common/Skeleton.js';

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app">
        <aside className="side">
          <div className="brand-wrapper">
            <div className="brand-logo-icon">
              <Skeleton width={18} height={18} borderRadius={4} />
            </div>
            <div className="brand-text">
              Ledger<span>Pilot</span>
            </div>
          </div>
          <div style={{ padding: '0 4px 16px' }}>
            <Skeleton width="100%" height={38} borderRadius={8} style={{ marginBottom: 10 }} />
            <Skeleton width="60%" height={14} borderRadius={4} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
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
      <Sidebar />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

