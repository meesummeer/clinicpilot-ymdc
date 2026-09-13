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
  const [doctorId, setDoctorId] = useState('all');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // month 0-indexed
  });
  const [appointments, setAppointments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    supabase.from('doctors').select('*').eq('active', true).order('name').then(({ data }) => {
      setDoctors(data || []);
    });
  }, []);

  useEffect(() => {
    const monthStart = `${cursor.year}-${pad(cursor.month + 1)}-01`;
    const lastDay = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const monthEnd = `${cursor.year}-${pad(cursor.month + 1)}-${pad(lastDay)}`;
    let query = supabase
      .from('appointments')
      .select('*, doctors(name, color_hex)')
      .gte('appointment_date', monthStart)
      .lte('appointment_date', monthEnd);

    if (doctorId !== 'all') query = query.eq('doctor_id', doctorId);

    query.then(({ data, error }) => {
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

  const isAllDoctors = doctorId === 'all';
  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const dayAppointments = selectedDay ? (byDay[selectedDay] || []) : [];

  function apptColor(a) {
    return a.doctors?.color_hex || selectedDoctor?.color_hex || '#1A0A6E';
  }

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
              <option value="all">All Doctors</option>
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

      <div className="card calendar-card">
        <div className="calendar-weekday-row">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="calendar-grid">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dayAppts = byDay[day] || [];
            const isSelected = selectedDay === day;
            const isToday = day === new Date().getDate() && cursor.month === new Date().getMonth() && cursor.year === new Date().getFullYear();
            const classes = ['calendar-cell'];
            if (dayAppts.length) classes.push('has-appts');
            if (isSelected) classes.push('selected');
            if (isToday) classes.push('today');
            return (
              <div
                key={i}
                onClick={() => setSelectedDay(day)}
                className={classes.join(' ')}
                style={isSelected ? { borderColor: selectedDoctor?.color_hex || '#1A0A6E' } : {}}
              >
                <span className="calendar-daynum">{day}</span>
                {dayAppts.length > 0 && (
                  isAllDoctors ? (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {dayAppts.map((a) => (
                        <span
                          key={a.id}
                          title={a.doctors?.name}
                          style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: apptColor(a), display: 'inline-block',
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="calendar-count" style={{ background: selectedDoctor?.color_hex || '#1A0A6E' }}>
                      {dayAppts.length}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            {isAllDoctors ? 'All Doctors' : selectedDoctor?.name} — {monthLabel.split(' ')[0]} {selectedDay}, {cursor.year}
          </h3>
          {dayAppointments.length === 0 ? (
            <div className="empty-state">No appointments this day.</div>
          ) : (
            dayAppointments
              .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
              .map((a) => (
                <div key={a.id} className="appointment-card" style={{ borderLeftColor: apptColor(a) }}>
                  <div className="info">
                    <strong>{formatTime12h(a.appointment_time)} — {a.patient_name}</strong>
                    <span>{a.patient_phone || ''} {a.notes ? `· ${a.notes}` : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isAllDoctors && (
                      <span className="status-badge" style={{ background: apptColor(a), color: 'white' }}>
                        {a.doctors?.name}
                      </span>
                    )}
                    <span className={`status-badge status-${a.status}`}>{STATUS_LABEL[a.status]}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
