import { fmtMonth, shiftYm, toYm } from '../lib/format';

export function MonthPicker({
  ym,
  allTime,
  onChange,
  onToggleAll,
}: {
  ym: string;
  allTime: boolean;
  onChange: (ym: string) => void;
  onToggleAll: () => void;
}) {
  const currentYm = toYm(new Date());
  return (
    <div className="month-picker">
      <button onClick={() => onChange(shiftYm(ym, -1))} disabled={allTime} aria-label="previous month">
        ‹
      </button>
      <span className="label">{allTime ? 'All time' : fmtMonth(ym)}</span>
      <button
        onClick={() => onChange(shiftYm(ym, 1))}
        disabled={allTime || ym >= currentYm}
        aria-label="next month"
      >
        ›
      </button>
      <button className={`all-toggle${allTime ? ' on' : ''}`} onClick={onToggleAll}>
        {allTime ? 'Monthly' : 'All time'}
      </button>
    </div>
  );
}
