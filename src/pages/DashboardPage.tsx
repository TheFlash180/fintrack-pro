import { useMemo, useState } from 'react';
import {
  availableYears,
  filterTxs,
  monthlySeries,
  spendByCategory,
  spendSplit,
  totals,
} from '../lib/aggregate';
import { shiftYm, toYm } from '../lib/format';
import { useSettings } from '../lib/settings';
import type { Budget, DashKey, OwnerKey, Tx } from '../lib/types';
import { MonthPicker } from '../components/MonthPicker';
import { StatTiles } from '../components/StatTiles';
import { CategoryList } from '../components/CategoryList';
import { IncomeExpenseChart } from '../components/IncomeExpenseChart';
import { MonthCompare } from '../components/MonthCompare';
import { BudgetSection } from '../components/BudgetSection';
import { TxList } from '../components/TxList';
import { ImportSection } from '../components/ImportSection';
import { SpendSplit } from '../components/SpendSplit';
import { Collapsible } from '../components/Collapsible';
import { CategoryManager, FixedCategoryPicker } from '../components/CategoryManager';

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
  userId,
}: {
  dash: DashKey;
  txs: Tx[];
  budgets: Budget[];
  loading: boolean;
  onChanged: () => void;
  userId: string | null;
}) {
  const [ym, setYm] = useState(toYm(new Date()));
  const [allTime, setAllTime] = useState(false);
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const { settings, update: updateSettings, syncError } = useSettings(dash);
  const meta = DASH_META[dash];

  const ownerTxs = useMemo(() => filterTxs(txs, dash, null), [txs, dash]);
  const years = useMemo(() => availableYears(ownerTxs), [ownerTxs]);

  const periodTxs = useMemo(() => {
    let filtered = filterTxs(txs, dash, allTime ? null : ym);
    if (yearFilter && allTime) {
      filtered = filtered.filter(t => t.tx_date.startsWith(yearFilter));
    }
    return filtered;
  }, [txs, dash, ym, allTime, yearFilter]);

  const spend = useMemo(() => spendByCategory(periodTxs), [periodTxs]);

  const prevSpend = useMemo(() => {
    if (allTime) return undefined;
    const prevYm = shiftYm(ym, -1);
    const prevTxs = filterTxs(txs, dash, prevYm);
    return spendByCategory(prevTxs);
  }, [txs, dash, ym, allTime]);

  const split = useMemo(
    () => spendSplit(periodTxs, settings.fixedCategories),
    [periodTxs, settings.fixedCategories],
  );
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

      {syncError && (
        <div className="error-banner">
          Settings couldn't sync — changes are saved on this device only until
          the next successful edit.
        </div>
      )}

      <MonthPicker
        ym={ym}
        allTime={allTime}
        years={years}
        yearFilter={yearFilter}
        onChange={setYm}
        onToggleAll={() => { setAllTime(!allTime); setYearFilter(null); }}
        onYearFilter={setYearFilter}
      />

      <StatTiles totals={totals(periodTxs)} />

      <div className="card">
        <h3>Income vs expenses{dash === 'trollip' ? '' : ' · last 6 months'}</h3>
        <IncomeExpenseChart data={dash === 'trollip' ? series.slice(-6) : series} />
      </div>

      <Collapsible title={`Fixed vs discretionary${allTime ? ' · all time' : ''}`} defaultOpen>
        <SpendSplit split={split} />
        <FixedCategoryPicker settings={settings} onUpdate={updateSettings} />
      </Collapsible>

      <Collapsible title={`Spend by category${allTime ? ' · all time' : ''}`}>
        <CategoryList spend={spend} prevSpend={prevSpend} />
      </Collapsible>

      {dash === 'trollip' && (
        <div className="card">
          <h3>Budgets · actual vs budget</h3>
          <BudgetSection
            budgets={budgets}
            spend={spendByCategory(filterTxs(txs, 'trollip', ym))}
            ym={ym}
            categories={settings.categories}
            onSaved={onChanged}
          />
        </div>
      )}

      <Collapsible title="Recent transactions">
        <TxList
          txs={periodTxs.slice(0, 50)}
          showOwner={dash === 'trollip'}
          onChanged={onChanged}
          categories={settings.categories}
        />
      </Collapsible>

      {dash === 'trollip' && (
        <div className="card">
          <h3>Month comparison · last 12 months</h3>
          <MonthCompare series={series} />
        </div>
      )}

      <Collapsible title="Manage categories">
        <CategoryManager settings={settings} onUpdate={updateSettings} onChanged={onChanged} />
      </Collapsible>

      {dash !== 'trollip' && userId && (
        <ImportSection key={dash} owner={dash as OwnerKey} userId={userId} onImported={onChanged} categories={settings.categories} />
      )}
    </div>
  );
}
