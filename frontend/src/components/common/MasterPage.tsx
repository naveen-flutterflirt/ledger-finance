import React, { useState } from 'react';
import { apiCall, useData } from '../../api/client.js';
import { Field, Modal, Msg, Btn } from './ui.js';
import { useToast } from '../../context/ToastContext.js';
import { Skeleton } from './Skeleton.js';
import { FolderOpen } from 'lucide-react';

export type FieldDef = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'checkbox' | 'date';
  options?: { value: string | number; label: string }[];
  required?: boolean;
};

export type Col = {
  key: string;
  label: string;
  num?: boolean;
  render?: (r: any) => React.ReactNode;
};

export default function MasterPage({
  title,
  endpoint,
  fields,
  columns,
  defaults = {},
  canEdit = true,
  extra,
  filterRows,
}: {
  title: string;
  endpoint: string;
  fields: FieldDef[];
  columns: Col[];
  defaults?: any;
  canEdit?: boolean;
  extra?: React.ReactNode;
  filterRows?: (r: any) => boolean;
}) {
  const { data, error, reload, loading } = useData<any[]>(endpoint);
  const [ed, setEd] = useState<any>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    const body: any = {};
    for (const f of fields) {
      const v = ed[f.name];
      if (f.type === 'checkbox') body[f.name] = !!v;
      else if (v !== undefined && v !== '') body[f.name] = v;
    }

    try {
      const targetId = ed.id;
      const res = await apiCall(targetId ? `${endpoint}/${targetId}` : endpoint, targetId ? 'PUT' : 'POST', body);
      const singularTitle = title.replace(/ies$/, 'y').replace(/s$/, '');
      const label = body.name || body.code || singularTitle;
      toast.success(`${label} saved successfully`);
      setEd(null);
      reload();
    } catch (x: any) {
      const msg = x.message || 'Failed to save';
      setErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>{title}</h1>
        <div className="row">
          {extra}
          {canEdit && (
            <button className="btn primary" onClick={() => setEd({ ...defaults })}>
              + New
            </button>
          )}
        </div>
      </div>

      <Msg err={error} />

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} className={c.num ? 'num' : ''}>
                  {c.label}
                </th>
              ))}
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {(loading || !data) ? (
              Array.from({ length: 5 }).map((_, r) => (
                <tr key={r}>
                  {columns.map((c, ci) => (
                    <td key={c.key} className={c.num ? 'num' : ''}>
                      <Skeleton width={ci === 0 ? '40%' : ci === 1 ? '70%' : '50%'} height={14} />
                    </td>
                  ))}
                  {canEdit && (
                    <td className="right">
                      <Skeleton width={44} height={24} borderRadius={4} />
                    </td>
                  )}
                </tr>
              ))
            ) : (
              (filterRows ? data?.filter(filterRows) : data)?.map((r, i) => (
                <tr key={r.id ?? i}>
                  {columns.map(c => (
                    <td key={c.key} className={c.num ? 'num' : ''}>
                      {c.render ? c.render(r) : String(r[c.key] ?? '—')}
                    </td>
                  ))}
                  {canEdit && (
                    <td className="right">
                      <button className="btn sm" onClick={() => setEd({ ...r })}>
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
            {data && !data.length && !loading && (
              <tr>
                <td colSpan={columns.length + (canEdit ? 1 : 0)}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <FolderOpen size={22} />
                    </div>
                    <div className="empty-state-title">No records found</div>
                    <div className="empty-state-sub">
                      There are no {title.toLowerCase()} recorded in the system yet.
                    </div>
                    {canEdit && (
                      <button className="btn primary sm" onClick={() => setEd({ ...defaults })}>
                        + Add first record
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {ed && (
        <Modal
          title={`${ed.id ? 'Edit' : 'New'} ${title.replace(/ies$/, 'y').replace(/s$/, '')}`}
          onClose={() => setEd(null)}
        >
          <Msg err={err} />
          <form onSubmit={save}>
            <div className="form">
              {fields.map(f => (
                <Field key={f.name} label={f.label + (f.required ? ' *' : '')}>
                  {f.type === 'select' ? (
                    <select
                      required={f.required}
                      value={ed[f.name] ?? ''}
                      onChange={e => setEd({ ...ed, [f.name]: e.target.value })}
                    >
                      <option value="">— select —</option>
                      {f.options!.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      style={{ width: 'auto' }}
                      checked={!!ed[f.name]}
                      onChange={e => setEd({ ...ed, [f.name]: e.target.checked })}
                    />
                  ) : (
                    <input
                      type={f.type ?? 'text'}
                      step="any"
                      required={f.required}
                      value={ed[f.name] ?? ''}
                      onChange={e => setEd({ ...ed, [f.name]: e.target.value })}
                    />
                  )}
                </Field>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="btn" onClick={() => setEd(null)} disabled={saving}>
                Cancel
              </button>
              <Btn type="submit" className="btn primary" loading={saving} loadingText="Saving...">
                Save
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

