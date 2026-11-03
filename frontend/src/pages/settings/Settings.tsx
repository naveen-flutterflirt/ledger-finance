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

        <h3 className="mt-6">Payroll statutory parameters</h3>
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
            className="btn primary mt-3.5"
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
        <p className="muted mb-3.5">
          Control role-based access and grant granular module permissions (Sales, Purchases, Accounting, Payroll, Reports) to each member.
        </p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="w-[70px]">User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Accessible Modules</th>
                <th className="right min-w-[160px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {team?.map(u => {
                const eff = u.effective_permissions || getRoleDefaults(u.role);
                const activeModules = MODULE_DEFS.filter(m => eff[m.key]);

                return (
                  <tr key={u.id}>
                    <td className="mono text-indigo font-semibold">
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
                      <span className="badge bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                        ⭐ All Modules (Owner)
                      </span>
                    ) : activeModules.length === 0 ? (
                      <span className="muted text-xs">
                        Payslips only (Employee)
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {activeModules.map(m => {
                          const modColorMap: Record<string, string> = {
                            sales: 'bg-blue-50 text-blue-700 border-blue-200',
                            purchases: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                            accounting: 'bg-amber-50 text-amber-800 border-amber-200',
                            payroll: 'bg-pink-50 text-pink-700 border-pink-200',
                            reports: 'bg-purple-50 text-purple-700 border-purple-200',
                          };
                          return (
                            <span
                              key={m.key}
                              className={`badge text-[11px] py-0.5 px-2 rounded border font-medium ${modColorMap[m.key] || 'bg-slate-50 text-slate-700 border-slate-200'}`}
                            >
                              {m.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="right whitespace-nowrap">
                    {owner && (
                      <div className="row justify-end gap-1.5">
                        <button
                          className="btn sm inline-flex items-center gap-1.5"
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
        </div>

        {owner && (
          <>
            <h4 className="mt-6 mb-2">Add or update team member</h4>
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
              <div className="bg-slate-50 border border-surface-line rounded-lg p-4 mt-3">
                <div className="font-semibold text-[13px] text-navy mb-2">
                  Module Permissions to Grant:
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
                  {MODULE_DEFS.map(mod => {
                    const checked = !!m.permissions?.[mod.key];
                    return (
                      <label
                        key={mod.key}
                        className="flex items-start gap-2 cursor-pointer text-[13px]"
                      >
                        <input
                          type="checkbox"
                          className="w-auto mt-1"
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
                          <div className="muted text-[11px]">
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
              className="btn primary mt-3.5"
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
          <p className="muted mt-0 mb-4">
            Configure which specific modules <b>{editAccessMember.name}</b> ({editAccessMember.email}) can see and access in LedgerPilot.
          </p>

          <div className="form mb-4">
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

          <div className="flex justify-between items-center mb-3">
            <span className="text-[13px] font-bold text-navy">
              Accessible Modules:
            </span>
            <div className="row gap-1.5">
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

          <div className="flex flex-col gap-2.5 bg-slate-50 border border-surface-line rounded-lg p-3.5">
            {MODULE_DEFS.map(mod => {
              const checked = !!accessPerms[mod.key];
              return (
                <label
                  key={mod.key}
                  className={`flex items-start gap-2.5 p-2 rounded-md transition-all ${checked ? 'bg-white border border-surface-line' : 'border border-transparent'} ${accessRole === 'OWNER' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    disabled={accessRole === 'OWNER'}
                    className="w-auto mt-1"
                    checked={accessRole === 'OWNER' ? true : checked}
                    onChange={e =>
                      setAccessPerms({
                        ...accessPerms,
                        [mod.key]: e.target.checked,
                      })
                    }
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-[13px] text-navy">
                      {mod.label} Module
                    </div>
                    <div className="muted text-xs">
                      {mod.desc}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="row justify-end mt-5 gap-2.5">
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
          className="btn mt-3.5"
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

