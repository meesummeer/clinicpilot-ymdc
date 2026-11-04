import { useMemo, useState } from 'react';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

const ROW_GRID = '34px minmax(150px, 1fr) 92px 140px 140px';
const ROW_GRID_COUNTS = '34px minmax(150px, 1fr) 110px';

// "Top 5 Doctors by Revenue": ranked by gross revenue over the Hub's From/To
// range. Doctors only by default; the toggle adds services/departments
// (Laboratory, Ultrasound, X-Ray, ...). Expanding shows everyone with billing.
export default function TopDoctorsList({ doctorFinancials, serviceCategoryFinancials, loading, showFinancials = true }) {
  const [includeServices, setIncludeServices] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const ranked = useMemo(() => {
    const all = [...doctorFinancials, ...(includeServices ? serviceCategoryFinancials : [])]
      .filter((f) => f.transactionCount > 0)
      // Without financial access, rank by number of transactions instead of money.
      .sort((a, b) =>
        showFinancials
          ? b.gross - a.gross || a.doctor.name.localeCompare(b.doctor.name)
          : b.transactionCount - a.transactionCount || a.doctor.name.localeCompare(b.doctor.name)
      );
    return all.map((f, i) => ({ ...f, rank: i + 1 }));
  }, [doctorFinancials, serviceCategoryFinancials, includeServices, showFinancials]);

  const top = ranked.slice(0, 5);
  const rest = ranked.slice(5);

  function renderRow(f) {
    return (
      <div
        key={f.doctor.id}
        style={{ display: 'grid', gridTemplateColumns: showFinancials ? ROW_GRID : ROW_GRID_COUNTS, gap: 10, alignItems: 'center', padding: '11px 4px', borderBottom: '1px solid var(--border-grey)', fontSize: 14 }}
      >
        <span style={{ fontWeight: 800, color: 'var(--navy)' }}>{f.rank}</span>
        <span>
          <span className="doctor-dot" style={{ background: f.doctor.color_hex }} />
          {f.doctor.name}
        </span>
        <span style={{ textAlign: 'right', fontWeight: showFinancials ? 400 : 700 }}>{f.transactionCount}</span>
        {showFinancials && <span style={{ textAlign: 'right', fontWeight: 700 }}>{formatPKR(f.gross)}</span>}
        {showFinancials && <span style={{ textAlign: 'right', fontWeight: 700, color: '#8A6D0F' }}>{formatPKR(f.ymdcShare)}</span>}
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>{showFinancials ? 'Top 5 Doctors by Revenue' : 'Top 5 Doctors by Transactions'}</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--grey-text)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={includeServices}
            onChange={(e) => setIncludeServices(e.target.checked)}
          />
          Include services/departments
        </label>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : ranked.length === 0 ? (
        <div className="empty-state">No billing in this range</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: showFinancials ? 560 : 340 }}>
            <div
              style={{ display: 'grid', gridTemplateColumns: showFinancials ? ROW_GRID : ROW_GRID_COUNTS, gap: 10, padding: '0 4px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--grey-text)', borderBottom: '2px solid var(--navy)' }}
            >
              <span>#</span>
              <span>Doctor</span>
              <span style={{ textAlign: 'right' }}>Transactions</span>
              {showFinancials && <span style={{ textAlign: 'right' }}>Gross revenue</span>}
              {showFinancials && <span style={{ textAlign: 'right' }}>YMDC share</span>}
            </div>
            {top.map(renderRow)}
            {rest.length > 0 && (
              <div
                aria-hidden={!expanded}
                style={{
                  display: 'grid',
                  gridTemplateRows: expanded ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.35s ease',
                }}
              >
                <div style={{ overflow: 'hidden', minHeight: 0 }}>{rest.map(renderRow)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show top 5 only' : `Show all doctors (${ranked.length})`}
        </button>
      )}
    </div>
  );
}
