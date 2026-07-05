import { useMemo, useState } from 'react';
import {
  filterTxs,
  monthlySeries,
  spendByCategory,
  totals,
} from '../lib/aggregate';
import { toYm } from '../lib/format';
import type { Budget, DashKey, Tx } from '../lib/types';
import { MonthPicker } from '../components/MonthPicker';
import { StatTiles } from '../components/StatTiles';
import { CategoryList } from '../components/CategoryList';
import { IncomeExpenseChart } from '../components/IncomeExpenseChart';
import { MonthCompare } from '../components/MonthCompare';
import { BudgetSection } from '../components/BudgetSection';
import { TxList } from '../components/TxList';

const DASH_META: Record<DashKey, { title: string; accent: string; sub: string }> = {
  rickus: { title: 'Rickus', accent: '#60a5fa', sub: 'his transactions' },
  anjone: { title: 'Anjoné', accent: '#fbbf24', sub: 'her transactions' },
  trollip: { title: 'Trollip', accent: '#2dd4bf', sub: 'the household together' },
};

export function DashboardPage({
  dash,
  txs,
  budgets,
  loading,
  onChanged,
}: {
  dash: DashKey;
  txs: Tx[];
  budgets: Budget[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [ym, setYm] = useState(toYm(new Date()));
  const [allTime, setAllTime] = useState(false);
  const meta = DASH_META[dash];

  const periodTxs = useMemo(
    () => filterTxs(txs, dash, allTime ? null : ym),
    [txs, dash, ym, allTime],
  );
  const ownerTxs = useMemo(() => filterTxs(txs, dash, null), [txs, dash]);
  const spend = useMemo(() => spendByCategory(periodTxs), [periodTxs]);
  const series = useMemo(
    () => monthlySeries(ownerTxs, ym, dash === 'trollip' ? 12 : 6),
    [ownerTxs, ym, dash],
  );

  if (loading) {
    return (
      <div style={{ ['--dash-accent' as string]: meta.accent }}>
        <div className="tiles">
          <div className="skeleton" style={{ height: 74 }} />
          <div className="skeleton" style={{ height: 74 }} />
          <div className="skeleton" style={{ height: 74 }} />
        </div>
        <div className="skeleton" style={{ height: 240, marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 180 }} />
      </div>
    );
  }

  return (
    <div style={{ ['--dash-accent' as string]: meta.accent }}>
      <div className="page-head">
        <h1>
          <span className="tint">{meta.title}</span> dashboard
        </h1>
        <span className="sub">{meta.sub}</span>
      </div>

      <MonthPicker
        ym={ym}
        allTime={allTime}
        onChange={setYm}
        onToggleAll={() => setAllTime(!allTime)}
      />

      <StatTiles totals={totals(periodTxs)} />

      <div className="card">
        <h3>Income vs expenses{dash === 'trollip' ? '' : ' · last 6 months'}</h3>
        <IncomeExpenseChart data={dash === 'trollip' ? series.slice(-6) : series} />
      </div>

      <div className="card">
        <h3>Spend by category{allTime ? ' · all time' : ''}</h3>
        <CategoryList spend={spend} />
      </div>

      {dash === 'trollip' && (
        <div className="card">
          <h3>Budgets · actual vs budget</h3>
          <BudgetSection
            budgets={budgets}
            spend={spendByCategory(filterTxs(txs, 'trollip', ym))}
            ym={ym}
            onSaved={onChanged}
          />
        </div>
      )}

      <div className="card">
        <h3>Recent transactions</h3>
        <TxList txs={periodTxs.slice(0, 25)} showOwner={dash === 'trollip'} onChanged={onChanged} />
      </div>

      {dash === 'trollip' && (
        <div className="card">
          <h3>Month comparison · last 12 months</h3>
          <MonthCompare series={series} />
        </div>
      )}
    </div>
  );
}
