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

// ── Asia/Karachi calendar (clinic time) ─────────────────────────────
// todayISO() above is the UTC date; for month boundaries and "today" on the
// finance pages the clinic's own calendar is what matters (Karachi is
// UTC+5, so after midnight there the UTC date is still yesterday).
export function karachiTodayISO(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The three calendar months the Hub trend chart shows, oldest first: two
// months ago and last month in full, and the current month up to today
// (month to date). start/end are inclusive YYYY-MM-DD in Karachi time.
export function lastThreeKarachiMonths(now = new Date()) {
  const today = karachiTodayISO(now);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)); // 1-12
  return [2, 1, 0].map((back) => {
    const index = year * 12 + (month - 1) - back;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    const mm = String(m).padStart(2, '0');
    const isMtd = back === 0;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
      key: `${y}-${mm}`,
      label: `${MONTH_SHORT[m - 1]} ${y}${isMtd ? ' (MTD)' : ''}`,
      shortLabel: `${MONTH_SHORT[m - 1]} ${y}`,
      start: `${y}-${mm}-01`,
      end: isMtd ? today : `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
      isMtd,
    };
  });
}

// ── Quick date-range presets (Asia/Karachi) ─────────────────────────
function isoFromUTC(y, m, d) {
  // m is 1-12; Date.UTC normalises day overflow/underflow (day 0 = last day of prior month).
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// The six presets for the From/To filters, all in Karachi calendar time.
export function datePresetRanges(now = new Date()) {
  const today = karachiTodayISO(now);
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const d = Number(today.slice(8, 10));

  const prevMonthY = m === 1 ? y - 1 : y;
  const prevMonthM = m === 1 ? 12 : m - 1;
  const prevMonthLastDay = new Date(Date.UTC(prevMonthY, prevMonthM, 0)).getUTCDate();

  return [
    { key: 'today', label: 'Today', from: today, to: today },
    { key: 'yesterday', label: 'Yesterday', from: isoFromUTC(y, m, d - 1), to: isoFromUTC(y, m, d - 1) },
    { key: 'thisMonth', label: 'This Month', from: isoFromUTC(y, m, 1), to: today },
    {
      key: 'lastMonth',
      label: 'Last Month',
      from: isoFromUTC(prevMonthY, prevMonthM, 1),
      to: isoFromUTC(prevMonthY, prevMonthM, prevMonthLastDay),
    },
    {
      key: 'lastMonthThisTime',
      label: 'Last Month This Time',
      from: isoFromUTC(prevMonthY, prevMonthM, 1),
      // same day-of-month last month, clamped (Mar 31 -> Feb 28/29)
      to: isoFromUTC(prevMonthY, prevMonthM, Math.min(d, prevMonthLastDay)),
    },
    { key: 'lastYear', label: 'Last Year', from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
  ];
}
