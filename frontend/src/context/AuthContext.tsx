import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiCall } from '../api/client.js';
import { User, Company, Role, ModulePermissions } from '../types/index.js';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  companies: Company[];
  role: Role | null;
  permissions: ModulePermissions | null;
  loading: boolean;
  login: (email: string, pass: string, companyId?: number) => Promise<void>;
  logout: () => Promise<void>;
  switchCompany: (companyId: number) => Promise<void>;
  refresh: () => Promise<void>;
  canAccess: (mod: 'dashboard' | 'sales' | 'purchases' | 'accounting' | 'payroll' | 'reports') => boolean;
  canReadFin: boolean;
  canWriteFin: boolean;
  canReadPay: boolean;
  canWritePay: boolean;
}

const AuthContext = createContext<AuthContextType>(null as any);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<ModulePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiCall<{
        user: User;
        role: Role;
        permissions?: ModulePermissions;
        company: Company;
        companies: Company[];
      }>('/api/auth/me');
      setUser(data.user);
      setRole(data.role);
      setCompany(data.company);
      setCompanies(data.companies || []);
      setPermissions(data.permissions ?? data.company?.permissions ?? null);
    } catch {
      setUser(null);
      setRole(null);
      setCompany(null);
      setCompanies([]);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, pass: string, companyId?: number) => {
    const data = await apiCall('/api/auth/login', 'POST', {
      email,
      password: pass,
      company_id: companyId,
    });
    if (data.token) {
      localStorage.setItem('lp_token', data.token);
    }
    setUser(data.user);
    setCompany(data.company);
    setCompanies(data.companies || []);
    setRole(data.company?.role ?? data.role ?? null);
    setPermissions(data.permissions ?? data.company?.permissions ?? null);
  };

  const logout = async () => {
    try {
      await apiCall('/api/auth/logout', 'POST');
    } finally {
      localStorage.removeItem('lp_token');
      setUser(null);
      setCompany(null);
      setRole(null);
      setCompanies([]);
      setPermissions(null);
      window.location.href = '/login';
    }
  };

  const switchCompany = async (companyId: number) => {
    const data = await apiCall('/api/auth/switch', 'POST', { company_id: companyId });
    if (data.token) {
      localStorage.setItem('lp_token', data.token);
    }
    await refresh();
    window.location.href = '/';
  };

  const canAccess = useCallback(
    (mod: 'dashboard' | 'sales' | 'purchases' | 'accounting' | 'payroll' | 'reports'): boolean => {
      if (role === 'OWNER') return true;
      const currentPerms = permissions ?? (company as any)?.permissions;
      if (currentPerms && typeof currentPerms[mod] === 'boolean') {
        return !!currentPerms[mod];
      }
      // Fallback to role defaults
      switch (role) {
        case 'ACCOUNTANT':
          return mod !== 'payroll';
        case 'HR':
          return mod === 'payroll' || mod === 'dashboard';
        case 'AUDITOR':
          return true;
        case 'EMPLOYEE':
          return false;
        default:
          return false;
      }
    },
    [role, permissions, company]
  );

  const isAuditor = role === 'AUDITOR';
  const canReadFin = canAccess('sales') || canAccess('purchases') || canAccess('accounting') || canAccess('reports');
  const canWriteFin = !isAuditor && canReadFin;
  const canReadPay = canAccess('payroll');
  const canWritePay = !isAuditor && canReadPay;

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        companies,
        role,
        permissions,
        loading,
        login,
        logout,
        switchCompany,
        refresh,
        canAccess,
        canReadFin,
        canWriteFin,
        canReadPay,
        canWritePay,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

