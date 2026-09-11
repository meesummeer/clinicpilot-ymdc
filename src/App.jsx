import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { supabase } from './lib/supabaseClient';
import Login from './pages/Login';
import Appointments from './pages/Appointments';
import Today from './pages/Today';
import DoctorCalendar from './pages/DoctorCalendar';
import Billing from './pages/Billing';
import ManageDoctors from './pages/ManageDoctors';
import CeoSummary from './pages/CeoSummary';
import Logo from './components/Logo';

export default function App() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading ClinicPilot…</div>;
  }

  if (!session) {
    return <Login />;
  }

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
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo height={32} />
          <h1>ClinicPilot — YMDC</h1>
        </div>
        <div className="user-info">
          <span>{profile.full_name} · {profile.role.toUpperCase()}</span>
          <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
        </div>
      </div>

      {!isCeo && (
        <div className="nav-tabs">
          <NavLink to="/today" className={({ isActive }) => (isActive ? 'active' : '')}>Today</NavLink>
          <NavLink to="/appointments" className={({ isActive }) => (isActive ? 'active' : '')}>Appointments</NavLink>
          <NavLink to="/calendar" className={({ isActive }) => (isActive ? 'active' : '')}>Calendar</NavLink>
          <NavLink to="/billing" className={({ isActive }) => (isActive ? 'active' : '')}>Billing</NavLink>
          {isAdmin && (
            <NavLink to="/doctors" className={({ isActive }) => (isActive ? 'active' : '')}>Manage Doctors</NavLink>
          )}
        </div>
      )}

      <div className="content">
        <Routes>
          {isCeo ? (
            <>
              <Route path="/" element={<CeoSummary />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Navigate to="/today" replace />} />
              <Route path="/today" element={<Today />} />
              <Route path="/appointments" element={<Appointments profile={profile} />} />
              <Route path="/calendar" element={<DoctorCalendar />} />
              <Route path="/billing" element={<Billing profile={profile} />} />
              {isAdmin && <Route path="/doctors" element={<ManageDoctors />} />}
              <Route path="*" element={<Navigate to="/today" replace />} />
            </>
          )}
        </Routes>
      </div>

      <div className="app-footer">Made by Meesum Mir | CyberHealth Solutions</div>
    </div>
  );
}
