import { useState } from 'react';
import { budgetFor, budgetedCategories, type CategorySpend } from '../lib/aggregate';
import { saveBudget } from '../lib/data';
import { fmtZar } from '../lib/format';
import { CATEGORIES, type Budget } from '../lib/types';

export function BudgetSection({
  budgets,
  spend,
  ym,
  onSaved,
}: {
  budgets: Budget[];
  spend: CategorySpend[];
  ym: string;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState<string>('Groceries');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const cats = budgetedCategories(budgets, ym);
  const spendMap = new Map(spend.map((s) => [s.category, s.amount]));

  const save = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    const ok = await saveBudget(category, value, ym);
    setSaving(false);
    if (ok) {
      setAmount('');
      onSaved();
    }
  };

  return (
    <div>
      {cats.length === 0 && (
        <div className="empty-state">
          No budgets set yet — pick a category below and give it a monthly amount.
        </div>
      )}
      {cats.map((cat) => {
        const budget = budgetFor(budgets, cat, ym);
        if (budget === null) return null;
        const actual = spendMap.get(cat) ?? 0;
        const pct = Math.min((actual / budget) * 100, 100);
        const over = actual > budget;
        return (
          <div className="budget-row" key={cat}>
            <div className="head">
              <span>{cat}</span>
              <span className="mono">
                {fmtZar(actual)} / {fmtZar(budget)}{' '}
                {over ? (
                  <span className="budget-over-label">▲ {fmtZar(actual - budget)} over</span>
                ) : (
                  <span>· {fmtZar(budget - actual)} left</span>
                )}
              </span>
            </div>
            <div className="budget-track">
              <div className={`budget-fill${over ? ' over' : ''}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}

      <div className="budget-edit">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.filter((c) => c !== 'Salary' && c !== 'Other Income').map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="R / month"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ maxWidth: 120 }}
        />
        <button className="btn" disabled={!amount || saving} onClick={() => void save()}>
          Set
        </button>
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--dim)', marginTop: 8 }}>
        Budgets apply from the selected month forward until you change them.
      </p>
    </div>
  );
}
