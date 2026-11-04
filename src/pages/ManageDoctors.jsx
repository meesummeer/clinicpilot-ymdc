import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatKarachi } from '../lib/cloudBackup';

const DAY_OPTIONS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 7, label: 'Sun' },
];

// Brand-friendly picks for the doctor's calendar colour (no teal/green).
const COLOR_PALETTE = [
  '#1A0A6E', '#2D1B8E', '#B22222', '#D64545', '#C9A227', '#92400E',
  '#D97706', '#DB2777', '#7C3AED', '#0EA5E9', '#64748B', '#57534E',
];
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// doctors.split_percentage is YMDC's (the centre's) share; the doctor's
// share is 100 minus it (that is how the DRC and Hub show "Doctor's share").
// The form edits the doctor's share, so these two convert at the boundary.
const round2 = (n) => Math.round(n * 100) / 100;
const doctorShareOf = (splitPercentage) => round2(100 - Number(splitPercentage ?? 30));

function dayLabels(days) {
  return (days || []).map((n) => DAY_OPTIONS.find((o) => o.value === n)?.label).filter(Boolean).join(', ');
}

function hhmm(t) {
  return (t || '').slice(0, 5);
}

// Human text for one audit-log row.
function describeChange(row) {
  if (row.field === 'split_percentage') {
    const o = round2(Number(row.old_value));
    const n = round2(Number(row.new_value));
    return `Split: YMDC ${o}% → ${n}% (doctor ${round2(100 - o)}% → ${round2(100 - n)}%)`;
  }
  if (row.field === 'keeps_material_cost') {
    return `YMDC keeps material cost: ${row.old_value ?? '—'} → ${row.new_value ?? '—'}`;
  }
  return `${row.field}: ${row.old_value ?? '—'} → ${row.new_value ?? '—'}`;
}

function DoctorEditModal({ doctor, profile, onClose, onSaved, notify }) {
  const isService = doctor.is_service_category === true;
  const [draft, setDraft] = useState({
    name: doctor.name || '',
    specialty: doctor.specialty || '',
    color_hex: doctor.color_hex || '#1A0A6E',
    working_days: doctor.working_days || [],
    start_time: doctor.start_time || '',
    end_time: doctor.end_time || '',
    active: doctor.active === true,
    doctorShare: String(doctorShareOf(doctor.split_percentage)),
    keepsMaterialCost: doctor.keeps_material_cost === true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState({ rows: [], names: {}, unavailable: false });

  const loadHistory = useCallback(async () => {
    const { data, error: historyError } = await supabase
      .from('doctor_change_log')
      .select('*')
      .eq('doctor_id', doctor.id)
      .order('changed_at', { ascending: false })
      .limit(5);
    if (historyError) {
      setHistory({ rows: [], names: {}, unavailable: true });
      return;
    }
    const ids = [...new Set((data || []).map((r) => r.changed_by).filter(Boolean))];
    const names = {};
    if (ids.length) {
      const { data: people } = await supabase.from('staff_profiles').select('id, full_name').in('id', ids);
      (people || []).forEach((p) => {
        names[p.id] = p.full_name;
      });
    }
    setHistory({ rows: data || [], names, unavailable: false });
  }, [doctor.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function set(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function toggleDay(day) {
    setDraft((d) => ({
      ...d,
      working_days: d.working_days.includes(day) ? d.working_days.filter((x) => x !== day) : [...d.working_days, day].sort(),
    }));
  }

  // ── Split field ──
  const shareNumber = draft.doctorShare.trim() === '' ? NaN : Number(draft.doctorShare);
  const shareValid =
    Number.isFinite(shareNumber) && shareNumber >= 0 && shareNumber <= 100 && Math.abs(shareNumber * 100 - Math.round(shareNumber * 100)) < 1e-6;
  const ymdcShareReadout = shareValid ? round2(100 - shareNumber) : null;
  const newSplitPercentage = shareValid ? round2(100 - shareNumber) : null; // stored value (YMDC share)
  const oldSplitPercentage = round2(Number(doctor.split_percentage ?? 30));
  const splitChanged = shareValid && newSplitPercentage !== oldSplitPercentage;
  const colorValid = HEX_RE.test(draft.color_hex);
  // Aesthetic doctors: YMDC buys the material and keeps the cost charged back
  // through the DRC's "+ Add Cost" entries. Not applicable to service entries.
  const keepsChanged = !isService && draft.keepsMaterialCost !== (doctor.keeps_material_cost === true);
  const needsConfirm = splitChanged || keepsChanged;

  // What actually changed, as { column: { old, new, oldText, newText } }.
  function collectChanges() {
    const changes = {};
    const add = (column, oldV, newV, oldText = oldV, newText = newV) => {
      changes[column] = { old: oldV, new: newV, oldText: oldText == null ? null : String(oldText), newText: newText == null ? null : String(newText) };
    };
    if (draft.name.trim() !== (doctor.name || '')) add('name', doctor.name, draft.name.trim());
    if (draft.specialty !== (doctor.specialty || '')) add('specialty', doctor.specialty || '', draft.specialty);
    if (draft.color_hex.toLowerCase() !== (doctor.color_hex || '').toLowerCase()) add('color_hex', doctor.color_hex, draft.color_hex);
    const oldDays = (doctor.working_days || []).join(',');
    if (draft.working_days.join(',') !== oldDays) add('working_days', doctor.working_days || [], draft.working_days, dayLabels(doctor.working_days), dayLabels(draft.working_days));
    if (hhmm(draft.start_time) !== hhmm(doctor.start_time)) add('start_time', doctor.start_time, draft.start_time, hhmm(doctor.start_time), hhmm(draft.start_time));
    if (hhmm(draft.end_time) !== hhmm(doctor.end_time)) add('end_time', doctor.end_time, draft.end_time, hhmm(doctor.end_time), hhmm(draft.end_time));
    if (draft.active !== (doctor.active === true)) add('active', doctor.active === true, draft.active, doctor.active ? 'Yes' : 'No', draft.active ? 'Yes' : 'No');
    if (splitChanged) add('split_percentage', oldSplitPercentage, newSplitPercentage);
    if (keepsChanged) add('keeps_material_cost', doctor.keeps_material_cost === true, draft.keepsMaterialCost, doctor.keeps_material_cost ? 'Yes' : 'No', draft.keepsMaterialCost ? 'Yes' : 'No');
    return changes;
  }

  function validate() {
    if (!draft.name.trim()) return 'Name is required.';
    if (!colorValid) return 'Colour must be a hex value like #1A0A6E.';
    if (!shareValid) return `${isService ? 'Service split' : 'Doctor share'} must be a number from 0 to 100 (up to 2 decimals).`;
    if (draft.working_days.length === 0) return 'Pick at least one working day.';
    return '';
  }

  function onSaveClick(e) {
    e.preventDefault();
    const problem = validate();
    setError(problem);
    if (problem) return;
    if (Object.keys(collectChanges()).length === 0) {
      onClose();
      return;
    }
    if (needsConfirm) {
      setConfirming(true);
      return;
    }
    doSave();
  }

  async function doSave() {
    setSaving(true);
    setError('');
    const changes = collectChanges();
    const columns = Object.keys(changes);
    // Split and material-cost changes rewrite past numbers, so they must
    // never go unlogged.
    const hasSplit = columns.includes('split_percentage') || columns.includes('keeps_material_cost');

    // A financial change must never go unlogged: make sure the audit table is
    // there and readable before touching the doctor row.
    if (hasSplit) {
      const { error: probeError } = await supabase.from('doctor_change_log').select('id').limit(1);
      if (probeError) {
        setSaving(false);
        setConfirming(false);
        setError(`The audit log isn't set up yet (${probeError.message}). Run the doctor_change_log SQL first, then try again. Nothing was changed.`);
        return;
      }
    }

    const payload = {};
    columns.forEach((c) => {
      payload[c] = changes[c].new;
    });
    const { error: updateError } = await supabase.from('doctors').update(payload).eq('id', doctor.id);
    if (updateError) {
      setSaving(false);
      setConfirming(false);
      setError(updateError.message);
      return;
    }

    const logRows = columns.map((c) => ({
      doctor_id: doctor.id,
      field: c,
      old_value: changes[c].oldText,
      new_value: changes[c].newText,
      changed_by: profile.id,
    }));
    const { error: logError } = await supabase.from('doctor_change_log').insert(logRows);
    setSaving(false);
    if (logError && hasSplit) {
      notify('error', `Saved, but the audit log entry failed: ${logError.message}`);
    } else {
      notify('success', hasSplit ? 'Saved. Change logged.' : 'Doctor saved.');
    }
    await onSaved();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ width: 600, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          <span className="doctor-dot" style={{ background: colorValid ? draft.color_hex : '#ccc' }} />
          Edit {doctor.name}
        </h3>

        <form onSubmit={onSaveClick}>
          {error && <div className="error-text">{error}</div>}

          <div className="filters-row">
            <div className="filter-field" style={{ flex: 1 }}>
              <label>Name</label>
              <input value={draft.name} onChange={(e) => set('name', e.target.value)} style={{ width: '100%' }} />
            </div>
            <div className="filter-field" style={{ flex: 1 }}>
              <label>Specialty</label>
              <input value={draft.specialty} onChange={(e) => set('specialty', e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          <div className="filter-field" style={{ marginBottom: 14 }}>
            <label>Colour</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => set('color_hex', c)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: c,
                    cursor: 'pointer',
                    padding: 0,
                    border: draft.color_hex.toLowerCase() === c.toLowerCase() ? '3px solid #1E2130' : '2px solid white',
                    boxShadow: '0 0 0 1px #C8CCDA',
                  }}
                />
              ))}
              <input
                aria-label="Colour hex"
                value={draft.color_hex}
                onChange={(e) => set('color_hex', e.target.value)}
                style={{ width: 92, borderColor: colorValid ? undefined : 'var(--red)' }}
                maxLength={7}
              />
              <span className="doctor-dot" style={{ background: colorValid ? draft.color_hex : '#ccc', width: 20, height: 20 }} />
            </div>
          </div>

          <div className="filter-field" style={{ marginBottom: 14 }}>
            <label>Working days</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
              {DAY_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={draft.working_days.includes(opt.value)} onChange={() => toggleDay(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="time" aria-label="Start time" value={draft.start_time} onChange={(e) => set('start_time', e.target.value)} />
              <span>to</span>
              <input type="time" aria-label="End time" value={draft.end_time} onChange={(e) => set('end_time', e.target.value)} />
            </div>
          </div>

          <div className="filters-row">
            <div className="filter-field">
              <label>Active</label>
              <select value={draft.active ? 'yes' : 'no'} onChange={(e) => set('active', e.target.value === 'yes')}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="filter-field">
              <label>{isService ? 'Service split' : 'Doctor share %'}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  aria-label={isService ? 'Service split' : 'Doctor share percent'}
                  value={draft.doctorShare}
                  onChange={(e) => set('doctorShare', e.target.value)}
                  style={{ width: 110, borderColor: shareValid ? undefined : 'var(--red)' }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                  YMDC share: {ymdcShareReadout === null ? '—' : `${ymdcShareReadout}%`}
                </span>
              </div>
            </div>
          </div>

          {!isService && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={draft.keepsMaterialCost}
                  onChange={(e) => set('keepsMaterialCost', e.target.checked)}
                />
                YMDC keeps material cost (aesthetic)
              </label>
              <div style={{ fontSize: 12, color: 'var(--grey-text)', marginTop: 4, marginLeft: 26 }}>
                YMDC buys the material and charges it back through this doctor's costs, so the cost is kept by YMDC instead of being paid out to the doctor.
              </div>
            </div>
          )}

          {confirming && (
            <div style={{ border: '2px solid var(--red)', borderRadius: 10, padding: 14, margin: '4px 0 14px', background: '#FDF2F2' }}>
              <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>
                {splitChanged && keepsChanged ? 'Change the split and material-cost handling?' : splitChanged ? 'Change the split?' : 'Change material-cost handling?'}
              </div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                Numbers are calculated live, not stored. This will change this entry's numbers for ALL past invoices and reports, including closed months. Continue?
              </div>
              {splitChanged && (
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                  {doctor.name}: doctor {round2(100 - oldSplitPercentage)}% / YMDC {oldSplitPercentage}% → doctor {round2(100 - newSplitPercentage)}% / YMDC {newSplitPercentage}%
                </div>
              )}
              {keepsChanged && (
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                  {draft.keepsMaterialCost
                    ? `${doctor.name}: material cost will be KEPT by YMDC (added to YMDC's income, not paid to the doctor)`
                    : `${doctor.name}: material cost will be PASSED THROUGH to the doctor again (payout = share + cost)`}
                </div>
              )}
              <div style={{ marginBottom: 4 }} />
              <button type="button" className="btn-primary" disabled={saving} onClick={doSave} style={{ marginRight: 8 }}>
                {saving ? 'Saving…' : 'Yes, apply to all past numbers'}
              </button>
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          )}

          {!confirming && (
            <div>
              <button type="submit" className="btn-primary" disabled={saving} style={{ marginRight: 8 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          )}
        </form>

        <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border-grey)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--grey-text)', marginBottom: 8 }}>
            Last 5 changes
          </div>
          {history.unavailable ? (
            <div style={{ fontSize: 13, color: 'var(--grey-text)' }}>The change log isn't set up yet.</div>
          ) : history.rows.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--grey-text)' }}>No logged changes yet.</div>
          ) : (
            history.rows.map((row) => (
              <div key={row.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border-grey)' }}>
                <div style={{ fontWeight: 600 }}>{describeChange(row)}</div>
                <div style={{ color: 'var(--grey-text)', fontSize: 12 }}>
                  {formatKarachi(row.changed_at)} · {history.names[row.changed_by] || 'Unknown'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function ManageDoctors({ profile }) {
  const [doctors, setDoctors] = useState([]);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null); // { kind: 'success' | 'error', message }

  const load = useCallback(async () => {
    const { data } = await supabase.from('doctors').select('*').order('name');
    setDoctors(data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0, color: 'var(--navy)' }}>Manage Doctors</h2>
      <table className="data-table">
        <thead>
          <tr><th>Doctor</th><th>Specialty</th><th>Color</th><th>Schedule</th><th>Active</th><th></th></tr>
        </thead>
        <tbody>
          {doctors.map((d) => (
            <tr key={d.id}>
              <td><span className="doctor-dot" style={{ background: d.color_hex }} />{d.name}</td>
              <td>{d.specialty}</td>
              <td><span className="doctor-dot" style={{ background: d.color_hex }} /></td>
              <td style={{ fontSize: 12 }}>
                {dayLabels(d.working_days)}
                <br />{hhmm(d.start_time)} – {hhmm(d.end_time)}
              </td>
              <td>{d.active ? 'Yes' : 'No'}</td>
              <td><button className="btn-secondary" onClick={() => setEditing(d)}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <DoctorEditModal
          doctor={editing}
          profile={profile}
          onClose={() => setEditing(null)}
          onSaved={load}
          notify={(kind, message) => setToast({ kind, message })}
        />
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2100,
            background: toast.kind === 'error' ? 'var(--red)' : 'var(--navy)',
            color: 'white',
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
