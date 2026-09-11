import Appointments from './Appointments';

export default function TodayAppointments({ profile }) {
  return (
    <div>
      <h2 style={{ color: 'var(--navy)', marginTop: 0 }}>Today's Appointments</h2>
      <Appointments profile={profile} forceToday />
    </div>
  );
}
