import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function DoctorPatients({ profile }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const [form, setForm] = useState({ name: '', phone: '', gender: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function loadPatients() {
    setLoading(true);
    supabase
      .from('patients')
      .select('*')
      .order('name')
      .then(({ data, error: loadError }) => {
        if (loadError) console.error(loadError.message);
        setPatients(data || []);
        setLoading(false);
      });
  }

  useEffect(loadPatients, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.phone?.toLowerCase().includes(q)
    );
  }, [patients, search]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleAddPatient(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('patients').insert({
      name: form.name,
      phone: form.phone,
      gender: form.gender || null,
      created_by: profile.id,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm({ name: '', phone: '', gender: '' });
    loadPatients();
  }

  return (
    <div>
      <form className="card" onSubmit={handleAddPatient} style={{ borderTop: '4px solid var(--gold)' }}>
        <h3 style={{ marginTop: 0 }}>Add Patient</h3>
        {error && <div className="error-text">{error}</div>}
        <div className="filters-row" style={{ marginBottom: 0 }}>
          <div className="filter-field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="filter-field">
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
          </div>
          <div className="filter-field">
            <label>Gender</label>
            <select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 14 }}>
          {saving ? 'Saving…' : 'Add Patient'}
        </button>
      </form>

      <div className="card">
        <div className="filters-row" style={{ marginBottom: 0 }}>
          <div className="filter-field" style={{ minWidth: 260 }}>
            <label>Search</label>
            <input
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No patients yet.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Gender</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
                  <td>{p.name}</td>
                  <td>{p.phone || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.gender || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
            <div className="modal-field">
              <span className="label">Gender</span>
              <span className="value" style={{ textTransform: 'capitalize' }}>{selected.gender || 'Not recorded'}</span>
            </div>
            <div className="modal-field">
              <span className="label">Phone</span>
              <span className="value">{selected.phone || '—'}</span>
            </div>
            <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
