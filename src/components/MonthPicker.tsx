import { fmtMonth, shiftYm, toYm } from '../lib/format';

export function MonthPicker({
  ym,
  allTime,
  years,
  yearFilter,
  onChange,
  onToggleAll,
  onYearFilter,
}: {
  ym: string;
  allTime: boolean;
  years: string[];
  yearFilter: string | null;
  onChange: (ym: string) => void;
  onToggleAll: () => void;
  onYearFilter: (year: string | null) => void;
}) {
  const currentYm = toYm(new Date());
  return (
    <div className="month-picker-wrap">
      <div className="month-picker">
        <button onClick={() => onChange(shiftYm(ym, -1))} disabled={allTime} aria-label="previous month">
          &#x2039;
        </button>
        <span className="label">{allTime ? 'All time' : fmtMonth(ym)}</span>
        <button
          onClick={() => onChange(shiftYm(ym, 1))}
          disabled={allTime || ym >= currentYm}
          aria-label="next month"
        >
          &#x203A;
        </button>
        <button className={`all-toggle${allTime ? ' on' : ''}`} onClick={onToggleAll}>
          {allTime ? 'Monthly' : 'All time'}
        </button>
      </div>
      {years.length > 1 && (
        <div className="year-filter">
          <button
            className={`year-btn${yearFilter === null ? ' active' : ''}`}
            onClick={() => onYearFilter(null)}
          >
            All
          </button>
          {years.map(y => (
            <button
              key={y}
              className={`year-btn${yearFilter === y ? ' active' : ''}`}
              onClick={() => onYearFilter(y)}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
