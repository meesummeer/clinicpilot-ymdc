import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, fetchAllRows } from '../lib/supabaseClient';
import BillingForm from '../components/BillingForm';
import InvoiceView from '../components/InvoiceView';
import DailyReportView from '../components/DailyReportView';
import BillingReportView from '../components/BillingReportView';
import { formatDateDMY } from '../lib/formatters';
import { METHOD_FILTER_OPTIONS, buildVisibleRows, summarizeRows } from '../lib/billingMethodFilter';
import { paymentMethodLabel } from '../constants/paymentMethods';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

// Muted note under an amount that is only part of an invoice, shown when a
// payment-method filter hides some of that invoice's other legs.
function PartialNote({ row }) {
  if (!row.partial) return null;
  return (
    <div style={{ fontSize: 11, color: 'var(--grey-text)' }}>
      of {Number(row.invoiceAmount).toLocaleString('en-PK')} total (mixed)
    </div>
  );
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
  const [showBillingReport, setShowBillingReport] = useState(false);
  const [payments, setPayments] = useState([]);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  // All page-level filters live here, above both By Date and All Entries, so
  // they persist across both and drive every view (tiles, By Date, All
  // Entries, the daily report and the PDF export) together. Date range and
  // doctor narrow the queries below; the method filter is applied over the
  // fully-paginated result via buildVisibleRows.
  const [filterDoctor, setFilterDoctor] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
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

  // The real, authoritative payment method(s) for an invoice live in its
  // billing_payments rows (one per leg), grouped here by invoice. billing.
  // payment_method is only a fallback for an invoice with no rows at all.
  const paymentsByBillingId = useMemo(() => {
    const map = {};
    payments.forEach((p) => {
      if (!map[p.billing_id]) map[p.billing_id] = [];
      map[p.billing_id].push(p);
    });
    return map;
  }, [payments]);

  // One filtered view of the data (date range + doctor from the queries,
  // payment method from here) that EVERYTHING below reads from — tiles, By
  // Date, All Entries, the daily report, and the PDF — so they can never
  // disagree. Under a method filter each row carries only the matching
  // legs' amount; with no filter it's the full invoice amount, and an
  // invoice is never dropped for lacking billing_payments rows.
  const visibleRows = useMemo(
    () => buildVisibleRows(entries, paymentsByBillingId, methodFilter),
    [entries, paymentsByBillingId, methodFilter]
  );

  const summary = useMemo(() => summarizeRows(visibleRows), [visibleRows]);

  // All Entries additionally honours its own Doctor dropdown (as before),
  // on top of the page-level filters.
  const allEntriesRows = useMemo(
    () => (allEntriesDoctorFilter === 'all' ? visibleRows : visibleRows.filter((r) => r.entry.doctor_id === allEntriesDoctorFilter)),
    [visibleRows, allEntriesDoctorFilter]
  );

  const reportRows = useMemo(
    () => (reportDate ? visibleRows.filter((r) => r.entry.billing_date === reportDate) : []),
    [reportDate, visibleRows]
  );

  // Per date: transaction count and total, both from the same visible rows
  // (so under a method filter they count only matching invoices and sum only
  // the matching legs).
  const byDate = useMemo(() => {
    const map = {};
    visibleRows.forEach((r) => {
      const date = r.entry.billing_date;
      if (!map[date]) map[date] = { total: 0, count: 0 };
      map[date].total += r.amount;
      map[date].count += 1;
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [visibleRows]);

  const methodFilterLabel = methodFilter === 'all' ? 'All' : METHOD_FILTER_OPTIONS.find((o) => o.value === methodFilter)?.label || methodFilter;
  // The doctor shown in the PDF header: the All Entries dropdown if it's set,
  // otherwise the page-level Doctor filter.
  const reportDoctorId = allEntriesDoctorFilter !== 'all' ? allEntriesDoctorFilter : filterDoctor;
  const reportDoctorLabel = reportDoctorId === 'all' ? 'All' : doctors.find((d) => d.id === reportDoctorId)?.name || 'All';

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
          <div className="filter-field">
            <label>Payment Method</label>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="all">All Methods</option>
              {METHOD_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {canEdit && (
            <button
              className="btn-primary filters-row-end"
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

      <div className="summary-tiles summary-tiles-fit">
        <div className="summary-tile">
          <div className="label">Total Billed</div>
          <div className="value">{formatPKR(summary.total)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Cash</div>
          <div className="value">{formatPKR(summary.cash)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Bank Account</div>
          <div className="value">{formatPKR(summary.bank)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">{paymentMethodLabel('gia_international')}</div>
          <div className="value">{formatPKR(summary.gia_international)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">{paymentMethodLabel('habib_insurance')}</div>
          <div className="value">{formatPKR(summary.habib_insurance)}</div>
        </div>
        {/* Legacy 'other' payments aren't offered for new entries, but old rows
            can still carry them. Show the tile only when there's money in it,
            so the tiles always add up to Total Billed without adding clutter. */}
        {Math.abs(summary.other) > 0.005 && (
          <div className="summary-tile">
            <div className="label">{paymentMethodLabel('other')}</div>
            <div className="value">{formatPKR(summary.other)}</div>
          </div>
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
          <button className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setShowBillingReport(true)}>
            Export as PDF
          </button>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : allEntriesRows.length === 0 ? (
          <div className="empty-state">No billing entries for this filter.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Ref No.</th><th>Date</th><th>Patient</th><th>Doctor</th><th>Service</th><th>Method</th><th>Amount</th><th></th>{canEditEntry && <th></th>}{canDelete && <th></th>}</tr>
            </thead>
            <tbody>
              {allEntriesRows.map((row) => {
                const e = row.entry;
                return (
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
                  <td>{row.methodLabel}</td>
                  <td>
                    {formatPKR(row.amount)}
                    <PartialNote row={row} />
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
                );
              })}
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
          rows={reportRows}
          methodLabel={methodFilterLabel}
          onClose={() => setReportDate(null)}
        />
      )}
      {showBillingReport && (
        <BillingReportView
          doctorLabel={reportDoctorLabel}
          methodLabel={methodFilterLabel}
          dateFrom={dateFrom}
          dateTo={dateTo}
          rows={allEntriesRows}
          onClose={() => setShowBillingReport(false)}
        />
      )}
    </div>
  );
}
