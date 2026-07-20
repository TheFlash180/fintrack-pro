import { useState } from 'react';
import { budgetFor, budgetedCategories, type CategorySpend } from '../lib/aggregate';
import { deleteAllBudgetsForCategory, saveBudget } from '../lib/data';
import { fmtZar } from '../lib/format';
import type { Budget } from '../lib/types';

export function BudgetSection({
  budgets,
  spend,
  ym,
  categories,
  onSaved,
}: {
  budgets: Budget[];
  spend: CategorySpend[];
  ym: string;
  categories: string[];
  onSaved: () => void;
}) {
  const budgetable = categories.filter((c) => c !== 'Salary' && c !== 'Other Income');
  const [category, setCategory] = useState<string>(budgetable[0] ?? 'Groceries');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const cats = budgetedCategories(budgets, ym);
  const spendMap = new Map(spend.map((s) => [s.category, s.amount]));

  const save = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    setError('');
    const ok = await saveBudget(category, value, ym);
    setSaving(false);
    if (ok) {
      setAmount('');
      onSaved();
    } else {
      setError("The budget didn't save — check your connection and try again.");
    }
  };

  const saveEdit = async (cat: string) => {
    const value = Number(editAmount);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    setError('');
    const ok = await saveBudget(cat, value, ym);
    setSaving(false);
    if (ok) {
      setEditCat(null);
      onSaved();
    } else {
      setError("The budget didn't save — check your connection and try again.");
    }
  };

  const removeBudget = async (cat: string) => {
    if (!window.confirm(`Remove the budget for "${cat}"? This removes all historical budget entries for this category.`)) return;
    setSaving(true);
    setError('');
    const ok = await deleteAllBudgetsForCategory(cat);
    setSaving(false);
    if (ok) onSaved();
    else setError("The budget couldn't be removed — check your connection and try again.");
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
        const isEditing = editCat === cat;
        return (
          <div className="budget-row" key={cat}>
            <div className="budget-top">
              <span className="budget-cat">{cat}</span>
              {isEditing ? (
                <span className="budget-inline-edit">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void saveEdit(cat); }}
                    style={{ padding: '5px 8px', fontSize: '0.78rem' }}
                    autoFocus
                  />
                  <button className="btn" style={{ padding: '5px 11px', fontSize: '0.72rem' }} disabled={saving} onClick={() => void saveEdit(cat)}>Save</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 11px', fontSize: '0.72rem' }} onClick={() => setEditCat(null)}>Cancel</button>
                </span>
              ) : (
                <span className="budget-actions">
                  <button onClick={() => { setEditCat(cat); setEditAmount(String(budget)); }} aria-label={`Edit ${cat} budget`} title="Edit budget">&#x270E;</button>
                  <button onClick={() => void removeBudget(cat)} aria-label={`Remove ${cat} budget`} title="Remove budget">&times;</button>
                </span>
              )}
            </div>
            <div className="budget-track">
              <div className={`budget-fill${over ? ' over' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            {!isEditing && (
              <div className="budget-figures mono">
                <span><span className="spent">{fmtZar(actual)}</span> of {fmtZar(budget)}</span>
                {over ? (
                  <span className="budget-over-label">&#9650; {fmtZar(actual - budget)} over</span>
                ) : (
                  <span className="budget-left-label">{fmtZar(budget - actual)} left</span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}

      <div className="budget-edit">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {budgetable.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          type="number"
          inputMode="numeric"
          placeholder="R / month"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button className="btn" disabled={!amount || saving} onClick={() => void save()}>
          Set budget
        </button>
      </div>
      <p className="budget-note">
        Budgets apply from the selected month forward until you change them.
      </p>
    </div>
  );
}
