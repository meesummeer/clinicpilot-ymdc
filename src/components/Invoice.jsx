import { formatDateDMY } from '../lib/dateUtils';

// Short "Class" name YMDC uses on receipts (first name only, matching the reference).
function shortName(doctorName) {
  if (!doctorName) return '';
  const parts = doctorName.replace(/^Dr\.?\s*/i, '').split(' ');
  return parts[0] || doctorName;
}

export default function Invoice({ entry, onClose }) {
  function handlePrint() {
    window.print();
  }

  return (
    <div className="invoice-overlay">
      <div className="invoice-toolbar no-print">
        <button className="btn-primary" onClick={handlePrint}>Print / Save as PDF</button>
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>

      <div className="invoice-sheet">
        <div className="invoice-header">
          <img src="/logo.png" alt="Yaseen Medical" className="invoice-logo" />
          <div className="invoice-header-text">
            <div className="invoice-clinic-name">Reception Yaseen Medical &amp; Diagnostic Centre</div>
            <div className="invoice-address">
              ZUDA Apartments, Near Mazar-e-Quaid, M. A. Jinnah Road, Karachi
            </div>
            <div className="invoice-contact">
              Ph: 021-34125544, 021-34935544 &nbsp; Mobile: 0335-6733777
            </div>
          </div>
        </div>

        <div className="invoice-title">Cash Receipt</div>

        <div className="invoice-meta-row">
          <div className="invoice-meta-box">
            <span>Ref. No.</span>
            <strong>{entry.invoice_no || '—'}</strong>
          </div>
          <div className="invoice-meta-box">
            <span>Date</span>
            <strong>{formatDateDMY(entry.billing_date)}</strong>
          </div>
        </div>

        <div className="invoice-patient-row">
          <div className="invoice-patient-box">
            <span>Patient's Name:</span>
            <strong>
              {entry.patient_name}
              {entry.patient_age ? ` — Age ${entry.patient_age}` : ''}
            </strong>
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>S. No.</th>
              <th>Description</th>
              <th>Class</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>{entry.service || 'Consultation Charges'} ({entry.doctors?.name})</td>
              <td>{shortName(entry.doctors?.name)}</td>
              <td>{Number(entry.amount).toFixed(2)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3" style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
              <td style={{ fontWeight: 700 }}>Rs{Number(entry.amount).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
