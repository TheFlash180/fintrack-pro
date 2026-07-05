import type { CategorySpend } from '../lib/aggregate';
import { fmtZar } from '../lib/format';

/** Ranked category spend: one measure's magnitude, so a single-hue bar list
 *  (no rainbow) — name + amount + % with an inline bar per row. */
export function CategoryList({ spend }: { spend: CategorySpend[] }) {
  if (spend.length === 0) {
    return <div className="empty-state">No spending recorded for this period yet.</div>;
  }
  const max = spend[0].amount;
  return (
    <div>
      {spend.map((c) => (
        <div className="cat-row" key={c.category}>
          <span className="name">
            {c.category}
            <span className="pct">{c.pct.toFixed(0)}%</span>
          </span>
          <span className="amt mono">{fmtZar(c.amount)}</span>
          <div className="cat-bar-track">
            <div className="cat-bar" style={{ width: `${(c.amount / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
