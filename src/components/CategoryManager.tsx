import { useState } from 'react';
import type { DashSettings } from '../lib/settings';

export function CategoryManager({
  settings,
  onUpdate,
}: {
  settings: DashSettings;
  onUpdate: (patch: Partial<DashSettings>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const cats = settings.categories;

  const addCategory = () => {
    const name = newName.trim();
    if (!name || cats.includes(name)) return;
    onUpdate({ categories: [...cats, name] });
    setNewName('');
    setAdding(false);
  };

  const renameCategory = (idx: number) => {
    const name = editName.trim();
    if (!name || (name !== cats[idx] && cats.includes(name))) return;
    const next = [...cats];
    const oldName = next[idx];
    next[idx] = name;
    const fixedNext = settings.fixedCategories.map(c => c === oldName ? name : c);
    onUpdate({ categories: next, fixedCategories: fixedNext });
    setEditIdx(null);
  };

  const removeCategory = (idx: number) => {
    const name = cats[idx];
    onUpdate({
      categories: cats.filter((_, i) => i !== idx),
      fixedCategories: settings.fixedCategories.filter(c => c !== name),
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {cats.map((c, i) => (
          <div key={c} className="cat-mgr-row">
            {editIdx === i ? (
              <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renameCategory(i); }}
                  style={{ flex: 1, padding: '5px 8px', fontSize: '0.8rem' }}
                  autoFocus
                />
                <button className="btn" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => renameCategory(i)}>Save</button>
                <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => setEditIdx(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <span className="cat-mgr-name">{c}</span>
                <span className="cat-mgr-actions">
                  <button onClick={() => { setEditIdx(i); setEditName(c); }} title="Rename">&#x270E;</button>
                  <button onClick={() => removeCategory(i)} title="Remove">&times;</button>
                </span>
              </>
            )}
          </div>
        ))}
      </div>
      {adding ? (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
            placeholder="Category name"
            style={{ flex: 1, padding: '5px 8px', fontSize: '0.8rem' }}
            autoFocus
          />
          <button className="btn" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={addCategory}>Add</button>
          <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => setAdding(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn btn-ghost" style={{ marginTop: 8, padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => setAdding(true)}>+ Add category</button>
      )}
    </div>
  );
}

export function FixedCategoryPicker({
  settings,
  onUpdate,
}: {
  settings: DashSettings;
  onUpdate: (patch: Partial<DashSettings>) => void;
}) {
  const toggle = (cat: string) => {
    const fixed = settings.fixedCategories.includes(cat)
      ? settings.fixedCategories.filter(c => c !== cat)
      : [...settings.fixedCategories, cat];
    onUpdate({ fixedCategories: fixed });
  };

  const expenseCats = settings.categories.filter(
    c => c !== 'Salary' && c !== 'Other Income',
  );

  return (
    <div className="fixed-picker">
      <p style={{ fontSize: '0.78rem', color: 'var(--dim)', marginBottom: 10 }}>
        Toggle which categories count as fixed expenses. Everything else is discretionary.
      </p>
      <div className="fixed-picker-grid">
        {expenseCats.map(c => (
          <label key={c} className="fixed-picker-item">
            <input
              type="checkbox"
              checked={settings.fixedCategories.includes(c)}
              onChange={() => toggle(c)}
            />
            <span>{c}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
