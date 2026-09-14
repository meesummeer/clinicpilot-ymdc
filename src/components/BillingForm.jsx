import { useRef, useState } from 'react';
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

export default function BillingForm({ doctors, onSaved, onCancel, profileId, entry }) {
  const isEditing = !!entry;
  const initialDoctorId = entry?.doctor_id || doctors[0]?.id || '';
  const [form, setForm] = useState({
    patient_name: entry?.patient_name || '',
    patient_phone: entry?.patient_phone || '',
    patient_age: entry?.patient_age ?? '',
    doctor_id: initialDoctorId,
    service: entry?.service || '',
    amount: entry?.amount ?? '',
    billed_amount: entry?.billed_amount ?? '',
    payment_method: entry?.payment_method || 'cash',
    billing_date: entry?.billing_date || new Date().toISOString().slice(0, 10),
    notes: entry?.notes || '',
  });
  const [hasBalance, setHasBalance] = useState(!!entry?.billed_amount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      patient_age: form.patient_age ? parseInt(form.patient_age, 10) : null,
      amount: parseFloat(form.amount),
      billed_amount: hasBalance && form.billed_amount ? parseFloat(form.billed_amount) : null,
    };
    const { error } = isEditing
      ? await supabase.from('billing').update(payload).eq('id', entry.id)
      : await supabase.from('billing').insert({ ...payload, created_by: profileId });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ borderTop: '4px solid var(--gold)' }}>
      <h3 style={{ marginTop: 0 }}>{isEditing ? 'Edit Billing Entry' : 'New Billing Entry'}</h3>
      {error && <div className="error-text">{error}</div>}
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
            onChange={(e) => update('patient_phone', e.target.value)}
          />
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
          <label>{hasBalance ? 'Amount Collected (PKR)' : 'Amount (PKR)'}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => update('amount', e.target.value)}
            required
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
      <div className="filters-row">
        <div className="filter-field">
          <label>Payment Method</label>
          <select value={form.payment_method} onChange={(e) => update('payment_method', e.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="filter-field" style={{ marginBottom: 14 }}>
        <label>Notes</label>
        <input
          style={{ width: '100%' }}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </div>
      <button type="submit" className="btn-primary" disabled={saving} style={{ marginRight: 8 }}>
        {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Save Billing Entry'}
      </button>
      <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
    </form>
  );
}
