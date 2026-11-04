import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { supabase, fetchAllRowsByIds } from '../lib/supabaseClient';
import { karachiTodayISO } from '../lib/dateUtils';
import { getYmdcNet } from '../lib/ymdcNet';
import { buildVisibleRows, summarizeRows } from '../lib/billingMethodFilter';
import { paymentMethodLabel } from '../constants/paymentMethods';
import FinancialReportView from '../components/FinancialReportView';
import YmdcTrendChart from '../components/YmdcTrendChart';
import TopDoctorsList from '../components/TopDoctorsList';
import DatePresets from '../components/DatePresets';
import { hubAccess } from '../permissions';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

const EXPENSE_CATEGORY_LABELS = { general: 'General', utility: 'Utility Bills', salary: 'Salary' };

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
  // What this user may see (see permissions.js): the financial blocks and,
  // separately, the expense-dependent figures.
  const access = hubAccess(profile);
  const showFinancials = access.financials;

  // Clinic (Karachi) calendar, so "today" and "this month" match the
  // trend chart's month boundaries.
  const today = karachiTodayISO();
  const firstOfMonth = today.slice(0, 8) + '01';

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  // Everything the cards, Top Doctors and the financial report show comes
  // from getYmdcNet (src/lib/ymdcNet.js) — the same function that feeds the
  // 3-month trend chart — so the header cards and the chart can't disagree.
  const [net, setNet] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFinancialReport, setShowFinancialReport] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await getYmdcNet(dateFrom, dateTo);
    setNet(result);

    // Payment-method totals need per-payment granularity — a split invoice
    // must contribute to each of its real methods' totals — which
    // billing_analytics can't give us (one row per invoice). Fetch
    // billing_payments by the billing IDs already returned above instead
    // of via an embedded billing!inner(billing_date) join: an embed is
    // still subject to billing's own RLS (billing_select_staff), which
    // blocks ceo, while billing_payments queried directly is governed by
    // its own policy. Chunked with fetchAllRowsByIds — a full month's
    // worth of billing IDs is long enough to 400 a single .in() request.
    const billingIds = result.rows.map((r) => r.id);
    if (billingIds.length > 0) {
      const { data: paymentRows, error: paymentsError } = await fetchAllRowsByIds(
        () => supabase.from('billing_payments').select('*').order('id', { ascending: true }),
        'billing_id',
        billingIds
      );
      if (paymentsError) console.error(paymentsError.message);
      setPayments(paymentRows || []);
    } else {
      setPayments([]);
    }

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
    if (!showFinancials) {
      setArchiveLoading(false);
      return;
    }
    supabase
      .from('monthly_pnl_archive')
      .select('*')
      .order('month_date', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setArchiveRows(data || []);
        setArchiveLoading(false);
      });
  }, [showFinancials]);

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

  const rows = net?.rows ?? [];
  const expenses = net?.expenses ?? [];
  const doctorFinancials = net?.doctorFinancials ?? [];
  const serviceCategoryFinancials = net?.serviceCategoryFinancials ?? [];
  const totalRevenue = net?.totalRevenue ?? 0;
  const ymdcRevenue = net?.ymdcShare ?? 0;
  const totalExpenses = net?.totalExpenses ?? 0;
  const profitLoss = net?.net ?? 0;

  // Same method breakdown Billing's tiles use (shared billingMethodFilter
  // helpers), so the two pages can't drift apart: each invoice is split across
  // its real billing_payments legs, and an invoice with no payment rows falls
  // back to its own payment_method/amount instead of vanishing. That fallback
  // is what makes Cash + Bank + GIA International + Habib Insurance (+ Other,
  // when any legacy 'other' money exists) add up to Total Revenue exactly.
  const paymentBreakdown = useMemo(() => {
    const byBillingId = {};
    payments.forEach((p) => {
      (byBillingId[p.billing_id] ||= []).push(p);
    });
    return summarizeRows(buildVisibleRows(rows, byBillingId, 'all'));
  }, [rows, payments]);

  // Financial report Income table: one row per real doctor (same
  // gross/cost/YMDC-share numbers as the Doctor Revenue Calculator below),
  // plus one row per service-category "doctor" (X-Ray, Ultrasound, etc.),
  // split by their own split_percentage the same way — so summing this
  // table's YMDC's Share column always equals ymdcRevenue exactly.
  const incomeRows = useMemo(() => {
    const doctorRows = doctorFinancials.map((f) => ({
      name: f.doctor.name,
      gross: f.gross,
      cost: f.totalCosts,
      ymdcShare: f.ymdcShare,
    }));
    const serviceRows = serviceCategoryFinancials.map((f) => ({
      name: f.doctor.name,
      gross: f.gross,
      cost: 0,
      ymdcShare: f.ymdcShare,
    }));
    return [...doctorRows, ...serviceRows];
  }, [doctorFinancials, serviceCategoryFinancials]);

  const expenseRows = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });
    return Object.entries(map).map(([category, amount]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category] || category,
      amount,
    }));
  }, [expenses]);

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
          <DatePresets
            from={dateFrom}
            to={dateTo}
            onSelect={(f, t) => {
              setDateFrom(f);
              setDateTo(t);
            }}
          />
          {showFinancials && access.expenses && (
            <button className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setShowFinancialReport(true)}>
              Generate Financial Report
            </button>
          )}
        </div>
      </div>

      {showFinancials && (
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
          <div className="value">{access.expenses ? formatPKR(totalExpenses) : '—'}</div>
          <div className="hub-hero-sub">{access.expenses ? 'All categories, selected range' : 'Needs Expenses access'}</div>
        </div>
        <div className={'hub-hero-card ' + (access.expenses && profitLoss < 0 ? 'hub-hero-card-negative' : 'hub-hero-card-positive')}>
          <div className="label">Profit / Loss</div>
          <div className="value">{access.expenses ? formatPKR(profitLoss) : '—'}</div>
          <div className="hub-hero-sub">{access.expenses ? 'YMDC share minus expenses' : 'Needs Expenses access'}</div>
        </div>
      </div>
      )}

      {showFinancials && (
        access.expenses ? (
          <YmdcTrendChart />
        ) : (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>3-Month Trend: YMDC Net Share</h3>
            <div className="empty-state">The net share needs Expenses access, so it isn't shown for this account.</div>
          </div>
        )
      )}

      <TopDoctorsList
        doctorFinancials={doctorFinancials}
        serviceCategoryFinancials={serviceCategoryFinancials}
        loading={loading}
        showFinancials={showFinancials}
      />

      {showFinancials && (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Cash vs Bank Account</h3>
        <table className="data-table">
          <thead><tr><th>Method</th><th>Total</th></tr></thead>
          <tbody>
            <tr><td>Cash</td><td>{formatPKR(paymentBreakdown.cash)}</td></tr>
            <tr><td>Bank Account (Card + Bank Transfer)</td><td>{formatPKR(paymentBreakdown.bank)}</td></tr>
            <tr><td>{paymentMethodLabel('gia_international')}</td><td>{formatPKR(paymentBreakdown.gia_international)}</td></tr>
            <tr><td>{paymentMethodLabel('habib_insurance')}</td><td>{formatPKR(paymentBreakdown.habib_insurance)}</td></tr>
            {Math.abs(paymentBreakdown.other) > 0.005 && (
              <tr><td>{paymentMethodLabel('other')}</td><td>{formatPKR(paymentBreakdown.other)}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {showFinancials && (
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
      )}

      {showFinancials && access.expenses && showFinancialReport && (
        <FinancialReportView
          dateFrom={dateFrom}
          dateTo={dateTo}
          preparedBy={profile?.full_name || 'Admin'}
          incomeRows={incomeRows}
          totalIncome={ymdcRevenue}
          expenseRows={expenseRows}
          totalExpense={totalExpenses}
          netIncome={profitLoss}
          onClose={() => setShowFinancialReport(false)}
        />
      )}
    </div>
  );
}
