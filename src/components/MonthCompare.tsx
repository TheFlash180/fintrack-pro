import type { MonthPoint } from '../lib/aggregate';
import { fmtMonth, fmtMonthShort, fmtZar } from '../lib/format';
import { IncomeExpenseChart } from './IncomeExpenseChart';

/** Household month-over-month comparison: prominent current-vs-previous
 *  callout, 12-month chart, and a delta table (arrows + color, never color
 *  alone). */
export function MonthCompare({ series }: { series: MonthPoint[] }) {
  const nonEmpty = series.filter((p) => p.income > 0 || p.expenses > 0);
  if (nonEmpty.length === 0) {
    return <div className="empty-state">The comparison fills in as months of data accumulate.</div>;
  }

  const cur = series[series.length - 1];
  const prev = series[series.length - 2];
  const spendDelta = prev ? cur.expenses - prev.expenses : null;

  return (
    <div>
      {spendDelta !== null && (prev.income > 0 || prev.expenses > 0) && (
        <div className="compare-callout">
          {spendDelta <= 0 ? (
            <span className="delta-up">▼ Spending down {fmtZar(Math.abs(spendDelta))}</span>
          ) : (
            <span className="delta-down">▲ Spending up {fmtZar(spendDelta)}</span>
          )}{' '}
          vs {fmtMonth(prev.ym).split(' ')[0]}
        </div>
      )}

      <IncomeExpenseChart data={series} />

      <div className="table-scroll" style={{ marginTop: 12 }}>
        <table className="compare">
          <thead>
            <tr>
              <th>Month</th>
              <th>Income</th>
              <th>Expenses</th>
              <th>Net</th>
              <th>vs prev</th>
            </tr>
          </thead>
          <tbody>
            {series
              .slice()
              .reverse()
              .map((p, idx, arr) => {
                const older = arr[idx + 1];
                const delta = older ? p.expenses - older.expenses : null;
                const empty = p.income === 0 && p.expenses === 0;
                return (
                  <tr key={p.ym}>
                    <td style={{ fontFamily: 'Manrope' }}>{fmtMonthShort(p.ym)}</td>
                    <td>{empty ? '—' : fmtZar(p.income)}</td>
                    <td>{empty ? '—' : fmtZar(p.expenses)}</td>
                    <td className={p.net < 0 ? 'delta-down' : ''}>{empty ? '—' : fmtZar(p.net)}</td>
                    <td>
                      {delta === null || empty || (older && older.income === 0 && older.expenses === 0) ? (
                        '—'
                      ) : delta <= 0 ? (
                        <span className="delta-up">▼ {fmtZar(Math.abs(delta))}</span>
                      ) : (
                        <span className="delta-down">▲ {fmtZar(delta)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
