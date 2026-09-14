import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import BillingForm from '../components/BillingForm';
import InvoiceView from '../components/InvoiceView';
import DailyReportView from '../components/DailyReportView';
import { formatDateDMY } from '../lib/formatters';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

export default function Billing({ profile, userEmail }) {
  const [doctors, setDoctors] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [invoiceEntry, setInvoiceEntry] = useState(null);
  const [reportDate, setReportDate] = useState(null);
  const [allEntriesDoctorFilter, setAllEntriesDoctorFilter] = useState('all');

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
  const canEditEntry = profile?.role === 'admin';
  const canDelete = userEmail === 'meesummir@icloud.com';

  function handleEditEntry(entry) {
    setEditingEntry(entry);
    setShowForm(true);
  }

  async function handleDeleteEntry(entry) {
    if (!window.confirm(`Delete this billing entry for ${entry.patient_name} (${entry.invoice_ref || 'no ref'})? This can't be undone.`)) return;
    const { error } = await supabase.from('billing').delete().eq('id', entry.id);
    if (error) {
      alert(error.message);
      return;
    }
    loadEntries();
  }

  const totalAmount = useMemo(() => entries.reduce((s, e) => s + Number(e.amount), 0), [entries]);

  const cashTotal = useMemo(
    () => entries.filter((e) => e.payment_method === 'cash').reduce((s, e) => s + Number(e.amount), 0),
    [entries]
  );

  const bankTotal = useMemo(
    () => entries.filter((e) => e.payment_method === 'card' || e.payment_method === 'bank_transfer').reduce((s, e) => s + Number(e.amount), 0),
    [entries]
  );

  const reportEntries = useMemo(
    () => (reportDate ? entries.filter((e) => e.billing_date === reportDate) : []),
    [reportDate, entries]
  );

  const allEntriesFiltered = useMemo(
    () => (allEntriesDoctorFilter === 'all' ? entries : entries.filter((e) => e.doctor_id === allEntriesDoctorFilter)),
    [entries, allEntriesDoctorFilter]
  );

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
            <button
              className="btn-primary"
              onClick={() => {
                if (showForm) {
                  setShowForm(false);
                  setEditingEntry(null);
                } else {
                  setEditingEntry(null);
                  setShowForm(true);
                }
              }}
            >
              {showForm ? 'Close' : '+ New Billing Entry'}
            </button>
          )}
        </div>
      </div>

      {showForm && canEdit && (!editingEntry || canEditEntry) && (
        <BillingForm
          doctors={doctors}
          profileId={profile.id}
          entry={editingEntry}
          onCancel={() => {
            setShowForm(false);
            setEditingEntry(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingEntry(null);
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
          <div className="label">Cash</div>
          <div className="value">{formatPKR(cashTotal)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Bank Account</div>
          <div className="value">{formatPKR(bankTotal)}</div>
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
            <thead><tr><th></th><th>Date</th><th>Transactions</th><th>Total</th></tr></thead>
            <tbody>
              {byDate.map(([date, d]) => (
                <tr key={date}>
                  <td>
                    <button className="btn-secondary" onClick={() => setReportDate(date)}>View</button>
                  </td>
                  <td>{formatDateDMY(date)}</td>
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
        <div className="filters-row">
          <div className="filter-field">
            <label>Doctor</label>
            <select value={allEntriesDoctorFilter} onChange={(e) => setAllEntriesDoctorFilter(e.target.value)}>
              <option value="all">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : allEntriesFiltered.length === 0 ? (
          <div className="empty-state">No billing entries for this filter.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Patient</th><th>Doctor</th><th>Service</th><th>Method</th><th>Amount</th><th></th>{canEditEntry && <th></th>}{canDelete && <th></th>}</tr>
            </thead>
            <tbody>
              {allEntriesFiltered.map((e) => (
                <tr key={e.id}>
                  <td>{formatDateDMY(e.billing_date)}</td>
                  <td>{e.patient_name}</td>
                  <td>
                    <span className="doctor-dot" style={{ background: e.doctors?.color_hex || '#ccc' }} />
                    {e.doctors?.name}
                  </td>
                  <td>{e.service || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{e.payment_method?.replace('_', ' ')}</td>
                  <td>
                    {formatPKR(e.amount)}
                    {e.billed_amount && e.billed_amount > e.amount && (
                      <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>
                        Balance: {formatPKR(e.billed_amount - e.amount)}
                      </div>
                    )}
                  </td>
                  <td>
                    <button className="btn-secondary" onClick={() => setInvoiceEntry(e)}>Invoice</button>
                  </td>
                  {canEditEntry && (
                    <td>
                      <button className="btn-secondary" onClick={() => handleEditEntry(e)}>Edit</button>
                    </td>
                  )}
                  {canDelete && (
                    <td>
                      <button className="btn-danger-outline" onClick={() => handleDeleteEntry(e)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {invoiceEntry && <InvoiceView entry={invoiceEntry} onClose={() => setInvoiceEntry(null)} />}
      {reportDate && <DailyReportView date={reportDate} entries={reportEntries} onClose={() => setReportDate(null)} />}
    </div>
  );
}
