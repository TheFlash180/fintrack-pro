import { useEffect, useRef, useState } from 'react';
import { fmtMonth, shiftYm, toYm } from '../lib/format';

type Mode = 'month' | 'year' | 'all';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(ym.split('-')[0]);
  const ref = useRef<HTMLDivElement>(null);

  const mode: Mode = allTime && !yearFilter ? 'all' : allTime && yearFilter ? 'year' : 'month';

  const setMode = (m: Mode) => {
    if (m === 'all') {
      if (!allTime) onToggleAll();
      onYearFilter(null);
    } else if (m === 'year') {
      if (!allTime) onToggleAll();
      onYearFilter(yearFilter ?? ym.split('-')[0]);
    } else {
      if (allTime) onToggleAll();
      onYearFilter(null);
    }
  };

  const selectMonth = (monthIdx: number) => {
    const newYm = `${pickerYear}-${String(monthIdx + 1).padStart(2, '0')}`;
    if (allTime) onToggleAll();
    onYearFilter(null);
    onChange(newYm);
    setPickerOpen(false);
  };

  const selectYear = (y: string) => {
    if (!allTime) onToggleAll();
    onYearFilter(y);
    setPickerOpen(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false);
    };
    if (pickerOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const label = mode === 'all'
    ? 'All time'
    : mode === 'year'
      ? yearFilter!
      : fmtMonth(ym);

  return (
    <div className="month-picker-wrap" ref={ref}>
      <div className="mode-tabs">
        <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>Month</button>
        <button className={mode === 'year' ? 'active' : ''} onClick={() => setMode('year')}>Year</button>
        <button className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>All time</button>
      </div>

      {mode !== 'all' && (
        <div className="month-picker">
          {mode === 'month' && (
            <button onClick={() => onChange(shiftYm(ym, -1))} aria-label="previous month">&#x2039;</button>
          )}
          {mode === 'year' && (
            <button
              onClick={() => {
                const prev = String(Number(yearFilter!) - 1);
                if (years.includes(prev)) onYearFilter(prev);
              }}
              disabled={!years.includes(String(Number(yearFilter!) - 1))}
              aria-label="previous year"
            >&#x2039;</button>
          )}

          <button className="picker-trigger" onClick={() => { setPickerOpen(!pickerOpen); setPickerYear(mode === 'year' ? yearFilter! : ym.split('-')[0]); }}>
            {label}
          </button>

          {mode === 'month' && (
            <button onClick={() => onChange(shiftYm(ym, 1))} disabled={ym >= currentYm} aria-label="next month">&#x203A;</button>
          )}
          {mode === 'year' && (
            <button
              onClick={() => {
                const next = String(Number(yearFilter!) + 1);
                if (years.includes(next)) onYearFilter(next);
              }}
              disabled={!years.includes(String(Number(yearFilter!) + 1))}
              aria-label="next year"
            >&#x203A;</button>
          )}
        </div>
      )}

      {pickerOpen && (
        <div className="date-picker-dropdown">
          <div className="dp-year-row">
            <button onClick={() => setPickerYear(String(Number(pickerYear) - 1))}>&#x2039;</button>
            <span className="dp-year-label">{pickerYear}</span>
            <button onClick={() => setPickerYear(String(Number(pickerYear) + 1))} disabled={pickerYear >= currentYm.split('-')[0]}>&#x203A;</button>
          </div>
          {mode === 'month' ? (
            <div className="dp-month-grid">
              {MONTH_NAMES.map((name, idx) => {
                const candidate = `${pickerYear}-${String(idx + 1).padStart(2, '0')}`;
                const isCurrent = candidate === ym;
                const isFuture = candidate > currentYm;
                return (
                  <button
                    key={name}
                    className={isCurrent ? 'active' : ''}
                    disabled={isFuture}
                    onClick={() => selectMonth(idx)}
                  >{name}</button>
                );
              })}
            </div>
          ) : (
            <div className="dp-year-grid">
              {years.map(y => (
                <button key={y} className={y === yearFilter ? 'active' : ''} onClick={() => selectYear(y)}>{y}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
