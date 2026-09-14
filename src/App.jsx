import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
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
import Logo from './components/Logo';

const PAGE_TITLES = {
  '/today': "Today's Appointments",
  '/appointments': 'Appointments',
  '/calendar': 'Doctor Calendar',
  '/billing': 'Billing',
  '/patients': 'Patients',
  '/doctors': 'Manage Doctors',
  '/hub': 'Hub',
};

function PageHeader() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'ClinicPilot';
  return (
    <div className="topheader">
      <h1>{title}</h1>
    </div>
  );
}

export default function App() {
  const { session, profile, loading } = useAuth();

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

  const isCeo = profile.role === 'ceo';
  const isAdmin = profile.role === 'admin';

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="sidebar-logo-chip">
          <Logo height={28} />
          <span className="sidebar-clinic-name">Yaseen Medical &amp; Diagnostic Centre</span>
        </div>
        <div className="sidebar-app-name">ClinicPilot</div>

        {!isCeo && (
          <nav className="sidebar-nav">
            {isAdmin && (
              <NavLink to="/hub" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
                <span className="icon-dot" /> Hub
              </NavLink>
            )}
            <NavLink to="/today" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              <span className="icon-dot" /> Today
            </NavLink>
            <NavLink to="/appointments" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              <span className="icon-dot" /> Appointments
            </NavLink>
            <NavLink to="/calendar" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              <span className="icon-dot" /> Calendar
            </NavLink>
            <NavLink to="/billing" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              <span className="icon-dot" /> Billing
            </NavLink>
            <NavLink to="/patients" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              <span className="icon-dot" /> Patients
            </NavLink>
            {isAdmin && (
              <NavLink to="/doctors" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
                <span className="icon-dot" /> Manage Doctors
              </NavLink>
            )}
          </nav>
        )}
        {isCeo && (
          <nav className="sidebar-nav">
            <NavLink to="/hub" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              <span className="icon-dot" /> Hub
            </NavLink>
          </nav>
        )}

        <div className="sidebar-footer">
          <div className="sidebar-user">{profile.full_name}</div>
          <div className="sidebar-role">{profile.role}</div>
          <button className="sidebar-signout" onClick={() => supabase.auth.signOut()}>Sign Out</button>
        </div>
      </div>

      <div className="main-area">
        <PageHeader />
        <div className="content">
          <Routes>
            {isCeo ? (
              <>
                <Route path="/" element={<Navigate to="/hub" replace />} />
                <Route path="/hub" element={<Hub profile={profile} />} />
                <Route path="*" element={<Navigate to="/hub" replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Navigate to="/today" replace />} />
                <Route path="/today" element={<Today />} />
                <Route path="/appointments" element={<Appointments profile={profile} />} />
                <Route path="/calendar" element={<DoctorCalendar />} />
                <Route path="/billing" element={<Billing profile={profile} userEmail={session.user.email} />} />
                <Route path="/patients" element={<Patients />} />
                {isAdmin && <Route path="/doctors" element={<ManageDoctors />} />}
                {isAdmin && <Route path="/hub" element={<Hub profile={profile} />} />}
                <Route path="*" element={<Navigate to="/today" replace />} />
              </>
            )}
          </Routes>
        </div>
        <div className="app-footer">Made by Meesum Mir | CyberHealth Solutions</div>
      </div>
    </div>
  );
}
