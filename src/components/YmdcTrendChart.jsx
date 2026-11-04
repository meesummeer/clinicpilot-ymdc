import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, useXAxisScale, useYAxisScale } from 'recharts';
import { getYmdcNet } from '../lib/ymdcNet';
import { lastThreeKarachiMonths } from '../lib/dateUtils';
import { supabase } from '../lib/supabaseClient';

const NAVY = '#1A0A6E';
const RED = '#B22222';

function formatPKR(n) {
  return 'PKR ' + Number(n || 0).toLocaleString('en-PK');
}

function formatSignedPKR(n) {
  const rounded = Math.round(n);
  return `${rounded < 0 ? '−' : '+'}PKR ${Math.abs(rounded).toLocaleString('en-PK')}`;
}

function axisTick(v) {
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${v / 1000000}M`;
  if (abs >= 1000) return `${v / 1000}k`;
  return String(v);
}

// Value labels drawn from the axis scales (not from the bars), so a month
// with no data — whose zero-height bar Recharts skips — can't shift the
// labels onto the wrong bars.
function ValueLabels({ months }) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  if (!xScale || !yScale) return null;
  const zeroY = yScale(0);
  // The category scale gives each band's start; one step between starts is
  // the band width, so start + step / 2 is the centre of the bar.
  const step = months.length > 1 ? xScale(months[1].label) - xScale(months[0].label) : 0;
  return (
    <g>
      {months.map((m) => {
        const bandStart = xScale(m.label);
        if (bandStart === undefined || Number.isNaN(bandStart)) return null;
        const negative = !m.noData && m.net < 0;
        const valueY = yScale(m.noData ? 0 : m.net);
        return (
          <text
            key={m.key}
            x={bandStart + step / 2}
            y={negative ? valueY + 16 : Math.min(valueY, zeroY) - 8}
            textAnchor="middle"
            style={{ fontSize: 12, fontWeight: 700, fill: m.noData ? '#888' : negative ? RED : NAVY }}
          >
            {m.noData ? 'No data' : formatPKR(m.net)}
          </text>
        );
      })}
    </g>
  );
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const row = (label, value, strong) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, fontWeight: strong ? 800 : 500 }}>
      <span>{label}</span>
      <span>{formatPKR(value)}</span>
    </div>
  );
  return (
    <div style={{ background: 'white', border: '1px solid var(--border-grey)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, boxShadow: 'var(--shadow-md)', minWidth: 230 }}>
      <div style={{ fontWeight: 800, color: NAVY, marginBottom: 6 }}>{d.label}</div>
      {d.noData ? (
        <div style={{ color: 'var(--grey-text)' }}>No data for this month</div>
      ) : (
        <>
          {row('Revenue', d.revenue)}
          {row('YMDC share (after splits & costs)', d.ymdcShare)}
          {d.materialKept > 0 && row('Aesthetic material kept by YMDC', d.materialKept)}
          {row('Doctor costs recorded', d.costs)}
          {row('Expenses', d.expenses)}
          <div style={{ borderTop: '1px solid var(--border-grey)', margin: '6px 0' }} />
          {row('Net', d.net, true)}
        </>
      )}
    </div>
  );
}

// "3-Month Trend: YMDC Net Share". Always the last three Karachi calendar
// months (two months ago, last month, month to date) — it ignores the Hub's
// From/To filter. Every bar comes from getYmdcNet, the same function that
// drives the Profit / Loss card.
export default function YmdcTrendChart() {
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const ranges = lastThreeKarachiMonths();
        const { data: doctors } = await supabase.from('doctors').select('*').eq('active', true).order('name');
        const results = await Promise.all(ranges.map((m) => getYmdcNet(m.start, m.end, { doctors: doctors || [] })));
        if (cancelled) return;
        setMonths(
          ranges.map((m, i) => {
            const r = results[i];
            return {
              ...m,
              noData: r.recordCount === 0,
              net: r.net,
              revenue: r.totalRevenue,
              ymdcShare: r.ymdcShare,
              materialKept: r.materialKept,
              costs: r.totalCosts,
              expenses: r.totalExpenses,
            };
          })
        );
      } catch (err) {
        console.error(err.message);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const [twoAgo, lastMonth, current] = months;

  function comparison(from, to, withPercent, suffix) {
    if (from.noData || to.noData) {
      return `${to.label} vs ${from.shortLabel}: no comparison (no data for ${from.noData ? from.shortLabel : to.shortLabel})`;
    }
    const diff = to.net - from.net;
    let text = `${to.label} vs ${from.shortLabel}: ${formatSignedPKR(diff)}`;
    if (withPercent) {
      text += from.net !== 0 ? ` (${diff >= 0 ? '+' : '−'}${Math.abs((diff / Math.abs(from.net)) * 100).toFixed(1)}%)` : ' (% n/a)';
    }
    return suffix ? `${text} — ${suffix}` : text;
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0, marginBottom: 2 }}>3-Month Trend: YMDC Net Share</h3>
      <div style={{ fontSize: 12.5, color: 'var(--grey-text-light)', fontStyle: 'italic', marginBottom: 12 }}>
        Independent of the date filter
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : failed || months.length === 0 ? (
        <div className="empty-state">Couldn't load the trend.</div>
      ) : (
        <>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={months.map((m) => ({ ...m, plot: m.noData ? 0 : m.net }))} margin={{ top: 28, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                {/* Pixel padding keeps room for the value labels above positive and below negative bars. */}
                <YAxis tickFormatter={axisTick} tick={{ fontSize: 11 }} width={52} padding={{ top: 8, bottom: 26 }} />
                <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(26, 10, 110, 0.05)' }} />
                <ReferenceLine y={0} stroke={NAVY} strokeWidth={1.5} />
                <Bar dataKey="plot" name="YMDC net share" radius={[6, 6, 0, 0]} maxBarSize={110} isAnimationActive={false}>
                  {months.map((m) => (
                    <Cell key={m.key} fill={m.net < 0 ? RED : NAVY} />
                  ))}
                </Bar>
                <ValueLabels months={months} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 13, color: 'var(--grey-text)', marginTop: 10 }}>
            {comparison(twoAgo, lastMonth, true)}
            {' · '}
            {comparison(lastMonth, current, false, 'month to date, not a full month')}
          </div>
        </>
      )}
    </div>
  );
}
