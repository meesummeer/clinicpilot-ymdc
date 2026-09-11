import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatTime12h } from '../lib/formatters';

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

function pad(n) { return String(n).padStart(2, '0'); }

export default function DoctorCalendar() {
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // month 0-indexed
  });
  const [appointments, setAppointments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    supabase.from('doctors').select('*').eq('active', true).order('name').then(({ data }) => {
      setDoctors(data || []);
      if (data && data.length && !doctorId) setDoctorId(data[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!doctorId) return;
    const monthStart = `${cursor.year}-${pad(cursor.month + 1)}-01`;
    const lastDay = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const monthEnd = `${cursor.year}-${pad(cursor.month + 1)}-${pad(lastDay)}`;
    supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', doctorId)
      .gte('appointment_date', monthStart)
      .lte('appointment_date', monthEnd)
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setAppointments(data || []);
        setSelectedDay(null);
      });
  }, [doctorId, cursor]);

  const byDay = useMemo(() => {
    const map = {};
    appointments.forEach((a) => {
      const day = parseInt(a.appointment_date.slice(8, 10), 10);
      if (!map[day]) map[day] = [];
      map[day].push(a);
    });
    return map;
  }, [appointments]);

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const monthLabel = firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const dayAppointments = selectedDay ? (byDay[selectedDay] || []) : [];

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="card">
        <div className="filters-row">
          <div className="filter-field">
            <label>Doctor</label>
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label>Month</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn-secondary" onClick={() => setCursor((c) => {
                const m = c.month - 1;
                return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m };
              })}>‹</button>
              <strong style={{ minWidth: 150, textAlign: 'center' }}>{monthLabel}</strong>
              <button className="btn-secondary" onClick={() => setCursor((c) => {
                const m = c.month + 1;
                return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m };
              })}>›</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#777', marginBottom: 6 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dayAppts = byDay[day] || [];
            const isSelected = selectedDay === day;
            return (
              <div
                key={i}
                onClick={() => setSelectedDay(day)}
                style={{
                  border: isSelected ? `2px solid ${selectedDoctor?.color_hex || '#1A0A6E'}` : '1px solid var(--border-grey)',
                  borderRadius: 6,
                  minHeight: 62,
                  padding: 6,
                  cursor: 'pointer',
                  background: dayAppts.length ? '#FAFAFA' : 'white',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>{day}</div>
                {dayAppts.length > 0 && (
                  <div style={{
                    marginTop: 4, fontSize: 11, fontWeight: 700, color: 'white',
                    background: selectedDoctor?.color_hex || '#1A0A6E',
                    borderRadius: 10, padding: '1px 7px', display: 'inline-block',
                  }}>
                    {dayAppts.length}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            {selectedDoctor?.name} — {monthLabel.split(' ')[0]} {selectedDay}, {cursor.year}
          </h3>
          {dayAppointments.length === 0 ? (
            <div className="empty-state">No appointments this day.</div>
          ) : (
            dayAppointments
              .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
              .map((a) => (
                <div key={a.id} className="appointment-card" style={{ borderLeftColor: selectedDoctor?.color_hex || '#ccc' }}>
                  <div className="info">
                    <strong>{formatTime12h(a.appointment_time)} — {a.patient_name}</strong>
                    <span>{a.patient_phone || ''} {a.notes ? `· ${a.notes}` : ''}</span>
                  </div>
                  <span className={`status-badge status-${a.status}`}>{STATUS_LABEL[a.status]}</span>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
