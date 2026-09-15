import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatTimeRange12h } from '../lib/formatters';

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

function pad(n) { return String(n).padStart(2, '0'); }

export default function DoctorOwnCalendar({ profile }) {
  const doctorId = profile?.doctor_id;

  const [doctor, setDoctor] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // month 0-indexed
  });
  const [appointments, setAppointments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    if (!doctorId) return;
    supabase.from('doctors').select('*').eq('id', doctorId).single().then(({ data, error }) => {
      if (error) console.error(error.message);
      setDoctor(data || null);
    });
  }, [doctorId]);

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

  const dayAppointments = selectedDay ? (byDay[selectedDay] || []) : [];
  const color = doctor?.color_hex || '#1A0A6E';

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  if (!doctorId) {
    return (
      <div className="card">
        <div className="empty-state">Your account isn't linked to a doctor record yet. Ask the admin to set this up.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="filters-row" style={{ marginBottom: 0 }}>
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
                style={isSelected ? { borderColor: color } : {}}
              >
                <span className="calendar-daynum">{day}</span>
                {dayAppts.length > 0 && (
                  <div className="calendar-count" style={{ background: color }}>
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
            {monthLabel.split(' ')[0]} {selectedDay}, {cursor.year}
          </h3>
          {dayAppointments.length === 0 ? (
            <div className="empty-state">No appointments this day.</div>
          ) : (
            dayAppointments
              .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
              .map((a) => (
                <div key={a.id} className="appointment-card" style={{ borderLeftColor: color }}>
                  <div className="info">
                    <strong>{formatTimeRange12h(a.appointment_time, a.end_time)} — {a.patient_name}</strong>
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
