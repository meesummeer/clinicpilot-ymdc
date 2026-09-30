import { createPortal } from 'react-dom';
import { formatDateDMY, paymentMethodLabel } from '../lib/formatters';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

export default function BillingReportView({ doctorName, dateFrom, dateTo, entries, paymentsByBillingId, onClose }) {
  const printRoot = document.getElementById('invoice-print-root');
  if (!printRoot) return null;

  function handlePrint() {
    window.print();
  }

  const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);

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
          {doctorName} · {formatDateDMY(dateFrom)} – {formatDateDMY(dateTo)}
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
            {entries.length === 0 ? (
              <tr><td colSpan={7}>No billing entries for this filter.</td></tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.invoice_ref || '—'}</td>
                  <td>{formatDateDMY(e.billing_date)}</td>
                  <td>{e.patient_name}</td>
                  <td>{e.doctors?.name || '—'}</td>
                  <td>{e.service || '—'}</td>
                  <td>{paymentMethodLabel(paymentsByBillingId?.[e.id])}</td>
                  <td>{formatPKR(e.amount)}</td>
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
