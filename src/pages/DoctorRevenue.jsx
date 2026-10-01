import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, fetchAllRows } from '../lib/supabaseClient';
import { formatDateDMY } from '../lib/formatters';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

export default function DoctorRevenue({ profile }) {
  const doctorId = profile?.doctor_id;

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  const [doctor, setDoctor] = useState(null);
  const [rows, setRows] = useState([]);
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!doctorId) return;
    supabase.from('doctors').select('*').eq('id', doctorId).single().then(({ data, error }) => {
      if (error) console.error(error.message);
      setDoctor(data || null);
    });
  }, [doctorId]);

  const loadData = useCallback(async () => {
    if (!doctorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [
      { data: analyticsRows, error: rowErr },
      { data: costRows, error: costErr },
    ] = await Promise.all([
      // Paged with fetchAllRows — the same table this doctor's billing
      // rows live in can exceed PostgREST's default 1000-row response cap
      // over a busy stretch, which silently truncates with no error.
      fetchAllRows(() =>
        supabase
          .from('billing_analytics')
          .select('*')
          .eq('doctor_id', doctorId)
          .gte('billing_date', dateFrom)
          .lte('billing_date', dateTo)
          .order('id', { ascending: true })
      ),
      supabase.from('doctor_costs').select('*').eq('doctor_id', doctorId).gte('cost_date', dateFrom).lte('cost_date', dateTo),
    ]);
    if (rowErr) console.error(rowErr.message);
    if (costErr) console.error(costErr.message);
    setRows(analyticsRows || []);
    setCosts((costRows || []).sort((a, b) => (a.cost_date < b.cost_date ? 1 : -1)));
    setLoading(false);
  }, [doctorId, dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const gross = useMemo(() => rows.reduce((s, r) => s + Number(r.amount), 0), [rows]);
  const totalCosts = useMemo(() => costs.reduce((s, c) => s + Number(c.amount), 0), [costs]);
  const net = gross - totalCosts;

  // Per-invoice split: each row uses its own split_percentage_override
  // (e.g. a Hijama 50/50 invoice) when set, else the doctor's base
  // split_percentage — applied to that row's own gross and summed, so a
  // mix of Hijama and normal invoices splits correctly instead of one
  // flat percentage applied to the total. Costs aren't invoice-level
  // data, so they're allocated between the two sides in proportion to
  // each side's share of gross — an exact generalization of the old
  // net * splitPct formula that reduces to it precisely when every row
  // shares one percentage, matching the same calculation Hub uses.
  const { yourShare, ymdcShare, splitPct } = useMemo(() => {
    const basePct = Number(doctor?.split_percentage ?? 30);
    let ymdcShareOfGross = 0;
    let doctorShareOfGross = 0;
    rows.forEach((r) => {
      const pct = r.split_percentage_override != null ? Number(r.split_percentage_override) : basePct;
      const rowGross = Number(r.amount);
      ymdcShareOfGross += rowGross * (pct / 100);
      doctorShareOfGross += rowGross * ((100 - pct) / 100);
    });
    if (gross > 0) {
      return {
        yourShare: doctorShareOfGross - totalCosts * (doctorShareOfGross / gross),
        ymdcShare: ymdcShareOfGross - totalCosts * (ymdcShareOfGross / gross),
        splitPct: (ymdcShareOfGross / gross) * 100,
      };
    }
    return {
      yourShare: net * ((100 - basePct) / 100),
      ymdcShare: net * (basePct / 100),
      splitPct: basePct,
    };
  }, [rows, doctor, gross, totalCosts, net]);

  if (!doctorId) {
    return (
      <div className="card">
        <div className="empty-state">Your account isn't linked to a doctor record yet. Ask the admin to set this up.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="filters-row" style={{ marginBottom: 0 }}>
          <div className="filter-field">
            <label>From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-field">
            <label>To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="summary-tiles">
        <div className="summary-tile">
          <div className="label">Gross Revenue</div>
          <div className="value">{formatPKR(gross)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Total Costs</div>
          <div className="value">{formatPKR(totalCosts)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Net Revenue</div>
          <div className="value">{formatPKR(net)}</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Costs</h3>
        {loading ? (
          <p>Loading…</p>
        ) : costs.length === 0 ? (
          <div className="empty-state">No costs recorded for this range.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id}>
                  <td>{formatDateDMY(c.cost_date)}</td>
                  <td>{c.description || '—'}</td>
                  <td>{formatPKR(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Revenue Split</h3>
        <div className="hub-split-blocks">
          <div className="hub-split-block">
            <div className="label">Your Share ({(100 - splitPct).toFixed(0)}%)</div>
            <div className="value">{formatPKR(yourShare)}</div>
          </div>
          <div className="hub-split-block hub-split-block-gold">
            <div className="label">YMDC Share ({splitPct.toFixed(0)}%)</div>
            <div className="value">{formatPKR(ymdcShare)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
