import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { supabase } from './lib/supabaseClient';
import Login from './pages/Login';
import Appointments from './pages/Appointments';
import Today from './pages/Today';
import DoctorCalendar from './pages/DoctorCalendar';
import Billing from './pages/Billing';
import Patients from './pages/Patients';
import ManageDoctors from './pages/ManageDoctors';
import Hub from './pages/Hub';
import Expenses from './pages/Expenses';
import Backup from './pages/Backup';
import DoctorCalculator from './pages/DoctorCalculator';
import DoctorOwnCalendar from './pages/DoctorOwnCalendar';
import DoctorRevenue from './pages/DoctorRevenue';
import DoctorPatients from './pages/DoctorPatients';
import Logo from './components/Logo';
import SidebarNav from './components/Sidebar';
import { PAGES, PAGE_TITLES, ROUTE_ALIASES, canAccess, effectiveRole, homePath, landingPath } from './permissions';

function PageHeader() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'ClinicPilot';
  return (
    <div className="topheader">
      <h1>{title}</h1>
    </div>
  );
}

// Shown after a blocked URL sends someone back to the Hub.
function NoAccessToast() {
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (location.state && location.state.noAccess) {
      setVisible(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        background: 'var(--red)',
        color: 'white',
        padding: '10px 18px',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 600,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      No access — you don't have permission to open that page.
    </div>
  );
}

export default function App() {
  const { session, profile, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading ClinicPilot…</div>;
  }
  if (!session) return <Login />;
  if (!profile) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        Your account isn't set up in ClinicPilot yet. Ask the admin to add you to{' '}
        <code>staff_profiles</code>.
      </div>
    );
  }

  const isDoctor = effectiveRole(profile) === 'doctor';

  const closeNav = () => setMobileNavOpen(false);

  // Every page and what it renders. Access is decided in permissions.js —
  // a URL the user has no access to redirects to the Hub with a toast.
  const guardedRoutes = [
    { page: 'hub', element: <Hub profile={profile} /> },
    { page: 'today', element: <Today profile={profile} /> },
    { page: 'calendar', element: isDoctor ? <DoctorOwnCalendar profile={profile} /> : <DoctorCalendar /> },
    { page: 'appointments', element: <Appointments profile={profile} /> },
    { page: 'billing', element: <Billing profile={profile} userEmail={session.user.email} /> },
    { page: 'patients', element: isDoctor ? <DoctorPatients profile={profile} /> : <Patients userEmail={session.user.email} /> },
    { page: 'revenue', element: <DoctorRevenue profile={profile} /> },
    { page: 'expenses', element: <Expenses profile={profile} /> },
    { page: 'doctorCalculator', element: <DoctorCalculator profile={profile} /> },
    { page: 'backup', element: <Backup profile={profile} session={session} /> },
    { page: 'doctors', element: <ManageDoctors profile={profile} /> },
  ];

  return (
    <div className="app-shell">
      <div className={'sidebar' + (mobileNavOpen ? ' mobile-open' : '')}>
        <div className="sidebar-logo-chip">
          <Logo height={28} />
          <span className="sidebar-clinic-name">Yaseen Medical &amp; Diagnostic Centre</span>
        </div>
        <div className="sidebar-app-name">ClinicPilot</div>

        <SidebarNav profile={profile} onNavigate={closeNav} />

        <div className="sidebar-footer">
          <div className="sidebar-user">{profile.full_name}</div>
          <div className="sidebar-role">{effectiveRole(profile)}</div>
          <button className="sidebar-signout" onClick={() => supabase.auth.signOut()}>Sign Out</button>
        </div>
      </div>

      {mobileNavOpen && <div className="sidebar-overlay" onClick={closeNav} />}

      <div className="main-area">
        <div className="mobile-topbar">
          <Logo height={22} />
          <button className="hamburger-btn" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
        </div>
        <PageHeader />
        <div className="content">
          <NoAccessToast />
          <Routes>
            <Route path="/" element={<Navigate to={landingPath(profile)} replace />} />
            {Object.entries(ROUTE_ALIASES).map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={to} replace />} />
            ))}
            {guardedRoutes.map(({ page, element }) => (
              <Route
                key={page}
                path={PAGES[page].path}
                element={canAccess(profile, page) ? element : <Navigate to={homePath(profile)} replace state={{ noAccess: true }} />}
              />
            ))}
            <Route path="*" element={<Navigate to={landingPath(profile)} replace />} />
          </Routes>
        </div>
        <div className="app-footer">Made by Meesum Mir | CyberHealth Solutions</div>
      </div>
    </div>
  );
}
