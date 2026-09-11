import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { supabase } from './lib/supabaseClient';
import Login from './pages/Login';
import Appointments from './pages/Appointments';
import Billing from './pages/Billing';
import CeoSummary from './pages/CeoSummary';

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

  return (
    <div className="app-shell">
      <div className="topbar">
        <h1>ClinicPilot — YMDC</h1>
        <div className="user-info">
          <span>{profile.full_name} · {profile.role.toUpperCase()}</span>
          <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
        </div>
      </div>

      {!isCeo && (
        <div className="nav-tabs">
          <NavLink to="/appointments" className={({ isActive }) => (isActive ? 'active' : '')}>
            Appointments
          </NavLink>
          <NavLink to="/billing" className={({ isActive }) => (isActive ? 'active' : '')}>
            Billing
          </NavLink>
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
              <Route path="/" element={<Navigate to="/appointments" replace />} />
              <Route path="/appointments" element={<Appointments profile={profile} />} />
              <Route path="/billing" element={<Billing profile={profile} />} />
              <Route path="*" element={<Navigate to="/appointments" replace />} />
            </>
          )}
        </Routes>
      </div>
    </div>
  );
}
