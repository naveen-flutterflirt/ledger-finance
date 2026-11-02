import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { INDUSTRIES, GST_STATES } from '../../utils/constants.js';
import { apiCall } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Layers,
  User,
  Mail,
  Building2,
  Briefcase,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function Register() {
  const [f, setF] = useState<any>({
    name: '',
    email: '',
    password: '',
    company_name: '',
    industry: 'SERVICES',
    state_code: '23',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const { refresh } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const data = await apiCall('/api/auth/register', 'POST', f);
      if (data.token) {
        localStorage.setItem('lp_token', data.token);
      }
      toast.success('Company created & double-entry books setup successfully!');
      await refresh();
      navigate('/');
    } catch (x: any) {
      const msg = x.message || 'Registration failed';
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-container wide">
        <div className="auth-card">
          {/* Header */}
          <div className="auth-header">
            <div className="auth-logo-badge">
              <Layers size={22} strokeWidth={2.4} />
            </div>
            <h1 className="auth-title">Set up your company</h1>
            <p className="auth-subtitle">
              Provision a complete double-entry chart of accounts customized to your industry.
            </p>
            <div className="auth-feature-pills">
              <span className="auth-feature-pill">✓ Double-entry books</span>
              <span className="auth-feature-pill">✓ GST compliant</span>
              <span className="auth-feature-pill">✓ Role-based access</span>
            </div>
          </div>

          {/* Error */}
          {err && (
            <div className="err" role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{err}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleRegister}>
            <div className="grid g2" style={{ gap: 14, marginBottom: 14 }}>
              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-name">Your full name *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <User size={16} />
                  </span>
                  <input
                    id="reg-name"
                    required
                    className="auth-input"
                    value={f.name}
                    onChange={set('name')}
                    placeholder="Naveen Sharma"
                  />
                </div>
              </div>

              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-email">Email address *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <Mail size={16} />
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    className="auth-input"
                    value={f.email}
                    onChange={set('email')}
                    placeholder="naveen@company.com"
                  />
                </div>
              </div>
            </div>

            <div className="grid g2" style={{ gap: 14, marginBottom: 14 }}>
              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-company">Company name *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <Building2 size={16} />
                  </span>
                  <input
                    id="reg-company"
                    required
                    className="auth-input"
                    value={f.company_name}
                    onChange={set('company_name')}
                    placeholder="Bluepeak Technologies Pvt Ltd"
                  />
                </div>
              </div>

              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-industry">Industry *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <Briefcase size={16} />
                  </span>
                  <select
                    id="reg-industry"
                    className="auth-select"
                    value={f.industry}
                    onChange={set('industry')}
                  >
                    {INDUSTRIES.map(i => (
                      <option key={i} value={i}>
                        {i.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid g2" style={{ gap: 14, marginBottom: 20 }}>
              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-state">GST State *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <MapPin size={16} />
                  </span>
                  <select
                    id="reg-state"
                    className="auth-select"
                    value={f.state_code}
                    onChange={set('state_code')}
                  >
                    {Object.entries(GST_STATES).map(([c, n]) => (
                      <option key={c} value={c}>
                        {c} · {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-password">Password (min. 8 characters) *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <Lock size={16} />
                  </span>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    className="auth-input"
                    value={f.password}
                    onChange={set('password')}
                    placeholder="••••••••"
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
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Provisioning company books...</span>
                </>
              ) : (
                <>
                  <span>Create Company &amp; Setup Accounts</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="muted" style={{ textAlign: 'center', marginTop: 22, fontSize: 13 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ fontWeight: 600, color: 'var(--indigo)' }}>
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
