import { createPortal } from 'react-dom';
import { formatDateDMY } from '../lib/formatters';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

// `rows` are Billing's filtered rows for this date (see buildVisibleRows): each
// row's amount is already the amount matching the active payment-method filter
// (the full invoice amount when no filter is active). Balance Due is a
// whole-invoice figure, so it stays based on the invoice itself.
export default function DailyReportView({ date, rows, methodLabel, onClose }) {
  if (!date) return null;

  const printRoot = document.getElementById('invoice-print-root');
  if (!printRoot) return null;

  function handlePrint() {
    window.print();
  }

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalBalance = rows.reduce((s, r) => {
    const e = r.entry;
    const balance = e.billed_amount && e.billed_amount > e.amount ? e.billed_amount - e.amount : 0;
    return s + balance;
  }, 0);

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
          <div className="invoice-title">Daily Report</div>
        </div>

        <div className="invoice-report-date">
          {formatDateDMY(date)}
          {methodLabel && methodLabel !== 'All' ? ` | Method: ${methodLabel}` : ''}
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Service</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Balance Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6}>No billing entries for this date.</td></tr>
            ) : (
              rows.map((r) => {
                const e = r.entry;
                const hasBalance = e.billed_amount && e.billed_amount > e.amount;
                return (
                  <tr key={e.id}>
                    <td>{e.patient_name}</td>
                    <td>{e.doctors?.name || '—'}</td>
                    <td>{e.service || '—'}</td>
                    <td>{r.methodLabel}</td>
                    <td>
                      {formatPKR(r.amount)}
                      {r.partial && (
                        <div style={{ fontSize: 10, color: '#666', fontWeight: 400 }}>
                          of {Number(r.invoiceAmount).toLocaleString('en-PK')} total (mixed)
                        </div>
                      )}
                    </td>
                    <td>{hasBalance ? formatPKR(e.billed_amount - e.amount) : '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}><strong>Total</strong></td>
              <td><strong>{formatPKR(totalAmount)}</strong></td>
              <td><strong>{totalBalance > 0 ? formatPKR(totalBalance) : '—'}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>,
    printRoot
  );
}
