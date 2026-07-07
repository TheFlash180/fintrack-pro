import { useMemo, useState } from 'react';
import { deleteTx, updateTx } from '../lib/data';
import { fmtZar } from '../lib/format';
import { CATEGORIES, OWNER_LABEL, type Tx } from '../lib/types';

export function TxList({
  txs,
  showOwner,
  onChanged,
  categories,
}: {
  txs: Tx[];
  showOwner: boolean;
  onChanged: () => void;
  categories?: string[];
}) {
  const [editing, setEditing] = useState<Tx | null>(null);
  const [catFilter, setCatFilter] = useState('');

  const filtered = useMemo(
    () => catFilter ? txs.filter(t => t.category === catFilter) : txs,
    [txs, catFilter],
  );

  const catOptions = categories ?? (CATEGORIES as unknown as string[]);

  if (txs.length === 0) {
    return <div className="empty-state">No transactions here yet.</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          style={{ fontSize: '0.78rem', padding: '5px 8px' }}
        >
          <option value="">All categories ({txs.length})</option>
          {catOptions.map(c => {
            const count = txs.filter(t => t.category === c).length;
            if (count === 0) return null;
            return <option key={c} value={c}>{c} ({count})</option>;
          })}
        </select>
      </div>

      {filtered.map((t) => (
        <div className="tx-row" key={t.id}>
          <div className="tx-main">
            <div className="tx-desc">{t.description || '(no description)'}</div>
            <div className="tx-meta">
              {t.tx_date} · {t.category}
              {showOwner && ` · ${OWNER_LABEL[t.owner_key]}`}
            </div>
          </div>
          <span className={`tx-amt ${t.amount >= 0 ? 'pos' : 'neg'}`}>
            {t.amount >= 0 ? '+' : ''}
            {fmtZar(t.amount)}
          </span>
          <span className="tx-actions">
            <button onClick={() => setEditing(t)} title="Edit">&#x270E;</button>
          </span>
        </div>
      ))}

      {catFilter && filtered.length === 0 && (
        <div className="empty-state">No transactions in "{catFilter}" for this period.</div>
      )}

      {editing && (
        <EditModal
          tx={editing}
          categories={catOptions}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  tx,
  categories,
  onClose,
  onChanged,
}: {
  tx: Tx;
  categories: string[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [date, setDate] = useState(tx.tx_date);
  const [desc, setDesc] = useState(tx.description ?? '');
  const [amount, setAmount] = useState(String(tx.amount));
  const [category, setCategory] = useState(tx.category);
  const [owner, setOwner] = useState(tx.owner_key);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const ok = await updateTx(tx.id, {
      tx_date: date,
      description: desc,
      amount: Number(amount),
      category,
      owner_key: owner,
    });
    setBusy(false);
    if (ok) onChanged();
  };

  const remove = async () => {
    if (!window.confirm('Delete this transaction?')) return;
    setBusy(true);
    const ok = await deleteTx(tx.id);
    setBusy(false);
    if (ok) onChanged();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10,12,16,0.7)', zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 380, margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Edit transaction</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" />
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (negative = expense)"
            className="mono"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
            {!categories.includes(category) && <option key={category}>{category}</option>}
          </select>
          <select value={owner} onChange={(e) => setOwner(e.target.value as typeof owner)}>
            <option value="rickus">Rickus</option>
            <option value="anjone">Anjoné</option>
          </select>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-danger" disabled={busy} onClick={() => void remove()}>
              Delete
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" disabled={busy} onClick={() => void save()}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
