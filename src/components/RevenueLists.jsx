import { useMemo, useState } from 'react';

function formatPKR(n) {
  return 'PKR ' + Number(Math.round(n) || 0).toLocaleString('en-PK');
}

const TABS = [
  { key: 'doctors', label: 'Doctors' },
  { key: 'services', label: 'Services' },
];

// The Hub's Doctors / Services lists. Every entry of the chosen kind is
// shown (zero-revenue ones greyed at the bottom); inactive entries only when
// they billed in the range. With no financial access, only counts are shown.
export default function RevenueLists({ entries, totalRevenue, loading, showFinancials = true }) {
  const [tab, setTab] = useState('doctors');

  const lists = useMemo(() => {
    const visible = (isService) =>
      entries
        .filter((e) => e.isService === isService && (e.doctor.active || e.gross > 0))
        .sort((a, b) =>
          showFinancials
            ? b.gross - a.gross || a.doctor.name.localeCompare(b.doctor.name)
            : b.transactionCount - a.transactionCount || a.doctor.name.localeCompare(b.doctor.name)
        );
    return { doctors: visible(false), services: visible(true) };
  }, [entries, showFinancials]);

  const rows = lists[tab];
  const hasActivity = (e) => (showFinancials ? e.gross > 0 : e.transactionCount > 0);
  const totals = rows.reduce(
    (t, e) => ({ transactions: t.transactions + e.transactionCount, gross: t.gross + e.gross, ymdc: t.ymdc + e.ymdcShare }),
    { transactions: 0, gross: 0, ymdc: 0 }
  );
  const pct = (gross) => (totalRevenue > 0 ? ((gross / totalRevenue) * 100).toFixed(1) + '%' : '—');

  // Reconciliation: both lists together should equal the Total Revenue card.
  const sumDoctors = lists.doctors.reduce((s, e) => s + e.gross, 0);
  const sumServices = lists.services.reduce((s, e) => s + e.gross, 0);
  const combined = sumDoctors + sumServices;
  const difference = totalRevenue - combined;
  const matches = Math.abs(difference) < 0.005;
  const inactiveWithRevenue = entries.filter((e) => !e.doctor.active && e.gross > 0);

  const th = (label, right) => <th style={right ? { textAlign: 'right' } : undefined}>{label}</th>;
  const numCell = (content, extra) => <td style={{ textAlign: 'right', whiteSpace: 'nowrap', ...extra }}>{content}</td>;

  let rank = 0;
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{tab === 'doctors' ? 'Doctors' : 'Services'} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--grey-text)' }}>({rows.length} entries)</span></h3>
        <div className="date-presets" role="tablist" aria-label="List">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={'date-preset' + (tab === t.key ? ' active' : '')}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                {th('Rank')}
                {th('Name')}
                {th('Transactions', true)}
                {showFinancials && th('Gross Revenue', true)}
                {showFinancials && th('YMDC Share', true)}
                {showFinancials && th('% of Total Revenue', true)}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const active = hasActivity(e);
                if (active) rank += 1;
                return (
                  <tr key={e.doctor.id} style={active ? undefined : { color: '#9AA0B4' }}>
                    <td>{active ? rank : '—'}</td>
                    <td>
                      <span className="doctor-dot" style={{ background: e.doctor.color_hex, opacity: active ? 1 : 0.45 }} />
                      {e.doctor.name}
                      {!e.doctor.active && <span style={{ fontSize: 11, marginLeft: 6, color: 'var(--grey-text)' }}>(inactive)</span>}
                    </td>
                    {numCell(e.transactionCount)}
                    {showFinancials && numCell(formatPKR(e.gross), active ? { fontWeight: 700 } : undefined)}
                    {showFinancials && numCell(formatPKR(e.ymdcShare), active ? { fontWeight: 700, color: '#8A6D0F' } : undefined)}
                    {showFinancials && numCell(pct(e.gross))}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={showFinancials ? 6 : 3} style={{ textAlign: 'center', color: 'var(--grey-text)' }}>Nothing to show.</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="hub-archive-total-row">
                  <td></td>
                  <td>Total</td>
                  {numCell(totals.transactions)}
                  {showFinancials && numCell(formatPKR(totals.gross))}
                  {showFinancials && numCell(formatPKR(totals.ymdc))}
                  {showFinancials && numCell(pct(totals.gross))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {showFinancials && !loading && (
        <div style={{ marginTop: 10, fontSize: 12.5 }}>
          {matches ? (
            <span style={{ color: 'var(--grey-text)' }}>
              Doctors + Services = {formatPKR(combined)} (matches Total Revenue card)
            </span>
          ) : (
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>
              Doctors + Services = {formatPKR(combined)} — does NOT match the Total Revenue card ({formatPKR(totalRevenue)}). Difference: {formatPKR(difference)}
            </span>
          )}
          {inactiveWithRevenue.length > 0 && (
            <div style={{ color: 'var(--grey-text)', marginTop: 4 }}>
              Includes inactive entries that billed in this range ({inactiveWithRevenue.map((e) => e.doctor.name).join(', ')}). The YMDC card counts active entries only.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
