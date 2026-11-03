import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { inr2, todayStr } from '../../utils/format.js';
import { useData } from '../../api/client.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';

export default function DayBook() {
  const [date, setDate] = useState(todayStr());
  const { data, loading } = useData<any[]>(`/api/reports/daybook?date=${date}`);

  return (
    <>
      <div className="topbar">
        <h1>Day book</h1>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
      </div>

      {loading && <TableSkeleton rows={4} cols={4} />}

      {data?.map(e => (
        <div key={e.id} className="card">
          <div className="row">
            <Link className="mono" to={`/journals/${e.id}`}>
              <b>{e.entry_no}</b>
            </Link>
            <span className="badge">{e.source.replace(/_/g, ' ')}</span>
            <span className="muted">{e.narration}</span>
          </div>

          <table className="mt-2.5">
            <tbody>
              {e.lines.map((l: any, i: number) => (
                <tr key={i}>
                  <td className={l.credit ? 'indent' : ''}>
                    {l.credit ? 'To ' : ''}
                    {l.account}
                  </td>
                  <td className="num">{l.debit ? inr2(l.debit) : ''}</td>
                  <td className="num">{l.credit ? inr2(l.credit) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {data && !data.length && (
        <div className="card">
          <p className="muted text-center p-4 m-0">
            No journal entries recorded on this date
          </p>
        </div>
      )}
    </>
  );
}

