import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import { formatDateDMY } from '../lib/formatters';

const PAYMENT_METHOD_LABEL = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  insurance: 'Insurance',
  other: 'Other',
};

export default function InvoiceView({ entry, onClose, autoPrint }) {
  const [payments, setPayments] = useState(null); // null = not yet loaded

  useEffect(() => {
    if (!entry?.id) return;
    setPayments(null);
    supabase
      .from('billing_payments')
      .select('*')
      .eq('billing_id', entry.id)
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setPayments(data || []);
      });
  }, [entry?.id]);

  useEffect(() => {
    if (entry && autoPrint && payments !== null) {
      window.print();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, autoPrint, payments]);

  if (!entry) return null;

  const printRoot = document.getElementById('invoice-print-root');
  if (!printRoot) return null;

  function handlePrint() {
    window.print();
  }

  const paymentList = payments || [];

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
          <div className="invoice-title">Cash Receipt</div>
        </div>

        <div className="invoice-meta-row">
          <div><strong>Ref. No.</strong> {entry.invoice_ref || '—'}</div>
          <div><strong>Date</strong> {formatDateDMY(entry.billing_date)}</div>
        </div>

        <div className="invoice-meta-row">
          <div><strong>Patient's Name:</strong> {entry.patient_name}</div>
          <div>
            {entry.patient_age ? `Age ${entry.patient_age}` : ''}
            {entry.patient_phone ? `${entry.patient_age ? '  ·  ' : ''}${entry.patient_phone}` : ''}
          </div>
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

        {paymentList.length > 0 && (
          <div className="invoice-meta-row" style={{ borderBottom: 'none' }}>
            <div>
              <strong>{paymentList.length > 1 ? 'Payment Methods:' : 'Payment Method:'}</strong>{' '}
              {paymentList.length > 1
                ? paymentList
                    .map((p) => `${PAYMENT_METHOD_LABEL[p.payment_method] || p.payment_method} Rs${Number(p.amount).toFixed(2)}`)
                    .join('  ·  ')
                : (PAYMENT_METHOD_LABEL[paymentList[0].payment_method] || paymentList[0].payment_method)}
            </div>
          </div>
        )}
      </div>
    </div>,
    printRoot
  );
}
