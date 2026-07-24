import { useState } from 'react';
import { netWorth } from '../lib/accounts';
import { saveAccountBalances } from '../lib/data';
import { fmtZar } from '../lib/format';
import type { Account } from '../lib/types';

function fmtAsOf(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AccountsOverview({
  accounts,
  onChanged,
}: {
  accounts: Account[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Nothing to show until at least one account has a reported balance — unless
  // we're actively editing (so a first-time set-up is possible).
  if (!editing && !accounts.some((a) => a.stated_balance != null)) return null;

  const nw = netWorth(accounts);
  const assets = accounts.filter((a) => !a.is_liability);
  const liabilities = accounts.filter((a) => a.is_liability);

  const startEdit = () => {
    const seed: Record<string, string> = {};
    for (const a of accounts) seed[a.key] = a.stated_balance == null ? '' : String(a.stated_balance);
    setDraft(seed);
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    const updates = accounts
      .map((a) => {
        const raw = (draft[a.key] ?? '').trim();
        const value = raw === '' ? null : Number(raw.replace(/[R,\s]/g, ''));
        return { key: a.key, stated_balance: value, current: a.stated_balance };
      })
      .filter((u) => u.stated_balance !== u.current && !(u.stated_balance != null && Number.isNaN(u.stated_balance)))
      .map(({ key, stated_balance }) => ({ key, stated_balance }));
    const ok = await saveAccountBalances(updates);
    setBusy(false);
    if (ok) {
      setEditing(false);
      onChanged();
    }
  };

  return (
    <div className="card">
      <h3>
        Net worth{nw.asOf ? ` · as at ${fmtAsOf(nw.asOf)}` : ''}
        {!editing && (
          <button
            className="btn-ghost btn"
            style={{ float: 'right', padding: '2px 10px', fontSize: '0.7rem' }}
            onClick={startEdit}
          >
            Update balances
          </button>
        )}
      </h3>

      {!editing && (
        <div className="tiles" style={{ marginBottom: 6 }}>
          <div className="tile">
            <div className="label">Assets</div>
            <div className="value pos">{fmtZar(nw.assets)}</div>
          </div>
          <div className="tile">
            <div className="label">Owed</div>
            <div className="value neg">{fmtZar(nw.liabilities)}</div>
          </div>
          <div className="tile">
            <div className="label">Net worth</div>
            <div className={`value ${nw.net >= 0 ? 'pos' : 'neg'}`}>{fmtZar(nw.net)}</div>
          </div>
        </div>
      )}

      {editing ? (
        <>
          <p className="notice" style={{ marginBottom: 10 }}>
            Type each account's current balance (for the credit card, the amount
            owed). Leave blank to skip. It stamps today's date.
          </p>
          <div className="acct-list">
            {accounts.map((a) => (
              <div className="acct-row" key={a.key}>
                <div>
                  <div className="acct-name">{a.name}</div>
                  {a.external_ref && <div className="acct-ref">{a.external_ref}</div>}
                </div>
                <input
                  className="acct-input"
                  inputMode="decimal"
                  value={draft[a.key] ?? ''}
                  placeholder="0.00"
                  onChange={(e) => setDraft({ ...draft, [a.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save balances'}
            </button>
          </div>
        </>
      ) : (
        <div className="acct-list">
          {assets.map((a) => (
            <AccountRow key={a.key} account={a} />
          ))}
          {liabilities.length > 0 && <div className="acct-divider">Owed</div>}
          {liabilities.map((a) => (
            <AccountRow key={a.key} account={a} liability />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountRow({ account, liability }: { account: Account; liability?: boolean }) {
  if (account.stated_balance == null) return null;
  return (
    <div className="acct-row">
      <div>
        <div className="acct-name">{account.name}</div>
        {account.external_ref && <div className="acct-ref">{account.external_ref}</div>}
      </div>
      <div className={`acct-bal ${liability ? 'neg' : ''}`}>
        {liability ? '−' : ''}
        {fmtZar(account.stated_balance)}
      </div>
    </div>
  );
}
