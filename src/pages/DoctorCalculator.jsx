import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateDMY, karachiTodayISO } from '../lib/dateUtils';
import { getYmdcNet } from '../lib/ymdcNet';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

// The Doctor Revenue Calculator, moved off the Hub. Same numbers, same
// layout, same cost handling (doctor_costs); only the page it lives on and
// its own From/To filter are new. Admin only (the route is admin-only and
// adding/deleting costs is guarded here too).
export default function DoctorCalculator({ profile }) {
  const isAdmin = profile?.role === 'admin';

  // Same default as the Hub: first of this month to today (clinic time).
  const today = karachiTodayISO();
  const firstOfMonth = today.slice(0, 8) + '01';

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [doctorFinancials, setDoctorFinancials] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openCostFormFor, setOpenCostFormFor] = useState(null);
  const [costDraft, setCostDraft] = useState({ description: '', amount: '', cost_date: today });
  const [savingCost, setSavingCost] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await getYmdcNet(dateFrom, dateTo);
    setDoctorFinancials(result.doctorFinancials);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openAddCost(doctorId) {
    setCostDraft({ description: '', amount: '', cost_date: today });
    setOpenCostFormFor(doctorId);
  }

  async function handleAddCost(e, doctorId) {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingCost(true);
    const { error } = await supabase.from('doctor_costs').insert({
      doctor_id: doctorId,
      description: costDraft.description || null,
      amount: parseFloat(costDraft.amount),
      cost_date: costDraft.cost_date,
      created_by: profile.id,
    });
    setSavingCost(false);
    if (error) {
      alert(error.message);
      return;
    }
    setOpenCostFormFor(null);
    loadData();
  }

  async function handleDeleteCost(cost) {
    if (!isAdmin) return;
    if (!window.confirm(`Delete this cost${cost.description ? ` (${cost.description})` : ''} of ${formatPKR(cost.amount)}? This can't be undone.`)) return;
    const { error } = await supabase.from('doctor_costs').delete().eq('id', cost.id);
    if (error) {
      alert(error.message);
      return;
    }
    loadData();
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

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Doctor Revenue Calculator</h3>
        {loading ? (
          <p>Loading…</p>
        ) : doctorFinancials.length === 0 ? (
          <div className="empty-state">No doctors set up.</div>
        ) : (
          doctorFinancials.map((f) => (
            <div key={f.doctor.id} className="card hub-doctor-block" style={{ borderTopColor: f.doctor.color_hex }}>
              <div className="hub-doctor-block-header">
                <h4>
                  <span className="doctor-dot" style={{ background: f.doctor.color_hex }} />
                  {f.doctor.name}
                </h4>
                <div className="hub-doctor-gross">
                  Gross Revenue: <strong>{formatPKR(f.gross)}</strong> ({f.transactionCount} transaction{f.transactionCount !== 1 ? 's' : ''})
                </div>
              </div>

              <div className="hub-costs-heading">
                <strong>Costs</strong>
                {isAdmin && (
                  <button className="btn-secondary" onClick={() => openAddCost(f.doctor.id)}>+ Add Cost</button>
                )}
              </div>

              {isAdmin && openCostFormFor === f.doctor.id && (
                <form className="hub-cost-form" onSubmit={(e) => handleAddCost(e, f.doctor.id)}>
                  <div className="filters-row" style={{ marginBottom: 0 }}>
                    <div className="filter-field">
                      <label>Description</label>
                      <input
                        value={costDraft.description}
                        onChange={(e) => setCostDraft((d) => ({ ...d, description: e.target.value }))}
                      />
                    </div>
                    <div className="filter-field">
                      <label>Amount (PKR)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={costDraft.amount}
                        onChange={(e) => setCostDraft((d) => ({ ...d, amount: e.target.value }))}
                      />
                    </div>
                    <div className="filter-field">
                      <label>Date</label>
                      <input
                        type="date"
                        required
                        value={costDraft.cost_date}
                        onChange={(e) => setCostDraft((d) => ({ ...d, cost_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" disabled={savingCost} style={{ marginRight: 8, marginTop: 12 }}>
                    {savingCost ? 'Saving…' : 'Save Cost'}
                  </button>
                  <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={() => setOpenCostFormFor(null)}>
                    Cancel
                  </button>
                </form>
              )}

              {f.costsList.length === 0 ? (
                <div className="empty-state" style={{ padding: 16 }}>No costs recorded for this range.</div>
              ) : (
                <table className="data-table" style={{ marginBottom: 8 }}>
                  <thead>
                    <tr><th>Date</th><th>Description</th><th>Amount</th>{isAdmin && <th></th>}</tr>
                  </thead>
                  <tbody>
                    {f.costsList.map((c) => (
                      <tr key={c.id}>
                        <td>{formatDateDMY(c.cost_date)}</td>
                        <td>{c.description || '—'}</td>
                        <td>{formatPKR(c.amount)}</td>
                        {isAdmin && (
                          <td><button className="btn-danger-outline" onClick={() => handleDeleteCost(c)}>Delete</button></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="hub-calc-summary">
                <div>
                  <span className="label">Total Costs</span>
                  <span className="value">{formatPKR(f.totalCosts)}</span>
                </div>
                <div>
                  <span className="label">Net Revenue</span>
                  <span className="value">{formatPKR(f.net)}</span>
                </div>
              </div>

              <div className="hub-split-blocks">
                <div className="hub-split-block">
                  <div className="label">Doctor's Share ({(100 - f.effectiveSplitPct).toFixed(0)}%)</div>
                  <div className="value">{formatPKR(f.doctorShare)}</div>
                </div>
                <div className="hub-split-block hub-split-block-gold">
                  <div className="label">YMDC's Share ({f.effectiveSplitPct.toFixed(0)}%)</div>
                  <div className="value">{formatPKR(f.ymdcShare)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
