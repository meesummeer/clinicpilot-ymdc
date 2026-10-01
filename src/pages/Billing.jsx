import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, fetchAllRows } from '../lib/supabaseClient';
import BillingForm from '../components/BillingForm';
import InvoiceView from '../components/InvoiceView';
import DailyReportView from '../components/DailyReportView';
import BillingReportView from '../components/BillingReportView';
import { formatDateDMY, paymentMethodKey, paymentMethodLabel } from '../lib/formatters';

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
  const [invoiceAutoPrint, setInvoiceAutoPrint] = useState(false);
  const [reportDate, setReportDate] = useState(null);
  const [allEntriesDoctorFilter, setAllEntriesDoctorFilter] = useState('all');
  const [allEntriesMethodFilter, setAllEntriesMethodFilter] = useState('all');
  const [showBillingReport, setShowBillingReport] = useState(false);
  const [payments, setPayments] = useState([]);

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

    // Both queries below use fetchAllRows to page past PostgREST's default
    // 1000-row cap — a busy month easily exceeds that, and past it the
    // plain query silently truncates with no error (that's what caused
    // Method showing "—" for most rows and the payment-method tiles being
    // wildly undercounted). billing_date ties get id as a secondary sort
    // so .range() pagination has a fully deterministic order to page over.
    const [{ data, error }, { data: paymentRows, error: paymentsError }] = await Promise.all([
      fetchAllRows(() => {
        let q = supabase
          .from('billing')
          .select('*, doctors(name, color_hex)')
          .gte('billing_date', dateFrom)
          .lte('billing_date', dateTo)
          .order('billing_date', { ascending: false })
          .order('id', { ascending: true });
        if (filterDoctor !== 'all') q = q.eq('doctor_id', filterDoctor);
        return q;
      }),
      // Filter billing_payments server-side via a join on the date range
      // (and doctor, when set) instead of fetching billing IDs first and
      // passing them as a giant .in() list — that list gets long enough with
      // a wide date range to exceed the URL length limit and 400 the request.
      fetchAllRows(() => {
        let q = supabase
          .from('billing_payments')
          .select('*, billing!inner(billing_date, doctor_id)')
          .gte('billing.billing_date', dateFrom)
          .lte('billing.billing_date', dateTo)
          .order('id', { ascending: true });
        if (filterDoctor !== 'all') q = q.eq('billing.doctor_id', filterDoctor);
        return q;
      }),
    ]);
    if (error) console.error(error.message);
    if (paymentsError) console.error(paymentsError.message);

    setEntries(data || []);
    setPayments(paymentRows || []);
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

  // Total Billed always counts every billing row once, from billing.amount
  // — same source the PDF export already uses — so an invoice is never
  // silently dropped just because it has no billing_payments rows (that's
  // exactly what happened to 26-10163: zero payment rows meant it
  // contributed nothing to any tile even though the row itself was fine).
  const totalAmount = useMemo(
    () => entries.reduce((s, e) => s + Number(e.amount), 0),
    [entries]
  );

  // The real, authoritative payment method(s) for an invoice live only in
  // its billing_payments rows, never in billing.payment_method — grouping
  // them here lets the Method column, the filter, and the tiles below all
  // derive the same effective method (a single method, or "mixed" for a
  // split invoice) from the same source, so the filter never returns a
  // row whose displayed Method doesn't match what was selected.
  const paymentsByBillingId = useMemo(() => {
    const map = {};
    payments.forEach((p) => {
      if (!map[p.billing_id]) map[p.billing_id] = [];
      map[p.billing_id].push(p);
    });
    return map;
  }, [payments]);

  // Cash/Bank/Insurance split each invoice across its real billing_payments
  // rows when it has any (so a split invoice still attributes correctly to
  // each method it actually used) — but billing_payments only supplements
  // that breakdown, it never gates inclusion: an invoice with zero payment
  // rows still counts in full, under its own billing.payment_method.
  const paymentBreakdown = useMemo(() => {
    const totals = { cash: 0, bank: 0, insurance: 0 };
    function addTo(method, amount) {
      if (method === 'cash') totals.cash += amount;
      else if (method === 'card' || method === 'bank_transfer') totals.bank += amount;
      else if (method === 'insurance') totals.insurance += amount;
    }
    entries.forEach((e) => {
      const entryPayments = paymentsByBillingId[e.id];
      if (entryPayments && entryPayments.length > 0) {
        entryPayments.forEach((p) => addTo(p.payment_method, Number(p.amount)));
      } else {
        addTo(e.payment_method, Number(e.amount));
      }
    });
    return totals;
  }, [entries, paymentsByBillingId]);
  const cashTotal = paymentBreakdown.cash;
  const bankTotal = paymentBreakdown.bank;
  const insuranceTotal = paymentBreakdown.insurance;

  const reportEntries = useMemo(
    () => (reportDate ? entries.filter((e) => e.billing_date === reportDate) : []),
    [reportDate, entries]
  );

  const allEntriesFiltered = useMemo(() => {
    let filtered = allEntriesDoctorFilter === 'all' ? entries : entries.filter((e) => e.doctor_id === allEntriesDoctorFilter);
    if (allEntriesMethodFilter !== 'all') {
      filtered = filtered.filter((e) => paymentMethodKey(paymentsByBillingId[e.id]) === allEntriesMethodFilter);
    }
    return filtered;
  }, [entries, allEntriesDoctorFilter, allEntriesMethodFilter, paymentsByBillingId]);

  // Count and total both come from entries (the billing table) and its own
  // amount field — a single consistent source, rather than pairing entries
  // (for count) with a separately-fetched billing_payments join (for
  // total), which can disagree if the two queries' results aren't
  // perfectly in sync for a given date.
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
          onSavedAndPrint={(savedEntry) => {
            setShowForm(false);
            setEditingEntry(null);
            loadEntries();
            setInvoiceAutoPrint(true);
            setInvoiceEntry(savedEntry);
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
        <div className="summary-tile">
          <div className="label">Insurance</div>
          <div className="value">{formatPKR(insuranceTotal)}</div>
        </div>
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
          <div className="filter-field">
            <label>Payment Method</label>
            <select value={allEntriesMethodFilter} onChange={(e) => setAllEntriesMethodFilter(e.target.value)}>
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="insurance">Insurance</option>
            </select>
          </div>
          <button className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setShowBillingReport(true)}>
            Export as PDF
          </button>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : allEntriesFiltered.length === 0 ? (
          <div className="empty-state">No billing entries for this filter.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Ref No.</th><th>Date</th><th>Patient</th><th>Doctor</th><th>Service</th><th>Method</th><th>Amount</th><th></th>{canEditEntry && <th></th>}{canDelete && <th></th>}</tr>
            </thead>
            <tbody>
              {allEntriesFiltered.map((e) => (
                <tr key={e.id}>
                  <td>{e.invoice_ref || '—'}</td>
                  <td>{formatDateDMY(e.billing_date)}</td>
                  <td>
                    {e.patient_name}
                    {e.patient_phone && (
                      <div style={{ fontSize: 11, color: 'var(--grey-text)' }}>{e.patient_phone}</div>
                    )}
                  </td>
                  <td>
                    <span className="doctor-dot" style={{ background: e.doctors?.color_hex || '#ccc' }} />
                    {e.doctors?.name}
                  </td>
                  <td>{e.service || '—'}</td>
                  <td>{paymentMethodLabel(paymentsByBillingId[e.id])}</td>
                  <td>
                    {formatPKR(e.amount)}
                    {e.billed_amount && e.billed_amount > e.amount && (
                      <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>
                        Balance: {formatPKR(e.billed_amount - e.amount)}
                      </div>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setInvoiceAutoPrint(false);
                        setInvoiceEntry(e);
                      }}
                    >
                      Invoice
                    </button>
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

      {invoiceEntry && (
        <InvoiceView
          entry={invoiceEntry}
          autoPrint={invoiceAutoPrint}
          onClose={() => {
            setInvoiceEntry(null);
            setInvoiceAutoPrint(false);
          }}
        />
      )}
      {reportDate && (
        <DailyReportView
          date={reportDate}
          entries={reportEntries}
          paymentsByBillingId={paymentsByBillingId}
          onClose={() => setReportDate(null)}
        />
      )}
      {showBillingReport && (
        <BillingReportView
          doctorName={allEntriesDoctorFilter === 'all' ? 'All Doctors' : doctors.find((d) => d.id === allEntriesDoctorFilter)?.name}
          dateFrom={dateFrom}
          dateTo={dateTo}
          entries={allEntriesFiltered}
          paymentsByBillingId={paymentsByBillingId}
          onClose={() => setShowBillingReport(false)}
        />
      )}
    </div>
  );
}
