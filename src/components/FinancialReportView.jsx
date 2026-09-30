import { createPortal } from 'react-dom';
import { formatDateDMY } from '../lib/formatters';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

export default function FinancialReportView({
  dateFrom,
  dateTo,
  preparedBy,
  incomeRows,
  totalIncome,
  expenseRows,
  totalExpense,
  netIncome,
  onClose,
}) {
  const printRoot = document.getElementById('invoice-print-root');
  if (!printRoot) return null;

  function handlePrint() {
    window.print();
  }

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
          <div className="invoice-title">Profit &amp; Loss Report</div>
        </div>

        <div className="invoice-report-date">
          {formatDateDMY(dateFrom)} – {formatDateDMY(dateTo)}
        </div>
        <div className="invoice-meta-row" style={{ marginTop: -8 }}>
          <div>Prepared by: {preparedBy}</div>
        </div>

        <h4 style={{ color: 'var(--navy)', marginBottom: 6 }}>Income</h4>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Gross Revenue</th>
              <th>Material/Lab Cost</th>
              <th>YMDC's Share</th>
            </tr>
          </thead>
          <tbody>
            {incomeRows.length === 0 ? (
              <tr><td colSpan={4}>No income for this range.</td></tr>
            ) : (
              incomeRows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{formatPKR(r.gross)}</td>
                  <td>{formatPKR(r.cost)}</td>
                  <td>{formatPKR(r.ymdcShare)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}><strong>Total Income</strong></td>
              <td><strong>{formatPKR(totalIncome)}</strong></td>
            </tr>
          </tfoot>
        </table>

        <h4 style={{ color: 'var(--navy)', marginBottom: 6, marginTop: 24 }}>Expense</h4>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenseRows.length === 0 ? (
              <tr><td colSpan={2}>No expenses for this range.</td></tr>
            ) : (
              expenseRows.map((r) => (
                <tr key={r.category}>
                  <td>{r.label}</td>
                  <td>{formatPKR(r.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Total Expense</strong></td>
              <td><strong>{formatPKR(totalExpense)}</strong></td>
            </tr>
          </tfoot>
        </table>

        <div
          className="invoice-meta-row"
          style={{ marginTop: 24, borderBottom: 'none', fontSize: 18, fontWeight: 800 }}
        >
          <div style={{ color: 'var(--navy)' }}>Net Income</div>
          <div style={{ color: netIncome < 0 ? 'var(--red)' : 'var(--navy)' }}>{formatPKR(netIncome)}</div>
        </div>
      </div>
    </div>,
    printRoot
  );
}
