import { PAYMENT_METHOD_LABELS } from './formatters';

// The Payment Method filter's options: exactly the real payment_method values
// BillingForm writes to billing_payments (cash, card, bank_transfer,
// insurance), with the same labels used everywhere else — no invented ones.
export const METHOD_FILTER_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// How the summary tiles group methods: Bank Account = card + bank_transfer.
export function methodBucket(method) {
  if (method === 'cash') return 'cash';
  if (method === 'card' || method === 'bank_transfer') return 'bank';
  if (method === 'insurance') return 'insurance';
  return null;
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
  const method = distinct[0];
  if (!method) return '—';
  return PAYMENT_METHOD_LABELS[method] || method;
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
// method's portion.
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

    const matchedLegs = legs.filter((l) => l.method === method);
    if (matchedLegs.length === 0) return;
    rows.push({
      entry,
      amount: matchedLegs.reduce((s, l) => s + l.amount, 0),
      invoiceAmount,
      legs,
      matchedLegs,
      partial: matchedLegs.length < legs.length,
      methodLabel: PAYMENT_METHOD_LABELS[method] || method,
    });
  });
  return rows;
}

// Tile figures for a set of visible rows. Total Billed is the sum of the rows'
// shown amounts; Cash/Bank/Insurance bucket the matched legs, so with a method
// filter active every tile reflects only the filtered data.
export function summarizeRows(rows) {
  const totals = { total: 0, cash: 0, bank: 0, insurance: 0 };
  rows.forEach((r) => {
    totals.total += r.amount;
    r.matchedLegs.forEach((l) => {
      const bucket = methodBucket(l.method);
      if (bucket) totals[bucket] += l.amount;
    });
  });
  return totals;
}
