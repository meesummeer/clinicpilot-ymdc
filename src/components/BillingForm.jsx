import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Doctor name -> service label used to auto-fill "Consultation - {label}".
// Doctors not listed here are left out of auto-fill entirely.
const DOCTOR_SERVICE_LABELS = {
  'Dr. Aneela Shaikh': 'Gynaecologist/Sonologist',
  'Dr. Anwer Majeed': 'GP',
  'Dr. A.J Panhwar': 'GP',
  'Dr. Hafiza Sundas': 'Physiotherapist',
  'Dr. Rashid Ali': 'Physiotherapist',
  'Dr. Maqbool Hussain': 'Eye Surgeon',
  'Dr. Sheikh Imran': 'Orthopedic Surgeon',
  'Dr. Tara Chand': 'Sonologist',
  Farrukh: 'Optometrist',
};

function autoServiceFor(doctorName) {
  const label = DOCTOR_SERVICE_LABELS[doctorName];
  return label ? `Consultation - ${label}` : null;
}

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

function emptyPayment() {
  return { payment_method: 'cash', amount: '' };
}

export default function BillingForm({ doctors, onSaved, onSavedAndPrint, onCancel, profileId, entry }) {
  const isEditing = !!entry;
  const initialDoctorId = entry?.doctor_id || doctors[0]?.id || '';
  const [form, setForm] = useState({
    patient_name: entry?.patient_name || '',
    patient_phone: entry?.patient_phone || '',
    patient_age: entry?.patient_age ?? '',
    doctor_id: initialDoctorId,
    service: entry?.service || '',
    billed_amount: entry?.billed_amount ?? '',
    billing_date: entry?.billing_date || new Date().toISOString().slice(0, 10),
    notes: entry?.notes || '',
  });
  const [hasBalance, setHasBalance] = useState(!!entry?.billed_amount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [phoneMatch, setPhoneMatch] = useState(false);
  const [pendingAction, setPendingAction] = useState('save');

  // Patient search — debounced lookup by name or phone, shown as a dropdown
  // above the Patient Name/Phone fields.
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const patientSearchRef = useRef(null);

  // Payment rows — defaults to one empty row for a new entry, or the entry's
  // legacy single amount/method until its real billing_payments rows load.
  const [payments, setPayments] = useState(() =>
    entry
      ? [{ payment_method: entry.payment_method || 'cash', amount: entry.amount != null ? String(entry.amount) : '' }]
      : [emptyPayment()]
  );

  useEffect(() => {
    if (!entry?.id) return;
    supabase
      .from('billing_payments')
      .select('*')
      .eq('billing_id', entry.id)
      .then(({ data, error: loadError }) => {
        if (loadError) {
          console.error(loadError.message);
          return;
        }
        if (data && data.length > 0) {
          setPayments(data.map((p) => ({ payment_method: p.payment_method, amount: String(p.amount) })));
        }
      });
  }, [entry?.id]);

  useEffect(() => {
    const query = patientSearch.trim();
    if (!query) {
      setPatientResults([]);
      setPatientSearchOpen(false);
      return;
    }
    const timeout = setTimeout(async () => {
      // Strip characters that would break PostgREST's or() filter syntax —
      // neither a name nor a phone number legitimately contains these.
      const safeQuery = query.replace(/[,()]/g, '');
      if (!safeQuery) return;
      const { data, error: searchError } = await supabase
        .from('patients')
        .select('*')
        .or(`name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`)
        .limit(8);
      if (searchError) {
        console.error(searchError.message);
        return;
      }
      setPatientResults(data || []);
      setPatientSearchOpen(true);
    }, 300);
    return () => clearTimeout(timeout);
  }, [patientSearch]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target)) {
        setPatientSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function selectPatient(patient) {
    setForm((f) => ({ ...f, patient_name: patient.name, patient_phone: patient.phone || '' }));
    setPhoneMatch(!!patient.phone);
    setPatientSearch('');
    setPatientResults([]);
    setPatientSearchOpen(false);

    if (!patient.phone) return;
    const { data, error: ageError } = await supabase
      .from('patient_last_visit')
      .select('last_age')
      .eq('phone', patient.phone)
      .maybeSingle();
    if (ageError) {
      console.error(ageError.message);
      return;
    }
    if (data?.last_age != null) {
      setForm((f) => ({ ...f, patient_age: String(data.last_age) }));
    }
  }

  // Tracks the last value we auto-filled into Service, so a doctor change
  // only overwrites it if the user hasn't customized it since.
  const initialDoctorName = doctors.find((d) => d.id === initialDoctorId)?.name;
  const initialAutoService = autoServiceFor(initialDoctorName);
  const lastAutoFillRef = useRef(
    entry?.service && entry.service === initialAutoService ? initialAutoService : null
  );

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updatePayment(index, field, value) {
    setPayments((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function addPayment() {
    setPayments((rows) => [...rows, emptyPayment()]);
  }

  function removePayment(index) {
    setPayments((rows) => rows.filter((_, i) => i !== index));
  }

  const paymentsTotal = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  async function handlePhoneBlur() {
    const phone = form.patient_phone.trim();
    if (!phone) {
      setPhoneMatch(false);
      return;
    }
    const { data, error: lookupError } = await supabase
      .from('patients')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();
    if (lookupError) {
      console.error(lookupError.message);
      return;
    }
    if (data) {
      setPhoneMatch(true);
      setForm((f) => ({ ...f, patient_name: data.name }));
    } else {
      setPhoneMatch(false);
    }
  }

  function handleDoctorChange(doctorId) {
    const doctorName = doctors.find((d) => d.id === doctorId)?.name;
    const autoService = autoServiceFor(doctorName);
    setForm((f) => {
      if (autoService && (f.service === '' || f.service === lastAutoFillRef.current)) {
        lastAutoFillRef.current = autoService;
        return { ...f, doctor_id: doctorId, service: autoService };
      }
      return { ...f, doctor_id: doctorId };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const validPayments = payments
      .map((p) => ({ payment_method: p.payment_method, amount: parseFloat(p.amount) }))
      .filter((p) => !isNaN(p.amount) && p.amount >= 0);

    if (validPayments.length === 0) {
      setError('Add at least one payment with an amount (0 is allowed, e.g. for a free checkup).');
      return;
    }

    setSaving(true);
    const totalAmount = validPayments.reduce((s, p) => s + p.amount, 0);
    const overallPaymentMethod = validPayments.length === 1 ? validPayments[0].payment_method : 'other';

    const payload = {
      ...form,
      patient_age: form.patient_age ? parseInt(form.patient_age, 10) : null,
      billed_amount: hasBalance && form.billed_amount ? parseFloat(form.billed_amount) : null,
      amount: totalAmount,
      payment_method: overallPaymentMethod,
    };

    const query = isEditing
      ? supabase.from('billing').update(payload).eq('id', entry.id)
      : supabase.from('billing').insert({ ...payload, created_by: profileId });
    const { data, error: saveError } = await query.select('*, doctors(name, color_hex)').single();
    if (saveError) {
      setSaving(false);
      setError(saveError.message);
      return;
    }

    if (isEditing) {
      const { error: deleteError } = await supabase.from('billing_payments').delete().eq('billing_id', entry.id);
      if (deleteError) console.error(deleteError.message);
    }

    const { error: paymentsError } = await supabase
      .from('billing_payments')
      .insert(validPayments.map((p) => ({ billing_id: data.id, payment_method: p.payment_method, amount: p.amount })));
    if (paymentsError) console.error(paymentsError.message);

    const phone = form.patient_phone.trim();
    if (phone) {
      const { error: patientError } = await supabase
        .from('patients')
        .upsert({ phone, name: form.patient_name }, { onConflict: 'phone' });
      if (patientError) console.error(patientError.message);
    }

    setSaving(false);
    setPatientSearch('');
    setPatientResults([]);
    setPatientSearchOpen(false);
    if (pendingAction === 'print' && onSavedAndPrint) {
      onSavedAndPrint(data);
    } else {
      onSaved();
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ borderTop: '4px solid var(--gold)' }}>
      <h3 style={{ marginTop: 0 }}>{isEditing ? 'Edit Billing Entry' : 'New Billing Entry'}</h3>
      {error && <div className="error-text">{error}</div>}
      <div className="filter-field" style={{ position: 'relative', marginBottom: 14 }} ref={patientSearchRef}>
        <label>Find Existing Patient</label>
        <input
          style={{ width: '100%' }}
          placeholder="Search patient by name or phone..."
          value={patientSearch}
          onChange={(e) => setPatientSearch(e.target.value)}
          onFocus={() => {
            if (patientResults.length > 0) setPatientSearchOpen(true);
          }}
        />
        {patientSearchOpen && (
          <div className="patient-search-dropdown">
            {patientResults.length === 0 ? (
              <div className="patient-search-empty">No matching patients</div>
            ) : (
              patientResults.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className="patient-search-result"
                  onClick={() => selectPatient(p)}
                >
                  <span className="patient-search-name">{p.name}</span>
                  <span className="patient-search-phone">{p.phone || '—'}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div className="filters-row">
        <div className="filter-field">
          <label>Patient Name</label>
          <input
            value={form.patient_name}
            onChange={(e) => update('patient_name', e.target.value)}
            required
          />
        </div>
        <div className="filter-field">
          <label>Patient Phone</label>
          <input
            value={form.patient_phone}
            onChange={(e) => {
              update('patient_phone', e.target.value);
              setPhoneMatch(false);
            }}
            onBlur={handlePhoneBlur}
          />
          {phoneMatch && (
            <div style={{ fontSize: 11, color: '#1B7A3D', fontWeight: 700, marginTop: 4 }}>
              ✓ Existing patient
            </div>
          )}
        </div>
        <div className="filter-field">
          <label>Patient Age</label>
          <input
            type="number"
            min="0"
            value={form.patient_age}
            onChange={(e) => update('patient_age', e.target.value)}
          />
        </div>
        <div className="filter-field">
          <label>Doctor</label>
          <select value={form.doctor_id} onChange={(e) => handleDoctorChange(e.target.value)} required>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="filters-row">
        <div className="filter-field">
          <label>Service</label>
          <input
            placeholder="e.g. Consultation Charges"
            value={form.service}
            onChange={(e) => update('service', e.target.value)}
          />
        </div>
        <div className="filter-field">
          <label>Date</label>
          <input
            type="date"
            value={form.billing_date}
            onChange={(e) => update('billing_date', e.target.value)}
            required
          />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--grey-text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Payments
        </label>
        {payments.map((p, i) => (
          <div key={i} className="filters-row" style={{ marginBottom: 8 }}>
            <div className="filter-field">
              <label>Method</label>
              <select value={p.payment_method} onChange={(e) => updatePayment(i, 'payment_method', e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="insurance">Insurance</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="filter-field">
              <label>Amount (PKR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={p.amount}
                onChange={(e) => updatePayment(i, 'amount', e.target.value)}
                required
              />
            </div>
            {payments.length > 1 && (
              <div className="filter-field" style={{ minWidth: 0 }}>
                <label>&nbsp;</label>
                <button
                  type="button"
                  className="btn-danger-outline"
                  onClick={() => removePayment(i)}
                  style={{ padding: '9px 14px' }}
                  aria-label="Remove payment"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={addPayment} style={{ marginBottom: 10 }}>
          + Add Payment
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>
          Total: {formatPKR(paymentsTotal)}
        </div>
      </div>

      <div className="filters-row">
        <div className="filter-field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={hasBalance} onChange={(e) => setHasBalance(e.target.checked)} style={{ width: 'auto' }} />
            Partial payment / balance due
          </label>
        </div>
        {hasBalance && (
          <div className="filter-field">
            <label>Total Bill (PKR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Full amount owed"
              value={form.billed_amount}
              onChange={(e) => update('billed_amount', e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="filter-field" style={{ marginBottom: 14 }}>
        <label>Notes</label>
        <input
          style={{ width: '100%' }}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </div>
      <button
        type="submit"
        className="btn-primary"
        disabled={saving}
        style={{ marginRight: 8 }}
        onClick={() => setPendingAction('save')}
      >
        {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Save Billing Entry'}
      </button>
      <button
        type="submit"
        className="btn-secondary"
        disabled={saving}
        style={{ marginRight: 8 }}
        onClick={() => setPendingAction('print')}
      >
        {saving ? 'Saving…' : 'Save & Print'}
      </button>
      <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
    </form>
  );
}
