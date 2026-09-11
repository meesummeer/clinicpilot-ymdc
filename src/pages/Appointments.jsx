import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import AppointmentForm from '../components/AppointmentForm';
import { formatDateDMY, formatTime12h } from '../lib/formatters';

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export default function Appointments({ profile }) {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAppt, setEditingAppt] = useState(null);

  const [filterDoctor, setFilterDoctor] = useState('all');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    supabase.from('doctors').select('*').eq('active', true).order('name').then(({ data }) => {
      setDoctors(data || []);
    });
  }, []);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('appointments')
      .select('*, doctors(name, color_hex)')
      .order('appointment_time', { ascending: true });

    if (filterDate) query = query.eq('appointment_date', filterDate);
    if (filterDoctor !== 'all') query = query.eq('doctor_id', filterDoctor);
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);

    const { data, error } = await query;
    if (error) console.error(error.message);
    setAppointments(data || []);
    setLoading(false);
  }, [filterDate, filterDoctor, filterStatus]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const canEdit = profile?.role === 'admin' || profile?.role === 'csr';

  function openNew() {
    setEditingAppt(null);
    setShowForm(true);
  }
  function openEdit(appt) {
    if (!canEdit) return;
    setEditingAppt(appt);
    setShowForm(true);
  }

  return (
    <div>
      <div className="card">
        <div className="filters-row">
          <div className="filter-field">
            <label>Date</label>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
          <div className="filter-field">
            <label>Doctor</label>
            <select value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)}>
              <option value="all">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label>Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>
          {canEdit && (
            <button className="btn-primary" onClick={() => (showForm ? setShowForm(false) : openNew())}>
              {showForm ? 'Close' : '+ New Appointment'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: '#666' }}>
          {doctors.map((d) => (
            <span key={d.id}>
              <span className="doctor-dot" style={{ background: d.color_hex }} />
              {d.name}
            </span>
          ))}
        </div>
      </div>

      {showForm && canEdit && (
        <AppointmentForm
          doctors={doctors}
          profileId={profile.id}
          editing={editingAppt}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setEditingAppt(null);
            loadAppointments();
          }}
        />
      )}

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : appointments.length === 0 ? (
          <div className="empty-state">No appointments for this filter.</div>
        ) : (
          appointments.map((a) => (
            <div
              key={a.id}
              className="appointment-card"
              style={{ borderLeftColor: a.doctors?.color_hex || '#ccc', cursor: canEdit ? 'pointer' : 'default' }}
              onClick={() => openEdit(a)}
              title={canEdit ? 'Click to edit or delete' : ''}
            >
              <div className="info">
                <strong>{formatTime12h(a.appointment_time)} — {a.patient_name}</strong>
                <span>
                  {a.doctors?.name} · {formatDateDMY(a.appointment_date)}
                  {a.patient_phone ? ` · ${a.patient_phone}` : ''}
                  {a.notes ? ` · ${a.notes}` : ''}
                </span>
              </div>
              <span className={`status-badge status-${a.status}`}>{STATUS_LABEL[a.status]}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
