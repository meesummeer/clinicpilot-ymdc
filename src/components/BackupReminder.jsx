import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBackups } from '../lib/cloudBackup';

const DAY_MS = 24 * 60 * 60 * 1000;

// Admin-only amber nudge on Today: shown when the newest cloud backup is
// more than 24 hours old (or there is none). One list call per load; any
// failure is silent.
export default function BackupReminder({ profile }) {
  const isAdmin = profile?.role === 'admin';
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    listBackups()
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        const newest = list.length ? new Date(list[0].uploaded).getTime() : 0;
        setStale(Date.now() - newest > DAY_MS);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin || !stale) return null;
  return (
    <div
      style={{
        background: '#FFF4D6',
        border: '1px solid #E8B04B',
        color: '#7A5300',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        marginBottom: 14,
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      No cloud backup in the last 24 hours.{' '}
      <Link to="/backup" style={{ color: '#7A5300', textDecoration: 'underline' }}>Go to Backup</Link>
    </div>
  );
}
