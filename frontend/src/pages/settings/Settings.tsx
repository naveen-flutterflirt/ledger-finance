import React, { useEffect, useState } from 'react';
import { Field, Msg, Modal, Btn } from '../../components/common/ui.js';
import { FormSkeleton } from '../../components/common/Skeleton.js';
import { apiCall, useData } from '../../api/client.js';
import { INDUSTRIES, ROLES } from '../../utils/constants.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { fmtDate } from '../../utils/format.js';
import { Shield, Settings2, CheckSquare, Square } from 'lucide-react';

const MODULE_DEFS = [
  { key: 'sales', label: 'Sales', desc: 'Invoices, Credit notes, Receipts, Customers' },
  { key: 'purchases', label: 'Purchases', desc: 'Bills, Debit notes, Payments, Vendors' },
  { key: 'accounting', label: 'Accounting', desc: 'Chart of accounts, Journals, Banking, Assets, Items' },
  { key: 'payroll', label: 'Payroll', desc: 'Payroll runs, Employees & salary' },
  { key: 'reports', label: 'Reports', desc: 'Financial statements, Ledgers, Ageing, GST' },
];

const getRoleDefaults = (r: string): Record<string, boolean> => {
  switch (r) {
    case 'OWNER':
      return { sales: true, purchases: true, accounting: true, payroll: true, reports: true };
    case 'ACCOUNTANT':
      return { sales: true, purchases: true, accounting: true, payroll: false, reports: true };
    case 'HR':
      return { sales: false, purchases: false, accounting: false, payroll: true, reports: false };
    case 'AUDITOR':
      return { sales: true, purchases: true, accounting: true, payroll: true, reports: true };
    case 'EMPLOYEE':
    default:
      return { sales: false, purchases: false, accounting: false, payroll: false, reports: false };
  }
};

export default function Settings() {
  const { data: co, reload } = useData<any>('/api/company');
  const { data: lk } = useData<any>('/api/lookups');
  const { data: team, reload: rt } = useData<any[]>('/api/members');
  const { role, user, switchCompany } = useAuth();

  const [c, setC] = useState<any>(null);
  const [ps, setPs] = useState('');
  const [m, setM] = useState<any>({
    role: 'ACCOUNTANT',
    permissions: getRoleDefaults('ACCOUNTANT'),
  });
  const [nc, setNc] = useState<any>({ industry: 'TRADING', state_code: '23' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { toast } = useToast();

  // Access control modal state
  const [editAccessMember, setEditAccessMember] = useState<any>(null);
  const [accessRole, setAccessRole] = useState('ACCOUNTANT');
  const [accessPerms, setAccessPerms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (co) {
      setC(co);
      setPs(JSON.stringify(co.payroll_settings, null, 2));
    }
  }, [co]);

  const owner = role === 'OWNER';

  const run = async (key: string, fn: () => Promise<any>, msg: string) => {
    setErr('');
    setOk('');
    setBusyKey(key);
    try {
      await fn();
      setOk(msg);
      toast.success(msg);
      reload();
      rt();
    } catch (x: any) {
      setErr(x.message || 'Operation failed');
      toast.error(x.message || 'Operation failed');
    } finally {
      setBusyKey(null);
    }
  };

  if (!c || !lk) return <FormSkeleton fieldCount={6} />;

  const set = (k: string) => (e: any) => setC({ ...c, [k]: e.target.value });

  return (
    <>
      <div className="topbar">
        <h1>Company &amp; team settings</h1>
      </div>

      <Msg err={err} ok={ok} />

      <div className="card">
        <h3>Company profile</h3>
        <div className="form">
          <Field label="Company name">
            <input disabled={!owner} value={c.name} onChange={set('name')} />
          </Field>
          <Field label="Legal name">
            <input
              disabled={!owner}
              value={c.legal_name ?? ''}
              onChange={set('legal_name')}
            />
          </Field>
          <Field label="Industry">
            <select
              disabled={!owner}
              value={c.industry}
              onChange={set('industry')}
            >
              {INDUSTRIES.map(i => (
                <option key={i} value={i}>
                  {i.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="GSTIN">
            <input
              disabled={!owner}
              value={c.gstin ?? ''}
              onChange={set('gstin')}
            />
          </Field>
          <Field label="PAN">
            <input disabled={!owner} value={c.pan ?? ''} onChange={set('pan')} />
          </Field>
          <Field label="State">
            <select
              disabled={!owner}
              value={c.state_code}
              onChange={set('state_code')}
            >
              {Object.entries(lk.states).map(([k, n]: any) => (
                <option key={k} value={k}>
                  {k} · {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Email">
            <input
              disabled={!owner}
              value={c.email ?? ''}
              onChange={set('email')}
            />
          </Field>
          <Field label="Phone">
            <input
              disabled={!owner}
              value={c.phone ?? ''}
              onChange={set('phone')}
            />
          </Field>
          <Field label="Books locked up to (no edits on/before)">
            <input
              disabled={!owner}
              type="date"
              value={c.lock_date ?? ''}
              onChange={set('lock_date')}
            />
          </Field>
          <Field label="Address" wide>
            <input
              disabled={!owner}
              value={c.address ?? ''}
              onChange={set('address')}
            />
          </Field>
        </div>

        <h3 style={{ marginTop: 24 }}>Payroll statutory parameters</h3>
        <p className="muted">
          PF wage ceiling ₹25,000, ESI ceiling ₹21,000, Labour-Code 50% wage rule, and state PT slabs.
        </p>
        <textarea
          disabled={!owner}
          rows={8}
          className="mono"
          value={ps}
          onChange={e => setPs(e.target.value)}
        />

        {owner && (
          <Btn
            className="btn primary"
            style={{ marginTop: 14 }}
            loading={busyKey === 'save_company'}
            loadingText="Saving company settings..."
            onClick={() =>
              run('save_company', async () => {
                let p;
                try {
                  p = JSON.parse(ps);
                } catch {
                  throw new Error('Payroll settings must be valid JSON');
                }
                await apiCall('/api/company', 'PUT', { ...c, payroll_settings: p });
              }, 'Company profile and statutory rules saved')
            }
          >
            Save company settings
          </Btn>
        )}
      </div>

      <div className="card">
        <h3>Financial years &amp; period closing</h3>
        <table>
          <thead>
            <tr>
              <th>Financial Year</th>
              <th>Start date</th>
              <th>End date</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {c.years?.map((y: any) => (
              <tr key={y.id}>
                <td>
                  <b>{y.label}</b>
                </td>
                <td>{fmtDate(y.start_date)}</td>
                <td>{fmtDate(y.end_date)}</td>
                <td>
                  <span className={`badge ${y.closed ? 's-PAID' : 's-OPEN'}`}>
                    {y.closed ? 'CLOSED' : 'OPEN'}
                  </span>
                </td>
                <td>
                  {owner && !y.closed && (
                    <Btn
                      className="btn sm ghost-red"
                      loading={busyKey === `close_year_${y.id}`}
                      loadingText="Closing..."
                      onClick={() =>
                        confirm(
                          `Close FY ${y.label}? Profit will transfer to Retained Earnings and the year will be locked.`
                        ) &&
                        run(
                          `close_year_${y.id}`,
                          () => apiCall(`/api/years/${y.id}/close`, 'POST'),
                          `FY ${y.label} closed successfully`
                        )
                      }
                    >
                      Close year
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Team members &amp; Module Access</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Control role-based access and grant granular module permissions (Sales, Purchases, Accounting, Payroll, Reports) to each member.
        </p>
        <table>
          <thead>
            <tr>
              <th style={{ width: 70 }}>User ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Accessible Modules</th>
              <th className="right" style={{ minWidth: 160 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {team?.map(u => {
              const eff = u.effective_permissions || getRoleDefaults(u.role);
              const activeModules = MODULE_DEFS.filter(m => eff[m.key]);

              return (
                <tr key={u.id}>
                  <td className="mono" style={{ color: 'var(--indigo)', fontWeight: 600 }}>
                    #{u.id}
                  </td>
                  <td>
                    <b>{u.name}</b>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge">{u.role}</span>
                  </td>
                  <td>
                    {u.role === 'OWNER' ? (
                      <span
                        className="badge"
                        style={{
                          background: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0',
                          fontWeight: 600,
                        }}
                      >
                        ⭐ All Modules (Owner)
                      </span>
                    ) : activeModules.length === 0 ? (
                      <span className="muted" style={{ fontSize: 12 }}>
                        Payslips only (Employee)
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {activeModules.map(m => (
                          <span
                            key={m.key}
                            className="badge"
                            style={{
                              fontSize: 11,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background:
                                m.key === 'sales'
                                  ? '#eff6ff'
                                  : m.key === 'purchases'
                                  ? '#f0fdf4'
                                  : m.key === 'accounting'
                                  ? '#fffbeb'
                                  : m.key === 'payroll'
                                  ? '#fdf2f8'
                                  : '#faf5ff',
                              color:
                                m.key === 'sales'
                                  ? '#1d4ed8'
                                  : m.key === 'purchases'
                                  ? '#15803d'
                                  : m.key === 'accounting'
                                  ? '#b45309'
                                  : m.key === 'payroll'
                                  ? '#be185d'
                                  : '#7e22ce',
                              border:
                                m.key === 'sales'
                                  ? '1px solid #bfdbfe'
                                  : m.key === 'purchases'
                                  ? '1px solid #bbf7d0'
                                  : m.key === 'accounting'
                                  ? '1px solid #fde68a'
                                  : m.key === 'payroll'
                                  ? '1px solid #fbcfe8'
                                  : '1px solid #e9d5ff',
                            }}
                          >
                            {m.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="right" style={{ whiteSpace: 'nowrap' }}>
                    {owner && (
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          className="btn sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          onClick={() => {
                            setEditAccessMember(u);
                            setAccessRole(u.role);
                            const perms = u.effective_permissions || getRoleDefaults(u.role);
                            setAccessPerms({
                              sales: !!perms.sales,
                              purchases: !!perms.purchases,
                              accounting: !!perms.accounting,
                              payroll: !!perms.payroll,
                              reports: !!perms.reports,
                            });
                          }}
                          title="Configure module access permissions"
                        >
                          <Shield size={13} />
                          Manage Access
                        </button>
                        {u.id !== user?.id && (
                          <Btn
                            className="btn sm ghost-red"
                            loading={busyKey === `remove_member_${u.id}`}
                            loadingText="Removing..."
                            onClick={() =>
                              run(
                                `remove_member_${u.id}`,
                                () => apiCall('/api/members', 'DELETE', { user_id: u.id }),
                                'Member removed successfully'
                              )
                            }
                          >
                            Remove
                          </Btn>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {owner && (
          <>
            <h4 style={{ marginTop: 24, marginBottom: 8 }}>Add or update team member</h4>
            <div className="form">
              <Field label="Email address">
                <input
                  value={m.email ?? ''}
                  onChange={e => setM({ ...m, email: e.target.value })}
                  placeholder="colleague@company.com"
                />
              </Field>
              <Field label="Role">
                <select
                  value={m.role}
                  onChange={e => {
                    const r = e.target.value;
                    setM({ ...m, role: r, permissions: getRoleDefaults(r) });
                  }}
                >
                  {ROLES.map(([r, d]) => (
                    <option key={r} value={r}>
                      {r} — {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Name (for new users)">
                <input
                  value={m.name ?? ''}
                  onChange={e => setM({ ...m, name: e.target.value })}
                />
              </Field>
              <Field label="Temporary password (for new users)">
                <input
                  type="password"
                  value={m.password ?? ''}
                  onChange={e => setM({ ...m, password: e.target.value })}
                />
              </Field>
            </div>

            {m.role !== 'OWNER' && (
              <div
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  marginTop: 12,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)', marginBottom: 8 }}>
                  Module Permissions to Grant:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  {MODULE_DEFS.map(mod => {
                    const checked = !!m.permissions?.[mod.key];
                    return (
                      <label
                        key={mod.key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        <input
                          type="checkbox"
                          style={{ width: 'auto', marginTop: 3 }}
                          checked={checked}
                          onChange={e =>
                            setM({
                              ...m,
                              permissions: {
                                ...m.permissions,
                                [mod.key]: e.target.checked,
                              },
                            })
                          }
                        />
                        <div>
                          <b>{mod.label}</b>
                          <div className="muted" style={{ fontSize: 11 }}>
                            {mod.desc}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <Btn
              className="btn primary"
              style={{ marginTop: 14 }}
              loading={busyKey === 'save_member'}
              loadingText="Saving member..."
              onClick={() =>
                run('save_member', () => apiCall('/api/members', 'POST', m), 'Member saved successfully')
              }
            >
              Save member
            </Btn>
          </>
        )}
      </div>

      {/* Edit Access Modal */}
      {editAccessMember && (
        <Modal
          title={`Module Access Permissions: ${editAccessMember.name}`}
          onClose={() => setEditAccessMember(null)}
        >
          <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
            Configure which specific modules <b>{editAccessMember.name}</b> ({editAccessMember.email}) can see and access in LedgerPilot.
          </p>

          <div className="form" style={{ marginBottom: 16 }}>
            <Field label="Assigned Role">
              <select
                value={accessRole}
                onChange={e => {
                  const r = e.target.value;
                  setAccessRole(r);
                  setAccessPerms(getRoleDefaults(r));
                }}
              >
                {ROLES.map(([r, d]) => (
                  <option key={r} value={r}>
                    {r} — {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
              Accessible Modules:
            </span>
            <div className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className="btn sm"
                onClick={() =>
                  setAccessPerms({ sales: true, purchases: true, accounting: true, payroll: true, reports: true })
                }
              >
                Grant All
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() =>
                  setAccessPerms(getRoleDefaults(accessRole))
                }
              >
                Role Default
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() =>
                  setAccessPerms({ sales: false, purchases: false, accounting: false, payroll: false, reports: false })
                }
              >
                Clear All
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: 14,
            }}
          >
            {MODULE_DEFS.map(mod => {
              const checked = !!accessPerms[mod.key];
              return (
                <label
                  key={mod.key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    cursor: accessRole === 'OWNER' ? 'not-allowed' : 'pointer',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: checked ? 'var(--white)' : 'transparent',
                    border: checked ? '1px solid var(--line)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    disabled={accessRole === 'OWNER'}
                    style={{ width: 'auto', marginTop: 3 }}
                    checked={accessRole === 'OWNER' ? true : checked}
                    onChange={e =>
                      setAccessPerms({
                        ...accessPerms,
                        [mod.key]: e.target.checked,
                      })
                    }
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)' }}>
                      {mod.label} Module
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {mod.desc}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20, gap: 10 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setEditAccessMember(null)}
            >
              Cancel
            </button>
            <Btn
              className="btn primary"
              loading={busyKey === 'save_permissions'}
              loadingText="Saving permissions..."
              onClick={async () => {
                await run(
                  'save_permissions',
                  () =>
                    apiCall('/api/members', 'PUT', {
                      user_id: editAccessMember.id,
                      role: accessRole,
                      permissions: accessRole === 'OWNER' ? null : accessPerms,
                    }),
                  `Permissions updated for ${editAccessMember.name}`
                );
                setEditAccessMember(null);
              }}
            >
              Save permissions
            </Btn>
          </div>
        </Modal>
      )}

      <div className="card">
        <h3>Add another company</h3>
        <p className="muted">
          Each company gets its own independent books, industry chart of accounts, GST and payroll rules.
        </p>
        <div className="form">
          <Field label="Company name">
            <input
              value={nc.name ?? ''}
              onChange={e => setNc({ ...nc, name: e.target.value })}
              placeholder="e.g. Sunrise Trading LLP"
            />
          </Field>
          <Field label="Industry">
            <select
              value={nc.industry}
              onChange={e => setNc({ ...nc, industry: e.target.value })}
            >
              {INDUSTRIES.map(i => (
                <option key={i} value={i}>
                  {i.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="State">
            <select
              value={nc.state_code}
              onChange={e => setNc({ ...nc, state_code: e.target.value })}
            >
              {Object.entries(lk.states).map(([k, n]: any) => (
                <option key={k} value={k}>
                  {k} · {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="GSTIN">
            <input
              value={nc.gstin ?? ''}
              onChange={e => setNc({ ...nc, gstin: e.target.value })}
            />
          </Field>
        </div>
        <Btn
          className="btn"
          style={{ marginTop: 14 }}
          loading={busyKey === 'create_co'}
          loadingText="Creating company & switching..."
          onClick={() =>
            run(
              'create_co',
              async () => {
                const res = await apiCall('/api/company', 'POST', nc);
                await switchCompany(res.id);
              },
              'Company created & switched'
            )
          }
        >
          Create company &amp; switch
        </Btn>
      </div>
    </>
  );
}

