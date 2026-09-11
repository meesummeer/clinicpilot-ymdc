import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatTime12h } from '../lib/formatters';

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export default function Today() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  useEffect(() => {
    supabase
      .from('appointments')
      .select('*, doctors(name, color_hex)')
      .eq('appointment_date', today)
      .order('appointment_time', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setAppointments(data || []);
        setLoading(false);
      });
  }, [today]);

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0, color: 'var(--navy)' }}>Today — {todayLabel}</h2>
        <p style={{ color: '#777', marginTop: -6 }}>{appointments.length} appointment{appointments.length !== 1 ? 's' : ''} scheduled</p>
      </div>
      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : appointments.length === 0 ? (
          <div className="empty-state">No appointments today.</div>
        ) : (
          appointments.map((a) => (
            <div key={a.id} className="appointment-card" style={{ borderLeftColor: a.doctors?.color_hex || '#ccc' }}>
              <div className="info">
                <strong>{formatTime12h(a.appointment_time)} — {a.patient_name}</strong>
                <span>{a.doctors?.name} {a.patient_phone ? `· ${a.patient_phone}` : ''} {a.notes ? `· ${a.notes}` : ''}</span>
              </div>
              <span className={`status-badge status-${a.status}`}>{STATUS_LABEL[a.status]}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
