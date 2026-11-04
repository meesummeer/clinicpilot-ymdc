import { useRef, useState } from 'react';
import { buildBackup, uploadBackup, downloadBlob, formatBytes } from '../lib/cloudBackup';

// The "Backup Now" button and its progress/result. Never logs row contents
// and never keeps the access token. The page around it owns the last-backup
// line and history, and is told (onSaved) when a new backup lands.
export default function CloudBackupCard({ profile, session, onSaved }) {
  const isAdmin = profile?.role === 'admin';
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null); // { ok, message }
  const pending = useRef(null); // built-but-not-uploaded backup, for the download fallback
  const [hasPending, setHasPending] = useState(false);

  if (!isAdmin) return null;

  async function runBackup() {
    if (!isAdmin || running) return;
    setRunning(true);
    setResult(null);
    setHasPending(false);
    pending.current = null;
    try {
      const built = await buildBackup({
        profile,
        session,
        onProgress: ({ table, index, total, packing }) =>
          setProgress(packing ? 'Packing the backup file…' : `Backing up ${table}… ${index} of ${total}`),
      });
      pending.current = built;
      setProgress('Uploading to Cloudflare R2…');
      const saved = await uploadBackup(built);
      pending.current = null;
      setResult({ ok: true, message: `Saved to Cloudflare R2: ${saved.key} (${formatBytes(saved.size)})` });
      onSaved?.();
    } catch (err) {
      setResult({ ok: false, message: err.message });
      // A zip that was built but failed to upload can still be saved locally.
      setHasPending(Boolean(pending.current));
    } finally {
      setProgress('');
      setRunning(false);
    }
  }

  return (
    <div>
      <button className="btn-primary" onClick={runBackup} disabled={running}>
        {running ? 'Backing up…' : 'Backup Now'}
      </button>
      {running && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600 }}>{progress}</div>
          <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 4 }}>Please don't close this tab until it finishes.</div>
        </div>
      )}
      {result && (
        <div style={{ marginTop: 12 }}>
          {result.ok ? (
            <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{result.message}</div>
          ) : (
            <>
              <div className="error-text">Backup failed: {result.message}</div>
              {hasPending && (
                <button
                  className="btn-secondary"
                  onClick={() => downloadBlob(pending.current.blob, pending.current.fileName)}
                >
                  Download this backup to this computer instead
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
