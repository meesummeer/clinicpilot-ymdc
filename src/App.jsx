import { useState } from 'react';
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
import Expenses from './pages/Expenses';
import DoctorOwnCalendar from './pages/DoctorOwnCalendar';
import DoctorRevenue from './pages/DoctorRevenue';
import DoctorPatients from './pages/DoctorPatients';
import Logo from './components/Logo';

const PAGE_TITLES = {
  '/today': "Today's Appointments",
  '/appointments': 'Appointments',
  '/calendar': 'Doctor Calendar',
  '/billing': 'Billing',
  '/patients': 'Patients',
  '/doctors': 'Manage Doctors',
  '/hub': 'Hub',
  '/revenue': 'Revenue',
  '/expenses': 'Expenses',
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

  const isCeo = profile.role === 'ceo';
  const isAdmin = profile.role === 'admin';
  const isDoctor = profile.role === 'doctor';
  const hasExpensesAccess = profile.has_expenses_access === true;

  const linkClass = ({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '');
  const closeNav = () => setMobileNavOpen(false);

  return (
    <div className="app-shell">
      <div className={'sidebar' + (mobileNavOpen ? ' mobile-open' : '')}>
        <div className="sidebar-logo-chip">
          <Logo height={28} />
          <span className="sidebar-clinic-name">Yaseen Medical &amp; Diagnostic Centre</span>
        </div>
        <div className="sidebar-app-name">ClinicPilot</div>

        {!isCeo && !isDoctor && (
          <nav className="sidebar-nav">
            {isAdmin && (
              <NavLink to="/hub" className={linkClass} onClick={closeNav}>
                <span className="icon-dot" /> Hub
              </NavLink>
            )}
            <NavLink to="/today" className={linkClass} onClick={closeNav}>
              <span className="icon-dot" /> Today
            </NavLink>
            <NavLink to="/appointments" className={linkClass} onClick={closeNav}>
              <span className="icon-dot" /> Appointments
            </NavLink>
            <NavLink to="/calendar" className={linkClass} onClick={closeNav}>
              <span className="icon-dot" /> Calendar
            </NavLink>
            <NavLink to="/billing" className={linkClass} onClick={closeNav}>
              <span className="icon-dot" /> Billing
            </NavLink>
            <NavLink to="/patients" className={linkClass} onClick={closeNav}>
              <span className="icon-dot" /> Patients
            </NavLink>
            {hasExpensesAccess && (
              <NavLink to="/expenses" className={linkClass} onClick={closeNav}>
                <span className="icon-dot" /> Expenses
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/doctors" className={linkClass} onClick={closeNav}>
                <span className="icon-dot" /> Manage Doctors
              </NavLink>
            )}
          </nav>
        )}
        {isCeo && (
          <nav className="sidebar-nav">
            <NavLink to="/hub" className={linkClass} onClick={closeNav}>
              <span className="icon-dot" /> Hub
            </NavLink>
            {hasExpensesAccess && (
              <NavLink to="/expenses" className={linkClass} onClick={closeNav}>
                <span className="icon-dot" /> Expenses
              </NavLink>
            )}
          </nav>
        )}
        {isDoctor && (
          <nav className="sidebar-nav">
            <NavLink to="/calendar" className={linkClass} onClick={closeNav}>
              <span className="icon-dot" /> Calendar
            </NavLink>
            <NavLink to="/revenue" className={linkClass} onClick={closeNav}>
              <span className="icon-dot" /> Revenue
            </NavLink>
            <NavLink to="/patients" className={linkClass} onClick={closeNav}>
              <span className="icon-dot" /> Patients
            </NavLink>
          </nav>
        )}

        <div className="sidebar-footer">
          <div className="sidebar-user">{profile.full_name}</div>
          <div className="sidebar-role">{profile.role}</div>
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
          <Routes>
            {isCeo ? (
              <>
                <Route path="/" element={<Navigate to="/hub" replace />} />
                <Route path="/hub" element={<Hub profile={profile} />} />
                {hasExpensesAccess && <Route path="/expenses" element={<Expenses profile={profile} />} />}
                <Route path="*" element={<Navigate to="/hub" replace />} />
              </>
            ) : isDoctor ? (
              <>
                <Route path="/" element={<Navigate to="/calendar" replace />} />
                <Route path="/calendar" element={<DoctorOwnCalendar profile={profile} />} />
                <Route path="/revenue" element={<DoctorRevenue profile={profile} />} />
                <Route path="/patients" element={<DoctorPatients profile={profile} />} />
                <Route path="*" element={<Navigate to="/calendar" replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Navigate to="/today" replace />} />
                <Route path="/today" element={<Today />} />
                <Route path="/appointments" element={<Appointments profile={profile} />} />
                <Route path="/calendar" element={<DoctorCalendar />} />
                <Route path="/billing" element={<Billing profile={profile} userEmail={session.user.email} />} />
                <Route path="/patients" element={<Patients />} />
                {hasExpensesAccess && <Route path="/expenses" element={<Expenses profile={profile} />} />}
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
