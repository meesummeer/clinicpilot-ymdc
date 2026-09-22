import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import { formatDateDMY } from '../lib/formatters';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

const ARCHIVE_INCOME_CATEGORIES = ['Services', 'Dental', 'Consultation', 'X-Ray', 'Ultrasound', 'Orthotics'];
const ARCHIVE_EXPENSE_CATEGORIES = [
  'Aesthetic Purchasing',
  'Tea Expense',
  'Cleaning Material',
  'Salary',
  'Consultation Sharing',
  'Electric Bills',
  'Utility Bills',
  'Telephone Bill',
  'Internet',
  'Advertising and Promo',
  'Gen Expenses',
  'Licenses and Permits',
];

export default function Hub({ profile }) {
  const isAdmin = profile?.role === 'admin';

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  const [doctors, setDoctors] = useState([]);
  const [rows, setRows] = useState([]);
  const [costs, setCosts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openCostFormFor, setOpenCostFormFor] = useState(null);
  const [costDraft, setCostDraft] = useState({ description: '', amount: '', cost_date: today });
  const [savingCost, setSavingCost] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [
      { data: docs, error: docErr },
      { data: analyticsRows, error: rowErr },
      { data: costRows, error: costErr },
      { data: expenseRows, error: expensesError },
    ] = await Promise.all([
      supabase.from('doctors').select('*').eq('active', true).order('name'),
      // billing_analytics already has role-based access built in (admin,
      // ceo, and doctor-scoped) and carries everything needed for revenue
      // math — amount, payment_method, doctor_id, etc — with no patient
      // PII. Querying billing/billing_payments directly here (even via an
      // embedded join) hits billing_select_staff, which blocks ceo and
      // silently zeroes out these totals for that role.
      supabase.from('billing_analytics').select('*').gte('billing_date', dateFrom).lte('billing_date', dateTo),
      supabase.from('doctor_costs').select('*').gte('cost_date', dateFrom).lte('cost_date', dateTo),
      supabase.from('expenses').select('*').gte('expense_date', dateFrom).lte('expense_date', dateTo),
    ]);
    if (docErr) console.error(docErr.message);
    if (rowErr) console.error(rowErr.message);
    if (costErr) console.error(costErr.message);
    if (expensesError) console.error(expensesError.message);
    setDoctors(docs || []);
    setRows(analyticsRows || []);
    setCosts(costRows || []);
    setExpenses(expenseRows || []);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Historical P&L archive — a separate, manually-reconciled dataset, not
  // derived from or blended with the live billing/expenses data above.
  const [archiveRows, setArchiveRows] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('monthly_pnl_archive')
      .select('*')
      .order('month_date', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setArchiveRows(data || []);
        setArchiveLoading(false);
      });
  }, []);

  const archiveMonths = useMemo(() => {
    const seen = new Map();
    archiveRows.forEach((r) => {
      if (!seen.has(r.month_label)) seen.set(r.month_label, r.month_date);
    });
    return Array.from(seen.keys()).map((month_label) => ({ month_label }));
  }, [archiveRows]);

  const archiveMonthlyTotals = useMemo(() => {
    return archiveMonths.map(({ month_label }) => {
      const monthRows = archiveRows.filter((r) => r.month_label === month_label);
      const income = monthRows.filter((r) => r.section === 'income').reduce((s, r) => s + Number(r.amount), 0);
      const expense = monthRows.filter((r) => r.section === 'expense').reduce((s, r) => s + Number(r.amount), 0);
      return { month_label, income, expense, net: income - expense };
    });
  }, [archiveMonths, archiveRows]);

  const archiveCellMaps = useMemo(() => {
    const income = {};
    const expense = {};
    archiveRows.forEach((r) => {
      const target = r.section === 'income' ? income : expense;
      if (!target[r.month_label]) target[r.month_label] = {};
      target[r.month_label][r.category] = Number(r.amount);
    });
    return { income, expense };
  }, [archiveRows]);

  function archiveCellValue(monthLabel, category, section) {
    if (section === 'expense' && monthLabel === 'August 2026 (Final)' && category === 'Consultation Sharing') {
      return 'N/A — netted into income';
    }
    const value = archiveCellMaps[section]?.[monthLabel]?.[category];
    return value == null ? '—' : formatPKR(value);
  }

  // billing_analytics.amount is each billing row's full invoice total
  // (already summed across payment methods when the entry was saved), so
  // revenue per row is just the row's own amount — no separate
  // billing_payments query needed.
  function revenueFor(row) {
    return Number(row.amount) || 0;
  }

  const totalRevenue = useMemo(() => rows.reduce((s, r) => s + revenueFor(r), 0), [rows]);

  const serviceCategoryRevenue = useMemo(
    () => rows.filter((r) => r.is_service_category).reduce((s, r) => s + revenueFor(r), 0),
    [rows]
  );

  const doctorFinancials = useMemo(() => {
    return doctors
      .filter((d) => !d.is_service_category)
      .map((d) => {
        const doctorRows = rows.filter((r) => r.doctor_id === d.id);
        const gross = doctorRows.reduce((s, r) => s + revenueFor(r), 0);
        const costsList = costs
          .filter((c) => c.doctor_id === d.id)
          .sort((a, b) => (a.cost_date < b.cost_date ? 1 : -1));
        const totalCosts = costsList.reduce((s, c) => s + Number(c.amount), 0);
        const net = gross - totalCosts;
        const splitPct = Number(d.split_percentage);
        const ymdcShare = net * (splitPct / 100);
        const doctorShare = net * ((100 - splitPct) / 100);
        return {
          doctor: d,
          transactionCount: doctorRows.length,
          gross,
          costsList,
          totalCosts,
          net,
          doctorShare,
          ymdcShare,
        };
      });
  }, [doctors, rows, costs]);

  const ymdcRevenue = useMemo(
    () => doctorFinancials.reduce((s, f) => s + f.ymdcShare, 0) + serviceCategoryRevenue,
    [doctorFinancials, serviceCategoryRevenue]
  );

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  const profitLoss = ymdcRevenue - totalExpenses;

  const paymentBreakdown = useMemo(() => {
    const cash = rows.filter((r) => r.payment_method === 'cash').reduce((s, r) => s + revenueFor(r), 0);
    const bank = rows
      .filter((r) => r.payment_method === 'card' || r.payment_method === 'bank_transfer')
      .reduce((s, r) => s + revenueFor(r), 0);
    const insurance = rows.filter((r) => r.payment_method === 'insurance').reduce((s, r) => s + revenueFor(r), 0);
    const other = rows
      .filter((r) => !['cash', 'card', 'bank_transfer', 'insurance'].includes(r.payment_method))
      .reduce((s, r) => s + revenueFor(r), 0);
    return { cash, bank, insurance, other };
  }, [rows]);

  const doctorWise = useMemo(() => {
    return doctors
      .map((d) => {
        const doctorRows = rows.filter((r) => r.doctor_id === d.id);
        return {
          doctor: d,
          count: doctorRows.length,
          total: doctorRows.reduce((s, r) => s + revenueFor(r), 0),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [doctors, rows]);

  const procedureChartData = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const key = r.service || 'Unspecified';
      map[key] = (map[key] || 0) + revenueFor(r);
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 10);
    const rest = sorted.slice(10);
    const otherTotal = rest.reduce((s, [, v]) => s + v, 0);
    const data = top.map(([name, value]) => ({ name, value }));
    if (otherTotal > 0) data.push({ name: 'Other', value: otherTotal });
    return data;
  }, [rows]);

  function openAddCost(doctorId) {
    setCostDraft({ description: '', amount: '', cost_date: today });
    setOpenCostFormFor(doctorId);
  }

  async function handleAddCost(e, doctorId) {
    e.preventDefault();
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
        <div className="filters-row">
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

      <div className="hub-hero-grid">
        <div className="hub-hero-card">
          <div className="label">Total Revenue</div>
          <div className="value">{formatPKR(totalRevenue)}</div>
          <div className="hub-hero-sub">Gross — before doctor splits &amp; costs</div>
        </div>
        <div className="hub-hero-card hub-hero-card-gold">
          <div className="label">YMDC</div>
          <div className="value">{formatPKR(ymdcRevenue)}</div>
          <div className="hub-hero-sub">Centre's actual share, after splits &amp; costs</div>
        </div>
        <div className="hub-hero-card">
          <div className="label">Expenses</div>
          <div className="value">{formatPKR(totalExpenses)}</div>
          <div className="hub-hero-sub">All categories, selected range</div>
        </div>
        <div className={'hub-hero-card ' + (profitLoss < 0 ? 'hub-hero-card-negative' : 'hub-hero-card-positive')}>
          <div className="label">Profit / Loss</div>
          <div className="value">{formatPKR(profitLoss)}</div>
          <div className="hub-hero-sub">YMDC share minus expenses</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Cash vs Bank Account</h3>
        <table className="data-table">
          <thead><tr><th>Method</th><th>Total</th></tr></thead>
          <tbody>
            <tr><td>Cash</td><td>{formatPKR(paymentBreakdown.cash)}</td></tr>
            <tr><td>Bank Account (Card + Bank Transfer)</td><td>{formatPKR(paymentBreakdown.bank)}</td></tr>
            <tr><td>Insurance</td><td>{formatPKR(paymentBreakdown.insurance)}</td></tr>
            <tr><td>Other</td><td>{formatPKR(paymentBreakdown.other)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Doctor-wise Revenue</h3>
        {doctorWise.length === 0 ? (
          <div className="empty-state">No doctors set up.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Doctor</th><th>Transactions</th><th>Total</th></tr></thead>
            <tbody>
              {doctorWise.map(({ doctor, count, total }) => (
                <tr key={doctor.id}>
                  <td><span className="doctor-dot" style={{ background: doctor.color_hex }} />{doctor.name}</td>
                  <td>{count}</td>
                  <td>{formatPKR(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Top Procedures / Services</h3>
        {procedureChartData.length === 0 ? (
          <div className="empty-state">No data for this range.</div>
        ) : (
          <div style={{ width: '100%', height: Math.max(280, procedureChartData.length * 38) }}>
            <ResponsiveContainer>
              <BarChart data={procedureChartData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => formatPKR(v)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatPKR(v)} />
                <Bar dataKey="value" fill="#1A0A6E" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
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
                  <div className="label">Doctor's Share ({(100 - Number(f.doctor.split_percentage)).toFixed(0)}%)</div>
                  <div className="value">{formatPKR(f.doctorShare)}</div>
                </div>
                <div className="hub-split-block hub-split-block-gold">
                  <div className="label">YMDC's Share ({Number(f.doctor.split_percentage).toFixed(0)}%)</div>
                  <div className="value">{formatPKR(f.ymdcShare)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card hub-archive-section">
        <h3>Historical P&amp;L (Archived Reports)</h3>
        <div className="hub-archive-caption">Manually reconciled monthly reports — not live data.</div>

        {archiveLoading ? (
          <p>Loading…</p>
        ) : archiveMonthlyTotals.length === 0 ? (
          <div className="empty-state">No archived reports yet.</div>
        ) : (
          <>
            <div style={{ width: '100%', height: 300, marginBottom: 28 }}>
              <ResponsiveContainer>
                <BarChart data={archiveMonthlyTotals} margin={{ top: 28, right: 24, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month_label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatPKR(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatPKR(v)} />
                  <Bar dataKey="net" name="Net Income" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="net" position="top" formatter={(v) => formatPKR(v)} style={{ fontSize: 11, fontWeight: 700, fill: 'var(--navy)' }} />
                    {archiveMonthlyTotals.map((m) => (
                      <Cell key={m.month_label} fill={m.net < 0 ? '#B22222' : '#C9A227'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <table className="data-table hub-archive-table">
              <thead>
                <tr>
                  <th>Category</th>
                  {archiveMonths.map((m) => (
                    <th key={m.month_label}>{m.month_label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hub-archive-section-row">
                  <td colSpan={archiveMonths.length + 1}>Income</td>
                </tr>
                {ARCHIVE_INCOME_CATEGORIES.map((cat) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    {archiveMonths.map((m) => (
                      <td key={m.month_label}>{archiveCellValue(m.month_label, cat, 'income')}</td>
                    ))}
                  </tr>
                ))}
                <tr className="hub-archive-section-row">
                  <td colSpan={archiveMonths.length + 1}>Expense</td>
                </tr>
                {ARCHIVE_EXPENSE_CATEGORIES.map((cat) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    {archiveMonths.map((m) => (
                      <td key={m.month_label}>{archiveCellValue(m.month_label, cat, 'expense')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="hub-archive-total-row">
                  <td>Total Income</td>
                  {archiveMonthlyTotals.map((m) => (
                    <td key={m.month_label}>{formatPKR(m.income)}</td>
                  ))}
                </tr>
                <tr className="hub-archive-total-row">
                  <td>Total Expense</td>
                  {archiveMonthlyTotals.map((m) => (
                    <td key={m.month_label}>{formatPKR(m.expense)}</td>
                  ))}
                </tr>
                <tr className="hub-archive-total-row">
                  <td>Net Income</td>
                  {archiveMonthlyTotals.map((m) => (
                    <td key={m.month_label} className={m.net < 0 ? 'hub-archive-negative' : ''}>
                      {formatPKR(m.net)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
