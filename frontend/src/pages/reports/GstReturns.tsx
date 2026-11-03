import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, inr2 } from '../../utils/format.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import { useData } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';

const prevMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};

const end = (m: string) =>
  new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);

const Row4 = ({ l, v, strong }: { l: string; v: any; strong?: boolean }) => (
  <tr className={strong ? 'tot' : ''}>
    <td>{l}</td>
    <td className="num">{inr2(v?.taxable ?? 0)}</td>
    <td className="num">{inr2(v?.igst ?? 0)}</td>
    <td className="num">{inr2(v?.cgst ?? 0)}</td>
    <td className="num">{inr2(v?.sgst ?? 0)}</td>
  </tr>
);

export default function GstReturns() {
  const [m, setM] = useState(prevMonth());
  const [tab, setTab] = useState<'3b' | 'r1' | 'hsn'>('3b');
  const { data: d, loading } = useData<any>(
    `/api/reports/gst?from=${m}-01&to=${end(m)}`
  );

  const { toast } = useToast();

  const downloadCsv = () => {
    if (!d?.gstr1?.b2b) {
      toast.warning('No B2B invoices to export for this period');
      return;
    }
    const rows = [
      ['GSTIN', 'Party', 'Invoice', 'Date', 'POS', 'Taxable', 'IGST', 'CGST', 'SGST', 'Total'],
      ...d.gstr1.b2b.map((x: any) => [
        x.gstin,
        x.party,
        x.doc_no,
        x.doc_date,
        x.place_of_supply,
        x.taxable_value,
        x.igst,
        x.cgst,
        x.sgst,
        x.total,
      ]),
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    );
    a.download = `GSTR1_B2B_${m}.csv`;
    a.click();
    toast.success(`GSTR-1 B2B CSV exported for ${m}`);
  };

  return (
    <>
      <div className="topbar">
        <h1>GST returns · {d?.gstin ?? '—'}</h1>
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          <div className="tabs shrink-0">
            {[
              ['3b', 'GSTR-3B summary'],
              ['r1', 'GSTR-1 invoices'],
              ['hsn', 'HSN summary'],
            ].map(([k, l]) => (
              <button
                key={k}
                className={tab === k ? 'on' : ''}
                onClick={() => setTab(k as any)}
              >
                {l}
              </button>
            ))}
          </div>

          <input
            type="month"
            value={m}
            onChange={e => setM(e.target.value)}
          />

          {d && (
            <button className="btn whitespace-nowrap" onClick={downloadCsv}>
              Export B2B CSV
            </button>
          )}
        </div>
      </div>

      {loading && <TableSkeleton rows={6} cols={6} />}

      {d && tab === '3b' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 min-w-0">
          <div className="card min-w-0 overflow-x-auto">
            <h3>3.1 Outward supplies &amp; 4. Eligible ITC</h3>
            <table>
              <thead>
                <tr>
                  <th />
                  <th className="num">Taxable</th>
                  <th className="num">IGST</th>
                  <th className="num">CGST</th>
                  <th className="num">SGST</th>
                </tr>
              </thead>
              <tbody>
                <Row4
                  l="(a) Outward taxable supplies (net of credit notes)"
                  v={d.gstr3b.outward}
                />
                <Row4
                  l="(d) Inward supplies liable to reverse charge (RCM)"
                  v={d.gstr3b.reverse_charge}
                />
                <Row4
                  l="4(A) Eligible ITC (net of debit notes)"
                  v={d.gstr3b.itc}
                  strong
                />
              </tbody>
            </table>
          </div>

          <div className="card min-w-0 overflow-x-auto">
            <h3>Payment of tax (after legal ITC set-off)</h3>
            <table>
              <tbody>
                {(['igst', 'cgst', 'sgst'] as const).map(h => (
                  <tr key={h}>
                    <td>{h.toUpperCase()} payable in cash</td>
                    <td className="num">{inr2(d.gstr3b.cash_payable[h])}</td>
                  </tr>
                ))}
                <tr className="tot">
                  <td>Total cash payable</td>
                  <td className="num">{inr2(d.gstr3b.total_payable)}</td>
                </tr>
                {(['igst', 'cgst', 'sgst'] as const).map(
                  h =>
                    d.gstr3b.credit_carried_forward[h] > 0 && (
                      <tr key={'c' + h} className="sub">
                        <td>{h.toUpperCase()} credit carried forward</td>
                        <td className="num">
                          {inr2(d.gstr3b.credit_carried_forward[h])}
                        </td>
                      </tr>
                    )
                )}
              </tbody>
            </table>
            <p className="muted mt-3.5">
              Set-off order applied: IGST credit → IGST, CGST, SGST; CGST credit → CGST, IGST; SGST
              credit → SGST, IGST. Verify on the GST portal before filing.
            </p>
          </div>
        </div>
      )}

      {d && tab === 'r1' && (
        <>
          <div className="card p-0 overflow-x-auto">
            <div className="p-3.5">
              <b>B2B — registered buyers ({d.gstr1.b2b.length})</b>
            </div>
            <table>
              <thead>
                <tr>
                  <th>GSTIN</th>
                  <th>Customer</th>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>POS</th>
                  <th className="num">Taxable</th>
                  <th className="num">IGST</th>
                  <th className="num">CGST</th>
                  <th className="num">SGST</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {d.gstr1.b2b.map((x: any) => (
                  <tr key={x.id}>
                    <td className="mono">{x.gstin}</td>
                    <td>{x.party}</td>
                    <td>
                      <Link to={`/docs/sales/${x.id}`}>{x.doc_no}</Link>
                    </td>
                    <td>{fmtDate(x.doc_date)}</td>
                    <td>{x.place_of_supply}</td>
                    <td className="num">{inr2(x.taxable_value)}</td>
                    <td className="num">{inr2(x.igst)}</td>
                    <td className="num">{inr2(x.cgst)}</td>
                    <td className="num">{inr2(x.sgst)}</td>
                    <td className="num">
                      <b>{inr2(x.total)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid g2">
            <div className="card">
              <h3>B2C small (by place of supply)</h3>
              <table>
                <thead>
                  <tr>
                    <th>POS</th>
                    <th className="num">Taxable</th>
                    <th className="num">IGST</th>
                    <th className="num">CGST</th>
                    <th className="num">SGST</th>
                  </tr>
                </thead>
                <tbody>
                  {d.gstr1.b2cs.map((x: any) => (
                    <tr key={x.place_of_supply}>
                      <td>{x.place_of_supply}</td>
                      <td className="num">{inr2(x.taxable)}</td>
                      <td className="num">{inr2(x.igst)}</td>
                      <td className="num">{inr2(x.cgst)}</td>
                      <td className="num">{inr2(x.sgst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted mt-2.5">
                B2C large (inter-state &gt; ₹1 lakh): {d.gstr1.b2cl.length} invoice(s)
              </p>
            </div>

            <div className="card">
              <h3>Credit notes ({d.gstr1.credit_notes.length})</h3>
              <table>
                <tbody>
                  {d.gstr1.credit_notes.map((x: any) => (
                    <tr key={x.id}>
                      <td>{x.doc_no}</td>
                      <td>{x.party}</td>
                      <td className="num">{inr2(x.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {d && tab === 'hsn' && (
        <div className="card p-0 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>HSN/SAC</th>
                <th className="num">Rate</th>
                <th className="num">Qty</th>
                <th className="num">Taxable</th>
                <th className="num">IGST</th>
                <th className="num">CGST</th>
                <th className="num">SGST</th>
              </tr>
            </thead>
            <tbody>
              {d.gstr1.hsn.map((h: any) => (
                <tr key={h.hsn_sac + h.gst_rate}>
                  <td className="mono">{h.hsn_sac}</td>
                  <td className="num">{h.gst_rate}%</td>
                  <td className="num">{h.qty}</td>
                  <td className="num">{inr2(h.taxable)}</td>
                  <td className="num">{inr2(h.igst)}</td>
                  <td className="num">{inr2(h.cgst)}</td>
                  <td className="num">{inr2(h.sgst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

