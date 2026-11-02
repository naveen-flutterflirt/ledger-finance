import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Layers,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

const DEMO_USERS = [
  { label: 'Owner (Full Access)', email: 'owner@fin.local', pass: 'Admin@123', role: 'OWNER' },
  { label: 'Accountant', email: 'accounts@fin.local', pass: 'Admin@123', role: 'ACCOUNTANT' },
  { label: 'HR Manager', email: 'hr@fin.local', pass: 'Admin@123', role: 'HR' },
  { label: 'Auditor', email: 'auditor@fin.local', pass: 'Admin@123', role: 'AUDITOR' },
  { label: 'Employee', email: 'employee@fin.local', pass: 'Admin@123', role: 'EMPLOYEE' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Signed in successfully');
      navigate('/');
    } catch (x: any) {
      const msg = x.message || 'Invalid email or password';
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const selectDemoUser = (user: typeof DEMO_USERS[0]) => {
    setEmail(user.email);
    setPassword(user.pass);
    setErr('');
  };

  return (
    <div className="auth">
      <div className="auth-container">
        <div className="auth-card">
          {/* Header & Brand */}
          <div className="auth-header">
            <div className="auth-logo-badge">
              <Layers size={22} strokeWidth={2.4} />
            </div>
            <h1 className="auth-title">
              Ledger<span style={{ color: 'var(--pink)' }}>Pilot</span>
            </h1>
            <p className="auth-subtitle">
              Enterprise accounting, GST compliance, banking &amp; payroll
            </p>
          </div>

          {/* Error Message */}
          {err && (
            <div className="err" role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{err}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div className="auth-input-group">
              <label htmlFor="login-email">Email address</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <Mail size={16} />
                </span>
                <input
                  id="login-email"
                  type="email"
                  required
                  className="auth-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-input-group" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="login-password">Password</label>
              </div>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <Lock size={16} />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="auth-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ paddingRight: 38 }}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in to Dashboard</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>



          {/* Footer */}
          <p className="muted" style={{ textAlign: 'center', marginTop: 22, fontSize: 13 }}>
            New company?{' '}
            <Link to="/register" style={{ fontWeight: 600, color: 'var(--indigo)' }}>
              Create an account →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
