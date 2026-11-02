import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { ChevronDown, LogOut } from 'lucide-react';

export default function SessionBox() {
  const { user, company, companies, role, switchCompany, logout } = useAuth();

  // If no user is authenticated, don't show session box
  if (!user && !role) return null;

  const displayName = user?.name || 'Naveen (Owner)';
  const displayRole = role || 'OWNER';
  const displayCompany = company?.name || 'Bluepeak Technologies';
  const displayCompanyId = company?.id ?? 1;

  return (
    <div className="side-session-box">
      <div className="side-company-select-wrap">
        <select
          className="side-company-select"
          value={displayCompanyId}
          onChange={e => switchCompany(Number(e.target.value))}
          title="Active Company"
        >
          {companies && companies.length > 0 ? (
            companies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          ) : (
            <option value={displayCompanyId}>{displayCompany}</option>
          )}
        </select>
        <ChevronDown size={14} className="side-company-arrow" />
      </div>

      <div className="side-user-row">
        <div className="side-user-info">
          <div className="side-user-name" title={displayName}>
            {displayName}
          </div>
          <div className="side-user-role">{displayRole}</div>
        </div>

        <button
          type="button"
          className="side-signout-btn"
          onClick={logout}
          title="Sign out of account"
        >
          <LogOut size={13} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
