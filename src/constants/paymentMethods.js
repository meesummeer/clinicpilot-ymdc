// The single source of truth for payment methods. Every dropdown, filter,
// label, tile and PDF reads from here — don't hardcode method values or labels
// elsewhere.
//
// These values must match what the database accepts for
// billing_payments.payment_method / billing.payment_method. The value
// 'insurance' no longer exists there (it became 'gia_international'), so
// nothing may write it.
//
// `legacy: true` marks a value that is still valid and must still display,
// filter and total correctly (existing rows may carry it), but isn't offered
// for NEW payment legs.
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'gia_international', label: 'GIA International' },
  { value: 'habib_insurance', label: 'Habib Insurance' },
  { value: 'other', label: 'Other', legacy: true },
];

// Methods a user can pick when recording a payment leg.
export const SELECTABLE_PAYMENT_METHODS = PAYMENT_METHODS.filter((m) => !m.legacy);

const LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

// Display label for any stored value. An unrecognised value is shown as-is
// rather than crashing or rendering blank; only a genuinely empty value falls
// back to a dash.
export function paymentMethodLabel(value) {
  if (!value) return '—';
  return LABELS[value] || value;
}

// Insurer-paid methods: counted as revenue at billing time like any other
// method, and neither cash nor bank.
export function isInsuranceMethod(value) {
  return value === 'gia_international' || value === 'habib_insurance';
}
