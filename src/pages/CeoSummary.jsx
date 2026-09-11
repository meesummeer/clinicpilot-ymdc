import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

export default function CeoSummary() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('billing_summary_by_doctor_month')
      .select('*')
      .order('billing_month', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setRows(data || []);
        setLoading(false);
      });
  }, []);

  const totalAllTime = useMemo(() => rows.reduce((s, r) => s + Number(r.total_billed), 0), [rows]);

  const months = useMemo(() => {
    const set = new Set(rows.map((r) => r.billing_month));
    return Array.from(set).sort().reverse();
  }, [rows]);

  return (
    <div>
      <div className="summary-tiles">
        <div className="summary-tile">
          <div className="label">Total Revenue (All Time on Record)</div>
          <div className="value">{formatPKR(totalAllTime)}</div>
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        months.map((month) => {
          const monthRows = rows.filter((r) => r.billing_month === month);
          const monthTotal = monthRows.reduce((s, r) => s + Number(r.total_billed), 0);
          return (
            <div className="card" key={month}>
              <h3 style={{ marginTop: 0 }}>
                {new Date(month).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                {' — '}{formatPKR(monthTotal)}
              </h3>
              <table className="data-table">
                <thead><tr><th>Doctor</th><th>Transactions</th><th>Total</th></tr></thead>
                <tbody>
                  {monthRows.sort((a, b) => b.total_billed - a.total_billed).map((r) => (
                    <tr key={r.doctor_name}>
                      <td>{r.doctor_name}</td>
                      <td>{r.transaction_count}</td>
                      <td>{formatPKR(r.total_billed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
