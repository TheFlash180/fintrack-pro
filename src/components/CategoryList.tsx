import type { CategorySpend } from '../lib/aggregate';
import { fmtZar } from '../lib/format';

export function CategoryList({
  spend,
  prevSpend,
}: {
  spend: CategorySpend[];
  prevSpend?: CategorySpend[];
}) {
  if (spend.length === 0) {
    return <div className="empty-state">No spending recorded for this period yet.</div>;
  }
  const max = spend[0].amount;
  const prevMap = new Map((prevSpend ?? []).map(c => [c.category, c.amount]));

  return (
    <div>
      {spend.map((c) => {
        const prev = prevMap.get(c.category);
        let delta: { pct: number; direction: 'up' | 'down' | 'same' } | null = null;
        if (prev != null && prev > 0) {
          const change = ((c.amount - prev) / prev) * 100;
          delta = {
            pct: Math.abs(change),
            direction: change > 1 ? 'up' : change < -1 ? 'down' : 'same',
          };
        } else if (prev == null && prevSpend && prevSpend.length > 0) {
          delta = { pct: 100, direction: 'up' };
        }
        return (
          <div className="cat-row" key={c.category}>
            <span className="name">
              {c.category}
              <span className="pct">{c.pct.toFixed(0)}%</span>
              {delta && delta.direction !== 'same' && (
                <span className={`cat-delta ${delta.direction === 'up' ? 'delta-up' : 'delta-down'}`}>
                  {delta.direction === 'up' ? '▲' : '▼'} {delta.pct.toFixed(0)}%
                </span>
              )}
            </span>
            <span className="amt mono">{fmtZar(c.amount)}</span>
            <div className="cat-bar-track">
              <div className="cat-bar" style={{ width: `${(c.amount / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
