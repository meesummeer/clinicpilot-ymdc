import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const DAY_OPTIONS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 7, label: 'Sun' },
];

export default function ManageDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    supabase.from('doctors').select('*').order('name').then(({ data }) => setDoctors(data || []));
  }
  useEffect(load, []);

  function startEdit(d) {
    setEditId(d.id);
    setDraft({ ...d, working_days: d.working_days || [] });
  }

  function toggleDay(day) {
    setDraft((d) => ({
      ...d,
      working_days: d.working_days.includes(day)
        ? d.working_days.filter((x) => x !== day)
        : [...d.working_days, day].sort(),
    }));
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('doctors')
      .update({
        name: draft.name,
        specialty: draft.specialty,
        color_hex: draft.color_hex,
        working_days: draft.working_days,
        start_time: draft.start_time,
        end_time: draft.end_time,
        active: draft.active,
      })
      .eq('id', editId);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setEditId(null);
    load();
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0, color: 'var(--navy)' }}>Manage Doctors</h2>
      <table className="data-table">
        <thead>
          <tr><th>Doctor</th><th>Specialty</th><th>Color</th><th>Schedule</th><th>Active</th><th></th></tr>
        </thead>
        <tbody>
          {doctors.map((d) => (
            editId === d.id ? (
              <tr key={d.id}>
                <td><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
                <td><input value={draft.specialty || ''} onChange={(e) => setDraft({ ...draft, specialty: e.target.value })} /></td>
                <td><input type="color" value={draft.color_hex} onChange={(e) => setDraft({ ...draft, color_hex: e.target.value })} /></td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {DAY_OPTIONS.map((opt) => (
                      <label key={opt.value} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <input
                          type="checkbox"
                          checked={draft.working_days.includes(opt.value)}
                          onChange={() => toggleDay(opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <input type="time" value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} style={{ marginRight: 4 }} />
                  <input type="time" value={draft.end_time} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} />
                </td>
                <td>
                  <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                </td>
                <td>
                  <button className="btn-primary" onClick={save} disabled={saving} style={{ marginRight: 6 }}>Save</button>
                  <button className="btn-secondary" onClick={() => setEditId(null)}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={d.id}>
                <td><span className="doctor-dot" style={{ background: d.color_hex }} />{d.name}</td>
                <td>{d.specialty}</td>
                <td><span className="doctor-dot" style={{ background: d.color_hex }} /></td>
                <td style={{ fontSize: 12 }}>
                  {(d.working_days || []).map((n) => DAY_OPTIONS.find((o) => o.value === n)?.label).join(', ')}
                  <br />{d.start_time?.slice(0,5)} – {d.end_time?.slice(0,5)}
                </td>
                <td>{d.active ? 'Yes' : 'No'}</td>
                <td><button className="btn-secondary" onClick={() => startEdit(d)}>Edit</button></td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
}
