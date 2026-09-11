import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import BillingForm from '../components/BillingForm';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

export default function Billing({ profile }) {
  const [doctors, setDoctors] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  const [filterDoctor, setFilterDoctor] = useState('all');
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  useEffect(() => {
    supabase.from('doctors').select('*').eq('active', true).order('name').then(({ data }) => {
      setDoctors(data || []);
    });
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('billing')
      .select('*, doctors(name, color_hex)')
      .gte('billing_date', dateFrom)
      .lte('billing_date', dateTo)
      .order('billing_date', { ascending: false });

    if (filterDoctor !== 'all') query = query.eq('doctor_id', filterDoctor);

    const { data, error } = await query;
    if (error) console.error(error.message);
    setEntries(data || []);
    setLoading(false);
  }, [filterDoctor, dateFrom, dateTo]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const canEdit = profile?.role === 'admin' || profile?.role === 'csr';

  const totalAmount = useMemo(() => entries.reduce((s, e) => s + Number(e.amount), 0), [entries]);

  const byDoctor = useMemo(() => {
    const map = {};
    entries.forEach((e) => {
      const key = e.doctors?.name || 'Unknown';
      if (!map[key]) map[key] = { total: 0, count: 0, color: e.doctors?.color_hex || '#ccc' };
      map[key].total += Number(e.amount);
      map[key].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [entries]);

  const byDate = useMemo(() => {
    const map = {};
    entries.forEach((e) => {
      if (!map[e.billing_date]) map[e.billing_date] = { total: 0, count: 0 };
      map[e.billing_date].total += Number(e.amount);
      map[e.billing_date].count += 1;
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  return (
    <div>
      <div className="card">
        <div className="filters-row">
          <div className="filter-field">
            <label>From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-field">
            <label>To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="filter-field">
            <label>Doctor</label>
            <select value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)}>
              <option value="all">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          {canEdit && (
            <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
              {showForm ? 'Close' : '+ New Billing Entry'}
            </button>
          )}
        </div>
      </div>

      {showForm && canEdit && (
        <BillingForm
          doctors={doctors}
          profileId={profile.id}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            loadEntries();
          }}
        />
      )}

      <div className="summary-tiles">
        <div className="summary-tile">
          <div className="label">Total Billed</div>
          <div className="value">{formatPKR(totalAmount)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Transactions</div>
          <div className="value">{entries.length}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Doctors Billed</div>
          <div className="value">{byDoctor.length}</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>By Doctor</h3>
        {byDoctor.length === 0 ? (
          <div className="empty-state">No data for this range.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Doctor</th><th>Transactions</th><th>Total</th></tr></thead>
            <tbody>
              {byDoctor.map(([name, d]) => (
                <tr key={name}>
                  <td><span className="doctor-dot" style={{ background: d.color }} />{name}</td>
                  <td>{d.count}</td>
                  <td>{formatPKR(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>By Date</h3>
        {byDate.length === 0 ? (
          <div className="empty-state">No data for this range.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Transactions</th><th>Total</th></tr></thead>
            <tbody>
              {byDate.map(([date, d]) => (
                <tr key={date}>
                  <td>{date}</td>
                  <td>{d.count}</td>
                  <td>{formatPKR(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>All Entries</h3>
        {loading ? (
          <p>Loading…</p>
        ) : entries.length === 0 ? (
          <div className="empty-state">No billing entries for this filter.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Patient</th><th>Doctor</th><th>Method</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.billing_date}</td>
                  <td>{e.patient_name}</td>
                  <td>
                    <span className="doctor-dot" style={{ background: e.doctors?.color_hex || '#ccc' }} />
                    {e.doctors?.name}
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{e.payment_method?.replace('_', ' ')}</td>
                  <td>{formatPKR(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
