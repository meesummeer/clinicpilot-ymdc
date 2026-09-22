import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateDMY } from '../lib/formatters';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    supabase
      .from('patient_last_visit')
      .select('*')
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setPatients(data || []);
        setLoading(false);
      });
  }, []);

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

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No patients yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Age</th><th>Last Visit</th><th>Last Procedure</th></tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
                  <td>{p.name}</td>
                  <td>{p.phone || '—'}</td>
                  <td>{p.last_age != null ? p.last_age : '—'}</td>
                  <td>{p.last_visit_date ? formatDateDMY(p.last_visit_date) : '—'}</td>
                  <td>{p.last_procedure || '—'}</td>
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
              <span className="value">{selected.last_age != null ? selected.last_age : '—'}</span>
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
