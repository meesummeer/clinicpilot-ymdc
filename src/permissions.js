// The ONE place that decides who can open what. The sidebar, the route
// guard and the Hub all read from here — add or change access here only.
//
// Roles. staff_profiles.role holds admin | csr | ceo | doctor. There is no
// stored "manager" value: a manager is a csr who has been given
// has_expenses_access (that is how Rashid's account is set up), and
// effectiveRole() turns that into 'manager'. A literal role 'manager' (if
// one is ever added to the database) is honoured as-is.

// Who sees the financial blocks on the Hub (cards, 3-month trend, Generate
// Financial Report, Cash vs Bank, Historical P&L, revenue figures). For now
// everyone who can open the Hub. To hide them from CSRs later, delete
// 'csr' from this one line.
export const HUB_FINANCIALS_ROLES = ['admin', 'manager', 'csr', 'ceo'];

export function effectiveRole(profile) {
  if (!profile) return null;
  if (profile.role === 'csr' && profile.has_expenses_access === true) return 'manager';
  return profile.role;
}

// path: the URL (kept stable so bookmarks keep working). roles: who may open
// it. requiresFlag: a staff_profiles boolean that must also be true.
export const PAGES = {
  hub: { path: '/hub', roles: ['admin', 'manager', 'csr', 'ceo'] },
  today: { path: '/today', roles: ['admin', 'manager', 'csr'] },
  calendar: { path: '/calendar', roles: ['admin', 'manager', 'csr', 'doctor'] },
  appointments: { path: '/appointments', roles: ['admin', 'manager', 'csr'] },
  billing: { path: '/billing', roles: ['admin', 'manager', 'csr'] },
  patients: { path: '/patients', roles: ['admin', 'manager', 'csr', 'doctor'] },
  revenue: { path: '/revenue', roles: ['doctor'] },
  expenses: { path: '/expenses', roles: ['admin', 'manager', 'ceo'], requiresFlag: 'has_expenses_access' },
  doctorCalculator: { path: '/doctor-calculator', roles: ['admin'] },
  settings: { path: '/settings', roles: ['admin'] },
  doctors: { path: '/doctors', roles: ['admin'] },
};

export const PAGE_TITLES = {
  '/today': "Today's Appointments",
  '/appointments': 'Appointments',
  '/calendar': 'Doctor Calendar',
  '/billing': 'Billing',
  '/patients': 'Patients',
  '/doctors': 'Manage Doctors',
  '/hub': 'Hub',
  '/revenue': 'Revenue',
  '/expenses': 'Expenses',
  '/settings': 'Settings',
  '/doctor-calculator': 'Doctor Calculator',
};

export function canAccess(profile, pageKey) {
  const page = PAGES[pageKey];
  if (!page || !profile) return false;
  if (!page.roles.includes(effectiveRole(profile))) return false;
  if (page.requiresFlag && profile[page.requiresFlag] !== true) return false;
  return true;
}

// Where a user lands at "/" and where a denied URL sends them: the Hub if
// they have it, otherwise their own first page (doctors).
export function homePath(profile) {
  if (canAccess(profile, 'hub')) return PAGES.hub.path;
  return PAGES.calendar.path;
}

export function landingPath(profile) {
  const role = effectiveRole(profile);
  if (role === 'ceo') return PAGES.hub.path;
  if (role === 'doctor') return PAGES.calendar.path;
  return PAGES.today.path;
}

// The sidebar, top to bottom. A group lists its children; the sidebar shows
// only the pages the user can open, drops empty groups, and shows a group
// with a single visible child as a plain link.
export const SIDEBAR = [
  { page: 'hub', label: 'Hub' },
  { page: 'today', label: 'Today' },
  { page: 'calendar', label: 'Calendar' },
  { page: 'revenue', label: 'Revenue' },
  {
    group: 'abp',
    label: 'ABP',
    children: [
      { page: 'appointments', label: 'Appointments' },
      { page: 'billing', label: 'Billing' },
      { page: 'patients', label: 'Patients' },
    ],
  },
  {
    group: 'expenses',
    label: 'Expenses',
    children: [
      { page: 'expenses', label: 'Expenses' },
      { page: 'doctorCalculator', label: 'Doctor Calculator' },
    ],
  },
  {
    group: 'settings',
    label: 'Settings',
    children: [
      { page: 'settings', label: 'Settings' },
      { page: 'doctors', label: 'Manage Doctors' },
    ],
  },
];

// What the Hub may show this user. `financials`: the revenue/profit blocks.
// It needs the role to be listed above AND the database to actually return
// the numbers: doctor costs are readable only by admin/ceo/has_hub_access,
// so without that the YMDC share would silently come out too high.
// `expenses`: expenses are readable only with has_expenses_access, so without
// it Expenses/Profit would silently read PKR 0.
export function hubAccess(profile) {
  const role = effectiveRole(profile);
  const dataAccess = role === 'admin' || role === 'ceo' || profile?.has_hub_access === true;
  return {
    financials: HUB_FINANCIALS_ROLES.includes(role) && dataAccess,
    expenses: profile?.has_expenses_access === true,
  };
}
