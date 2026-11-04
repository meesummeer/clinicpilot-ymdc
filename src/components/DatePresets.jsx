import { datePresetRanges } from '../lib/dateUtils';

// Quick date-range pills (Today, Yesterday, This Month, Last Month, Last
// Month This Time, Last Year — Asia/Karachi). Drop it next to any From/To
// pair: <DatePresets from={from} to={to} onSelect={(f, t) => { setFrom(f); setTo(t); }} />.
// A pill shows as active only while from/to match its range exactly, so
// editing either date by hand clears the highlight on its own.
export default function DatePresets({ from, to, onSelect }) {
  const presets = datePresetRanges();
  return (
    <div className="date-presets" role="group" aria-label="Quick date ranges">
      {presets.map((p) => {
        const active = from === p.from && to === p.to;
        return (
          <button
            key={p.key}
            type="button"
            className={'date-preset' + (active ? ' active' : '')}
            aria-pressed={active}
            onClick={() => onSelect(p.from, p.to)}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
