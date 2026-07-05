import { CATEGORIES, type DraftTx, type OwnerKey } from '../lib/types';

/** The gate before anything is saved: every parsed row fully editable,
 *  deletable, addable — writes happen only on explicit confirm. */
export function ReviewTable({
  drafts,
  onChange,
}: {
  drafts: DraftTx[];
  onChange: (next: DraftTx[]) => void;
}) {
  const update = (i: number, patch: Partial<DraftTx>) => {
    const next = drafts.slice();
    next[i] = { ...next[i], ...patch, duplicate: false };
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...drafts,
      {
        tx_date: new Date().toISOString().slice(0, 10),
        description: '',
        amount: 0,
        category: 'Uncategorised',
        owner_key: drafts[0]?.owner_key ?? 'rickus',
      },
    ]);
  };

  return (
    <div>
      <div className="table-scroll">
        <table className="review-table">
          <thead>
            <tr>
              <th style={{ minWidth: 110 }}>Date</th>
              <th style={{ minWidth: 180 }}>Description</th>
              <th style={{ minWidth: 90 }}>Amount</th>
              <th style={{ minWidth: 120 }}>Category</th>
              <th style={{ minWidth: 90 }}>Owner</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {drafts.map((d, i) => (
              <tr key={i} className={d.duplicate ? 'dup' : ''}>
                <td>
                  <input
                    type="date"
                    value={d.tx_date}
                    onChange={(e) => update(i, { tx_date: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={d.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                  />
                  {d.duplicate && <span className="dup-tag">already imported — will skip</span>}
                </td>
                <td className="num">
                  <input
                    type="number"
                    step="0.01"
                    value={d.amount}
                    onChange={(e) => update(i, { amount: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <select
                    value={d.category}
                    onChange={(e) => update(i, { category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={d.owner_key}
                    onChange={(e) => update(i, { owner_key: e.target.value as OwnerKey })}
                  >
                    <option value="rickus">Rickus</option>
                    <option value="anjone">Anjoné</option>
                  </select>
                </td>
                <td>
                  <button
                    className="btn-ghost btn"
                    style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                    onClick={() => onChange(drafts.filter((_, j) => j !== i))}
                    title="Remove row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={addRow}>
        + Add row
      </button>
    </div>
  );
}
