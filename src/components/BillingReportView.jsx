import { createPortal } from 'react-dom';
import { formatDateDMY } from '../lib/formatters';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

// Exports exactly the rows currently on screen in All Entries (already
// narrowed by date range, doctor and payment method): each row's amount is the
// filtered amount, and the total at the bottom is the sum of those amounts, so
// it always matches the on-screen figures.
export default function BillingReportView({ doctorLabel, methodLabel, dateFrom, dateTo, rows, onClose }) {
  const printRoot = document.getElementById('invoice-print-root');
  if (!printRoot) return null;

  function handlePrint() {
    window.print();
  }

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

  return createPortal(
    <div className="invoice-overlay">
      <div className="invoice-toolbar no-print">
        <button className="btn-primary" onClick={handlePrint}>Print / Save PDF</button>
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>

      <div className="invoice-sheet">
        <div className="invoice-header">
          <div className="invoice-header-left">
            <img src={`${import.meta.env.BASE_URL}assets/yaseen-logo.png`} alt="" className="invoice-logo" />
            <div>
              <div className="invoice-clinic-name">Reception Yaseen Medical &amp; Diagnostic Centre</div>
              <div className="invoice-clinic-address">ZUDA Apartments, Near Mazar-e-Quaid, M. A. Jinnah Road, Karachi</div>
              <div className="invoice-clinic-phone">Ph: 021-34125544, 021-34935544 · Mobile: 0335-6733777</div>
            </div>
          </div>
          <div className="invoice-title">Billing Report</div>
        </div>

        <div className="invoice-report-date">
          {formatDateDMY(dateFrom)} to {formatDateDMY(dateTo)} | Doctor: {doctorLabel} | Method: {methodLabel}
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Ref No.</th>
              <th>Date</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Service</th>
              <th>Method</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7}>No billing entries for this filter.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.entry.id}>
                  <td>{r.entry.invoice_ref || '—'}</td>
                  <td>{formatDateDMY(r.entry.billing_date)}</td>
                  <td>{r.entry.patient_name}</td>
                  <td>{r.entry.doctors?.name || '—'}</td>
                  <td>{r.entry.service || '—'}</td>
                  <td>{r.methodLabel}</td>
                  <td>
                    {formatPKR(r.amount)}
                    {r.partial && (
                      <div style={{ fontSize: 10, color: '#666', fontWeight: 400 }}>
                        of {Number(r.invoiceAmount).toLocaleString('en-PK')} total (mixed)
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}><strong>Total</strong></td>
              <td><strong>{formatPKR(totalAmount)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>,
    printRoot
  );
}
