import { PAYMENT_METHODS, paymentMethodLabel, isInsuranceMethod } from '../constants/paymentMethods';

// The Payment Method filter's options: every method in the central constant,
// with the same labels used everywhere else.
export const METHOD_FILTER_OPTIONS = PAYMENT_METHODS.map(({ value, label }) => ({ value, label }));

// How the summary figures group methods: Bank Account = card + bank_transfer;
// each insurer (GIA International, Habib Insurance) gets its own bucket named
// after its method value; everything else — including 'other' and any value
// this code doesn't recognise — lands in 'other', so the buckets always add up
// to the total instead of silently losing money.
export function methodBucket(method) {
  if (method === 'cash') return 'cash';
  if (method === 'card' || method === 'bank_transfer') return 'bank';
  if (isInsuranceMethod(method)) return method;
  return 'other';
}

// An invoice's "legs": its billing_payments rows (one per method used) are the
// source of truth. Only an invoice with no billing_payments rows at all
// (legacy/orphan) falls back to a single leg built from billing.payment_method
// and billing.amount, so nothing silently drops.
export function legsFor(entry, entryPayments) {
  if (entryPayments && entryPayments.length > 0) {
    return entryPayments.map((p) => ({ method: p.payment_method, amount: Number(p.amount) }));
  }
  return [{ method: entry.payment_method, amount: Number(entry.amount) }];
}

function methodLabelOf(legs) {
  const distinct = [...new Set(legs.map((l) => l.method))];
  if (distinct.length > 1) return 'Mixed';
  return paymentMethodLabel(distinct[0]);
}

// Applies the Payment Method filter ('all' or a method value) over invoices that
// have already been narrowed by date range and doctor, returning one row per
// visible invoice:
//   amount        what to show/total — the full invoice amount with no method
//                 filter, or only the sum of the legs matching the filter
//   invoiceAmount the invoice's full amount (for the "of X total" note)
//   partial       true when a method filter hides some of the invoice's legs
//   matchedLegs   the legs that count toward the tiles for this row
//   methodLabel   what the Method column/PDF shows
// With a filter active, an invoice is kept only if at least one leg matches, and
// a split invoice therefore appears under each of its methods with just that
// method's portion. (A zero-amount invoice still matches its leg's method.)
export function buildVisibleRows(entries, paymentsByBillingId, method) {
  const rows = [];
  entries.forEach((entry) => {
    const legs = legsFor(entry, paymentsByBillingId[entry.id]);
    const invoiceAmount = Number(entry.amount);

    if (method === 'all') {
      rows.push({
        entry,
        amount: invoiceAmount,
        invoiceAmount,
        legs,
        matchedLegs: legs,
        partial: false,
        methodLabel: methodLabelOf(legs),
      });
      return;
    }

    // "Other" matches whatever the tiles file under Other (the 'other' value
    // plus anything unrecognised), so the filter and its tile never disagree
    // and the filters always add up to the unfiltered total.
    const matches = method === 'other' ? (l) => methodBucket(l.method) === 'other' : (l) => l.method === method;
    const matchedLegs = legs.filter(matches);
    if (matchedLegs.length === 0) return;
    rows.push({
      entry,
      amount: matchedLegs.reduce((s, l) => s + l.amount, 0),
      invoiceAmount,
      legs,
      matchedLegs,
      partial: matchedLegs.length < legs.length,
      methodLabel: paymentMethodLabel(method),
    });
  });
  return rows;
}

// Figures for a set of visible rows. `total` is the sum of the rows' shown
// amounts; the rest bucket the matched legs (see methodBucket), so with a
// method filter active every figure reflects only the filtered data, and
// cash + bank + gia_international + habib_insurance + other = total.
export function summarizeRows(rows) {
  const totals = { total: 0, cash: 0, bank: 0, gia_international: 0, habib_insurance: 0, other: 0 };
  rows.forEach((r) => {
    totals.total += r.amount;
    r.matchedLegs.forEach((l) => {
      totals[methodBucket(l.method)] += l.amount;
    });
  });
  return totals;
}
