// Display: DD/MM/YYYY and hh:mm AM/PM everywhere in the app.
// (Native <input type="date"/"time"> pickers show the OS/browser's own
// format when open — that's a browser limitation we can't override —
// but every date/time we render ourselves uses these functions.)

export function formatDateDMY(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function formatTime12h(time24) {
  if (!time24) return '';
  const [hStr, m] = time24.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dayNameFromISO(isoDate) {
  // Avoid timezone shift issues: parse Y/M/D manually instead of `new Date(isoDate)`.
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return DAY_NAMES[date.getDay()];
}

export function isTimeWithinRange(time24, start, end) {
  return time24 >= start && time24 <= end;
}
