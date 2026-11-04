import { Component, useCallback, useEffect, useState } from 'react';
import CloudBackupCard from '../components/CloudBackupCard';
import { listBackups, formatKarachi, formatBytes } from '../lib/cloudBackup';

const DAY_MS = 24 * 60 * 60 * 1000;

// A failure inside the page must never white-screen the app.
class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return <div className="card"><div className="error-text">This page failed to load. Reload to try again.</div></div>;
    }
    return this.props.children;
  }
}

function fileName(key) {
  return key.split('/').pop();
}

// Settings → Backup: Backup Now, the last backup, a 24-hour warning, and
// the last 10 backups. The history comes from the backup bucket (via the
// backup Worker), so it lists every backup that reached storage.
function BackupInner({ profile, session }) {
  const [backups, setBackups] = useState(null); // null = loading
  const [listFailed, setListFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await listBackups();
      setBackups(Array.isArray(list) ? list : []);
      setListFailed(false);
    } catch {
      setListFailed(true);
      setBackups((b) => b ?? []);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const last = backups && backups.length ? backups[0] : null;
  const stale = backups !== null && !listFailed && (!last || Date.now() - new Date(last.uploaded).getTime() > DAY_MS);

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>Backup</h3>
          {stale && (
            <span
              style={{ background: 'var(--red)', color: 'white', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}
            >
              {last ? 'Last backup is more than 24 hours old' : 'No backup yet'}
            </span>
          )}
        </div>
        <p style={{ margin: '0 0 14px', color: 'var(--grey-text)', fontSize: 14 }}>
          {backups === null
            ? 'Checking last backup…'
            : listFailed
            ? "Couldn't check the last backup"
            : last
            ? `Last backup: ${formatKarachi(last.uploaded)} · Success · ${formatBytes(last.size)}`
            : 'Last backup: none yet'}
        </p>
        <CloudBackupCard profile={profile} session={session} onSaved={refresh} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent backups</h3>
        {backups === null ? (
          <p>Loading…</p>
        ) : backups.length === 0 ? (
          <div className="empty-state">{listFailed ? "Couldn't load the backup history." : 'No backups yet.'}</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Date &amp; time</th><th>Status</th><th>Size</th><th>File</th></tr></thead>
            <tbody>
              {backups.slice(0, 10).map((b) => (
                <tr key={b.key}>
                  <td>{formatKarachi(b.uploaded)}</td>
                  <td>Success</td>
                  <td>{formatBytes(b.size)}</td>
                  <td style={{ fontSize: 12 }}>{fileName(b.key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function Backup(props) {
  return (
    <Boundary>
      <BackupInner {...props} />
    </Boundary>
  );
}
