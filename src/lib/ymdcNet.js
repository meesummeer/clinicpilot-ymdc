import { supabase, fetchAllRows } from './supabaseClient';
import { computeDoctorFigures } from './revenueSplit';

// The ONE place YMDC's net share is calculated. The Hub's header cards and
// the 3-month trend chart both come from getYmdcNet, so they can't disagree.
//
//   ymdcShare    = YMDC's share of doctor revenue after each invoice's split
//                  (its own Hijama override, else the doctor's split_percentage),
//                  with per-doctor costs shared between YMDC and the doctor in
//                  proportion to their shares (see revenueSplit.js), plus the
//                  service categories (X-Ray, etc.) split the same way with no costs.
//   materialKept = material cost YMDC keeps for aesthetic doctors
//                  (doctors.keeps_material_cost), i.e. their doctor_costs total
//   ymdcIncome   = ymdcShare + materialKept   (the Hub's YMDC card)
//   net          = ymdcIncome - total expenses (the Profit / Loss card)
// The per-doctor math lives in computeDoctorFigures (revenueSplit.js).

// Pure part: no network. `rows` are billing_analytics rows already limited to
// the range; `costs` are doctor_costs rows; `expenses` are expenses rows.
export function computeYmdcNet({ doctors, rows, costs, expenses }) {
  const totalRevenue = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const doctorFinancials = doctors
    .filter((d) => !d.is_service_category)
    .map((d) => computeDoctorFigures({ doctor: d, rows, costs }));

  // Service-category "doctors" split by their own split_percentage like
  // real doctors (never a hardcoded 100%); costs aren't tracked for them.
  const serviceCategoryFinancials = doctors
    .filter((d) => d.is_service_category)
    .map((d) => computeDoctorFigures({ doctor: d, rows, costs }));

  const all = [...doctorFinancials, ...serviceCategoryFinancials];
  const ymdcShare = all.reduce((s, f) => s + f.ymdcShare, 0);
  const materialKept = all.reduce((s, f) => s + f.materialKept, 0);
  const ymdcIncome = ymdcShare + materialKept;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalCosts = costs.reduce((s, c) => s + Number(c.amount), 0);

  return {
    totalRevenue,
    ymdcShare,
    materialKept,
    ymdcIncome,
    totalCosts,
    totalExpenses,
    net: ymdcIncome - totalExpenses,
    doctorFinancials,
    serviceCategoryFinancials,
    // 0 means there is nothing at all in this range (no billing, costs or expenses).
    recordCount: rows.length + costs.length + expenses.length,
  };
}

// Loads everything for [startDate, endDate] (inclusive, YYYY-MM-DD) and
// computes it. All reads are paged past PostgREST's 1000-row cap. Pass
// `doctors` to reuse an already-loaded list.
export async function getYmdcNet(startDate, endDate, { doctors: preloadedDoctors } = {}) {
  const [doctorsResult, rowsResult, costsResult, expensesResult] = await Promise.all([
    preloadedDoctors
      ? Promise.resolve({ data: preloadedDoctors, error: null })
      : supabase.from('doctors').select('*').eq('active', true).order('name'),
    // billing_analytics already carries role-based access and has no patient PII.
    fetchAllRows(() =>
      supabase
        .from('billing_analytics')
        .select('*')
        .gte('billing_date', startDate)
        .lte('billing_date', endDate)
        .order('id', { ascending: true })
    ),
    fetchAllRows(() =>
      supabase
        .from('doctor_costs')
        .select('*')
        .gte('cost_date', startDate)
        .lte('cost_date', endDate)
        .order('id', { ascending: true })
    ),
    fetchAllRows(() =>
      supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('id', { ascending: true })
    ),
  ]);

  [doctorsResult, rowsResult, costsResult, expensesResult].forEach((r) => {
    if (r.error) console.error(r.error.message);
  });

  const doctors = doctorsResult.data || [];
  const rows = rowsResult.data || [];
  const costs = costsResult.data || [];
  const expenses = expensesResult.data || [];
  return { doctors, rows, costs, expenses, ...computeYmdcNet({ doctors, rows, costs, expenses }) };
}

// Per-entry breakdown for the Hub's Doctors / Services lists. Unlike
// computeYmdcNet (which only sees the active doctors it is handed, and drives
// the header cards), this takes EVERY doctors row — inactive ones too — so an
// inactive doctor who still billed in the range appears and the lists add up
// to Total Revenue. Same per-invoice split (Hijama override included) and
// same cost treatment as the DRC: service categories carry no costs.
export function computeEntityBreakdown({ doctors, rows, costs }) {
  return doctors.map((d) => {
    const f = computeDoctorFigures({ doctor: d, rows, costs });
    return {
      doctor: d,
      isService: f.isService,
      transactionCount: f.transactionCount,
      gross: f.gross,
      // Includes the material cost kept for aesthetic doctors.
      ymdcShare: f.ymdcIncome,
      materialKept: f.materialKept,
    };
  });
}
