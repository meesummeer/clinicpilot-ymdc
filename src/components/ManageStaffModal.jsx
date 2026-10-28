import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Admin-only roster editor for the Salary expense "Staff Member" dropdown.
// Staff are never deleted — deactivating just hides them from the dropdown,
// so old salary entries (which store the name as text) are unaffected.
export default function ManageStaffModal({ staff, onClose, onChanged }) {
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const sorted = [...staff].sort(
    (a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  function draftFor(s) {
    return drafts[s.id] !== undefined ? drafts[s.id] : s.default_base_salary != null ? String(s.default_base_salary) : '';
  }

  function isDirty(s) {
    return draftFor(s) !== (s.default_base_salary != null ? String(s.default_base_salary) : '');
  }

  async function applyUpdate(s, changes) {
    setBusyId(s.id);
    setError('');
    const { error: updateError } = await supabase.from('staff_members').update(changes).eq('id', s.id);
    setBusyId(null);
    if (updateError) {
      setError(`Couldn't update ${s.name}: ${updateError.message}`);
      return false;
    }
    await onChanged();
    return true;
  }

  async function saveSalary(s) {
    const raw = draftFor(s).trim();
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setError(`Default base salary for ${s.name} must be a number of 0 or more.`);
      return;
    }
    if (await applyUpdate(s, { default_base_salary: value })) {
      setDrafts((d) => {
        const { [s.id]: _removed, ...rest } = d;
        return rest;
      });
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ width: 640, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Manage staff</h3>
        <p style={{ fontSize: 13, color: 'var(--grey-text)', marginTop: 0 }}>
          Deactivated staff disappear from the Staff Member dropdown but stay on their old salary entries and reports.
        </p>
        {error && <div className="error-text">{error}</div>}
        {sorted.length === 0 ? (
          <div className="empty-state">No staff yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Default base salary (PKR)</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} style={s.is_active ? undefined : { opacity: 0.6 }}>
                  <td>{s.name}</td>
                  <td>{s.role || '—'}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      style={{ width: 110 }}
                      aria-label={`Default base salary for ${s.name}`}
                      placeholder="None"
                      value={draftFor(s)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                    />
                    {isDirty(s) && (
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ marginLeft: 6 }}
                        disabled={busyId === s.id}
                        onClick={() => saveSalary(s)}
                      >
                        Save
                      </button>
                    )}
                  </td>
                  <td>{s.is_active ? 'Active' : 'Inactive'}</td>
                  <td>
                    {s.is_active ? (
                      <button
                        type="button"
                        className="btn-danger-outline"
                        disabled={busyId === s.id}
                        onClick={() => applyUpdate(s, { is_active: false })}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busyId === s.id}
                        onClick={() => applyUpdate(s, { is_active: true })}
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
