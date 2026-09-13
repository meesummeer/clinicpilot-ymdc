import { formatDateDMY } from '../lib/formatters';

export default function InvoiceView({ entry, onClose }) {
  if (!entry) return null;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="invoice-overlay">
      <div className="invoice-toolbar no-print">
        <button className="btn-primary" onClick={handlePrint}>Print / Save PDF</button>
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>

      <div className="invoice-sheet">
        <div className="invoice-header">
          <img src={`${import.meta.env.BASE_URL}assets/yaseen-logo.png`} alt="" className="invoice-logo" />
          <div>
            <h2>Cash Receipt</h2>
          </div>
        </div>

        <div className="invoice-clinic-block">
          <strong>Reception Yaseen Medical &amp; Diagnostic Centre</strong>
          <div>ZUDA Apartments, Near Mazar-e-Quaid, M. A. Jinnah Road, Karachi</div>
          <div>Ph: 021-34125544, 021-34935544 · Mobile: 0335-6733777</div>
        </div>

        <div className="invoice-meta-row">
          <div><strong>Ref. No.</strong> {entry.invoice_ref || '—'}</div>
          <div><strong>Date</strong> {formatDateDMY(entry.billing_date)}</div>
        </div>

        <div className="invoice-meta-row">
          <div><strong>Patient's Name:</strong> {entry.patient_name}</div>
          <div>{entry.patient_age ? `Age ${entry.patient_age}` : ''}</div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr><th>S. No.</th><th>Description</th><th>Class</th><th>Amount</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>{entry.service || 'Consultation Charges'}{entry.doctors?.name ? ` (${entry.doctors.name})` : ''}</td>
              <td>{entry.doctors?.name?.replace('Dr. ', '').split(' ')[0] || ''}</td>
              <td>{Number(entry.amount).toFixed(2)}</td>
            </tr>
          </tbody>
          <tfoot>
            {entry.billed_amount && entry.billed_amount > entry.amount ? (
              <>
                <tr><td colSpan={3}>Total Bill</td><td>Rs{Number(entry.billed_amount).toFixed(2)}</td></tr>
                <tr><td colSpan={3}>Amount Paid</td><td>Rs{Number(entry.amount).toFixed(2)}</td></tr>
                <tr><td colSpan={3}><strong>Balance Due</strong></td><td><strong>Rs{Number(entry.billed_amount - entry.amount).toFixed(2)}</strong></td></tr>
              </>
            ) : (
              <tr><td colSpan={3}><strong>Total</strong></td><td><strong>Rs{Number(entry.amount).toFixed(2)}</strong></td></tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
