import { useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  isDateWithinDoctorSchedule,
  isTimeWithinDoctorSchedule,
  doctorScheduleLabel,
  addMinutesToTime,
} from '../lib/formatters';

export default function AppointmentForm({ doctors, onSaved, onCancel, profileId, editing }) {
  const initialStartTime = editing ? editing.appointment_time?.slice(0, 5) : '10:00';
  const initialEndTime = editing?.end_time
    ? editing.end_time.slice(0, 5)
    : addMinutesToTime(initialStartTime, 30);

  const [form, setForm] = useState(
    editing
      ? {
          patient_name: editing.patient_name,
          patient_phone: editing.patient_phone || '',
          doctor_id: editing.doctor_id,
          appointment_date: editing.appointment_date,
          appointment_time: initialStartTime,
          end_time: initialEndTime,
          status: editing.status,
          notes: editing.notes || '',
        }
      : {
          patient_name: '',
          patient_phone: '',
          doctor_id: doctors[0]?.id || '',
          appointment_date: new Date().toISOString().slice(0, 10),
          appointment_time: initialStartTime,
          end_time: initialEndTime,
          status: 'scheduled',
          notes: '',
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Tracks the end time we last auto-calculated (start + 30min), so changing
  // the start time only re-syncs end time if the user hasn't overridden it.
  const isEndTimeAuto = !editing?.end_time || editing.end_time.slice(0, 5) === addMinutesToTime(initialStartTime, 30);
  const lastAutoEndTimeRef = useRef(isEndTimeAuto ? initialEndTime : null);

  const selectedDoctor = doctors.find((d) => d.id === form.doctor_id);

  const scheduleWarning = useMemo(() => {
    if (!selectedDoctor || !form.appointment_date || !form.appointment_time) return null;
    const dateOk = isDateWithinDoctorSchedule(form.appointment_date, selectedDoctor);
    const timeOk = isTimeWithinDoctorSchedule(form.appointment_time, selectedDoctor);
    if (dateOk && timeOk) return null;
    return `${selectedDoctor.name} works: ${doctorScheduleLabel(selectedDoctor)}. This slot falls outside that.`;
  }, [selectedDoctor, form.appointment_date, form.appointment_time]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleStartTimeChange(value) {
    setForm((f) => {
      const autoEnd = addMinutesToTime(value, 30);
      if (f.end_time === '' || f.end_time === lastAutoEndTimeRef.current) {
        lastAutoEndTimeRef.current = autoEnd;
        return { ...f, appointment_time: value, end_time: autoEnd };
      }
      return { ...f, appointment_time: value };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (scheduleWarning && !window.confirm(`${scheduleWarning}\n\nBook anyway?`)) return;
    setSaving(true);
    setError('');

    const payload = { ...form, end_time: form.end_time || null };

    const { error } = editing
      ? await supabase.from('appointments').update(payload).eq('id', editing.id)
      : await supabase.from('appointments').insert({ ...payload, created_by: profileId });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete this appointment for ${editing.patient_name}? This can't be undone.`)) return;
    setSaving(true);
    const { error } = await supabase.from('appointments').delete().eq('id', editing.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ borderTop: '4px solid var(--gold)' }}>
      <h3 style={{ marginTop: 0 }}>{editing ? 'Edit Appointment' : 'New Appointment'}</h3>
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
      {selectedDoctor && (
        <p style={{ fontSize: 12, color: '#777', marginTop: -8 }}>
          Works: {doctorScheduleLabel(selectedDoctor)}
        </p>
      )}
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
            onChange={(e) => handleStartTimeChange(e.target.value)}
            required
          />
        </div>
        <div className="filter-field">
          <label>End Time</label>
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => update('end_time', e.target.value)}
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
      {scheduleWarning && (
        <div style={{ background: '#FBE6E6', color: 'var(--red)', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
          ⚠ {scheduleWarning}
        </div>
      )}
      <div className="filter-field" style={{ marginBottom: 14 }}>
        <label>Notes</label>
        <input
          style={{ width: '100%' }}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </div>
      <button type="submit" className="btn-primary" disabled={saving} style={{ marginRight: 8 }}>
        {saving ? 'Saving…' : editing ? 'Save Changes' : 'Save Appointment'}
      </button>
      <button type="button" className="btn-secondary" onClick={onCancel} style={{ marginRight: 8 }}>Cancel</button>
      {editing && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving}
          className="btn-danger-outline"
          style={{ float: 'right' }}
        >
          Delete Appointment
        </button>
      )}
    </form>
  );
}
