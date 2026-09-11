import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AppointmentForm({ doctors, onSaved, onCancel, profileId }) {
  const [form, setForm] = useState({
    patient_name: '',
    patient_phone: '',
    doctor_id: doctors[0]?.id || '',
    appointment_date: new Date().toISOString().slice(0, 10),
    appointment_time: '10:00',
    status: 'scheduled',
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
    const { error } = await supabase.from('appointments').insert({
      ...form,
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
      <h3 style={{ marginTop: 0 }}>New Appointment</h3>
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
          <label>Phone</label>
          <input
            value={form.patient_phone}
            onChange={(e) => update('patient_phone', e.target.value)}
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
      </div>
      <div className="filters-row">
        <div className="filter-field">
          <label>Date</label>
          <input
            type="date"
            value={form.appointment_date}
            onChange={(e) => update('appointment_date', e.target.value)}
            required
          />
        </div>
        <div className="filter-field">
          <label>Time</label>
          <input
            type="time"
            value={form.appointment_time}
            onChange={(e) => update('appointment_time', e.target.value)}
            required
          />
        </div>
        <div className="filter-field">
          <label>Status</label>
          <select value={form.status} onChange={(e) => update('status', e.target.value)}>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
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
        {saving ? 'Saving…' : 'Save Appointment'}
      </button>
      <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
    </form>
  );
}
