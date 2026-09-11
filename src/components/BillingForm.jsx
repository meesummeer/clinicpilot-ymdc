import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function BillingForm({ doctors, onSaved, onCancel, profileId }) {
  const [form, setForm] = useState({
    patient_name: '',
    doctor_id: doctors[0]?.id || '',
    amount: '',
    payment_method: 'cash',
    billing_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error } = await supabase.from('billing').insert({
      ...form,
      amount: parseFloat(form.amount),
      created_by: profileId,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ borderTop: '4px solid var(--gold)' }}>
      <h3 style={{ marginTop: 0 }}>New Billing Entry</h3>
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
          <label>Doctor</label>
          <select value={form.doctor_id} onChange={(e) => update('doctor_id', e.target.value)} required>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label>Amount (PKR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => update('amount', e.target.value)}
            required
          />
        </div>
      </div>
      <div className="filters-row">
        <div className="filter-field">
          <label>Date</label>
          <input
            type="date"
            value={form.billing_date}
            onChange={(e) => update('billing_date', e.target.value)}
            required
          />
        </div>
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
        {saving ? 'Saving…' : 'Save Billing Entry'}
      </button>
      <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
    </form>
  );
}
