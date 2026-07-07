import type { Totals } from '../lib/aggregate';
import { savingsRate } from '../lib/aggregate';
import { fmtZar } from '../lib/format';

export function StatTiles({ totals }: { totals: Totals }) {
  const rate = savingsRate(totals);
  return (
    <div className="tiles">
      <div className="tile">
        <div className="label">Income</div>
        <div className="value">{fmtZar(totals.income)}</div>
      </div>
      <div className="tile">
        <div className="label">Expenses</div>
        <div className="value">{fmtZar(totals.expenses)}</div>
      </div>
      <div className="tile">
        <div className="label">Net</div>
        <div className={`value ${totals.net >= 0 ? 'pos' : 'neg'}`}>
          {totals.net >= 0 ? '+' : ''}
          {fmtZar(totals.net)}
        </div>
      </div>
      <div className="tile">
        <div className="label">Savings rate</div>
        <div className={`value ${rate !== null && rate >= 0 ? 'pos' : 'neg'}`}>
          {rate !== null ? `${rate >= 0 ? '+' : ''}${rate.toFixed(0)}%` : '—'}
        </div>
      </div>
    </div>
  );
}
