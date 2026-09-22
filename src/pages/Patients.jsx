import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateDMY } from '../lib/formatters';

function emptyEditForm() {
  return { name: '', phone: '', gender: '', age: '' };
}

export default function Patients({ userEmail }) {
  const canDelete = userEmail === 'meesummir@icloud.com';

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const [editingPatient, setEditingPatient] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm());
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  function loadPatients() {
    setLoading(true);
    supabase
      .from('patient_last_visit')
      .select('*')
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setPatients(data || []);
        setLoading(false);
      });
  }

  useEffect(loadPatients, []);

  const sorted = useMemo(() => {
    return [...patients].sort((a, b) => {
      if (!a.last_visit_date && !b.last_visit_date) return 0;
      if (!a.last_visit_date) return 1;
      if (!b.last_visit_date) return -1;
      return a.last_visit_date < b.last_visit_date ? 1 : -1;
    });
  }, [patients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.phone?.toLowerCase().includes(q)
    );
  }, [sorted, search]);

  function openEdit(patient) {
    setEditingPatient(patient);
    setEditForm({
      name: patient.name || '',
      phone: patient.phone || '',
      gender: patient.gender || '',
      age: patient.age != null ? String(patient.age) : '',
    });
    setEditError('');
  }

  function closeEdit() {
    setEditingPatient(null);
    setEditForm(emptyEditForm());
    setEditError('');
  }

  function updateEditForm(field, value) {
    setEditForm((f) => ({ ...f, [field]: value }));
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSaving(true);
    setEditError('');

    const payload = {
      name: editForm.name,
      phone: editForm.phone,
      gender: editForm.gender || null,
      age: editForm.age ? parseInt(editForm.age, 10) : null,
    };

    const { error: updateError } = await supabase
      .from('patients')
      .update(payload)
      .eq('id', editingPatient.id);

    setEditSaving(false);
    if (updateError) {
      setEditError(updateError.message);
      return;
    }
    closeEdit();
    loadPatients();
  }

  async function handleDelete(patient) {
    if (!window.confirm("Delete this patient record? This can't be undone.")) return;
    const { error: deleteError } = await supabase.from('patients').delete().eq('id', patient.id);
    if (deleteError) {
      alert(deleteError.message);
      return;
    }
    loadPatients();
  }

  return (
    <div>
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

      {editingPatient && canDelete && (
        <form className="card" onSubmit={handleEditSubmit} style={{ borderTop: '4px solid var(--gold)' }}>
          <h3 style={{ marginTop: 0 }}>Edit Patient</h3>
          {editError && <div className="error-text">{editError}</div>}
          <div className="filters-row">
            <div className="filter-field">
              <label>Name</label>
              <input value={editForm.name} onChange={(e) => updateEditForm('name', e.target.value)} required />
            </div>
            <div className="filter-field">
              <label>Phone</label>
              <input value={editForm.phone} onChange={(e) => updateEditForm('phone', e.target.value)} required />
            </div>
            <div className="filter-field">
              <label>Gender</label>
              <select value={editForm.gender} onChange={(e) => updateEditForm('gender', e.target.value)}>
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="filter-field">
              <label>Age</label>
              <input
                type="number"
                min="0"
                value={editForm.age}
                onChange={(e) => updateEditForm('age', e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={editSaving} style={{ marginRight: 8 }}>
            {editSaving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" className="btn-secondary" onClick={closeEdit}>Cancel</button>
        </form>
      )}

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No patients yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Phone</th><th>Age</th><th>Last Visit</th><th>Last Procedure</th>
                {canDelete && <th></th>}
                {canDelete && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
                  <td>{p.name}</td>
                  <td>{p.phone || '—'}</td>
                  <td>{p.age != null ? p.age : '—'}</td>
                  <td>{p.last_visit_date ? formatDateDMY(p.last_visit_date) : '—'}</td>
                  <td>{p.last_procedure || '—'}</td>
                  {canDelete && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn-secondary" onClick={() => openEdit(p)}>Edit</button>
                    </td>
                  )}
                  {canDelete && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn-danger-outline" onClick={() => handleDelete(p)}>Delete</button>
                    </td>
                  )}
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
              <span className="value">{selected.gender || 'Not recorded'}</span>
            </div>
            <div className="modal-field">
              <span className="label">Phone</span>
              <span className="value">{selected.phone || '—'}</span>
            </div>
            <div className="modal-field">
              <span className="label">Age</span>
              <span className="value">{selected.age != null ? selected.age : '—'}</span>
            </div>
            <div className="modal-field">
              <span className="label">Last Visit</span>
              <span className="value">{selected.last_visit_date ? formatDateDMY(selected.last_visit_date) : '—'}</span>
            </div>
            <div className="modal-field">
              <span className="label">Last Procedure</span>
              <span className="value">{selected.last_procedure || '—'}</span>
            </div>
            <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
