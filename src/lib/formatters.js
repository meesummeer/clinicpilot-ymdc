// ── Date formatting: DD/MM/YYYY everywhere ──────────────────────
export function formatDateDMY(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// ── Time formatting: AM/PM everywhere ───────────────────────────
export function formatTime12h(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${ampm}`;
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Doctor working_days uses 1=Mon..6=Sat,7=Sun (matches ISO-ish, no zero)
export function jsDayToDoctorDay(jsDay) {
  return jsDay === 0 ? 7 : jsDay;
}

export function isDateWithinDoctorSchedule(dateStr, doctor) {
  if (!doctor || !dateStr) return true;
  const jsDay = new Date(dateStr + 'T00:00:00').getDay();
  const docDay = jsDayToDoctorDay(jsDay);
  return (doctor.working_days || []).includes(docDay);
}

export function isTimeWithinDoctorSchedule(timeStr, doctor) {
  if (!doctor || !timeStr) return true;
  return timeStr >= doctor.start_time && timeStr <= doctor.end_time;
}

export function doctorScheduleLabel(doctor) {
  if (!doctor) return '';
  const dayMap = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
  const days = (doctor.working_days || []).map((d) => dayMap[d]);
  return `${days.join(', ')} · ${formatTime12h(doctor.start_time)} – ${formatTime12h(doctor.end_time)}`;
}
