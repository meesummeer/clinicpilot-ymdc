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

// ── Time range formatting: "3:00 PM – 3:30 PM", or just the start time
// when there's no end time ──────────────────────────────────────
export function formatTimeRange12h(startTime, endTime) {
  const start = formatTime12h(startTime);
  if (!endTime) return start;
  return `${start} – ${formatTime12h(endTime)}`;
}

// ── Time arithmetic: add minutes to an "HH:MM" string, wrapping at 24h ──
export function addMinutesToTime(time24, minutesToAdd) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const total = (parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + minutesToAdd + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
  const t = timeStr.slice(0, 5);
  const start = (doctor.start_time || '').slice(0, 5);
  const end = (doctor.end_time || '').slice(0, 5);
  return t >= start && t <= end;
}

export function doctorScheduleLabel(doctor) {
  if (!doctor) return '';
  const dayMap = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
  const days = (doctor.working_days || []).map((d) => dayMap[d]);
  return `${days.join(', ')} · ${formatTime12h(doctor.start_time)} – ${formatTime12h(doctor.end_time)}`;
}
