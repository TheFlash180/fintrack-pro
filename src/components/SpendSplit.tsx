import type { SpendSplit as Split } from '../lib/aggregate';
import { fmtZar } from '../lib/format';

export function SpendSplit({ split }: { split: Split }) {
  if (split.total === 0) {
    return <div className="empty-state">No spending recorded for this period yet.</div>;
  }
  const fixedPct = (split.fixed / split.total) * 100;
  const discPct = (split.discretionary / split.total) * 100;
  return (
    <div className="spend-split">
      <div className="split-bar">
        <div className="split-fixed" style={{ width: `${fixedPct}%` }} />
        <div className="split-disc" style={{ width: `${discPct}%` }} />
      </div>
      <div className="split-legend">
        <div className="split-item">
          <span className="split-dot fixed" />
          <span className="split-label">Fixed</span>
          <span className="split-val mono">{fmtZar(split.fixed)}</span>
          <span className="split-pct">{fixedPct.toFixed(0)}%</span>
        </div>
        <div className="split-item">
          <span className="split-dot disc" />
          <span className="split-label">Discretionary</span>
          <span className="split-val mono">{fmtZar(split.discretionary)}</span>
          <span className="split-pct">{discPct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}
