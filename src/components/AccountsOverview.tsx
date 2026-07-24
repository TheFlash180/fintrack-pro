import {
  netWorth,
  reconcileAccount,
  summariseAccount,
  txsForAccount,
} from '../lib/accounts';
import { fmtZar } from '../lib/format';
import type { Account, OwnerKey, Tx } from '../lib/types';
import { Collapsible } from './Collapsible';

/** The account that pre-accounts history (account_key = null) falls back to:
 *  each owner's main current account. */
function mainKeyFor(owner: OwnerKey, accounts: Account[]): string {
  const current = accounts
    .filter((a) => a.owner_key === owner && a.kind === 'current')
    .sort((a, b) => a.sort_order - b.sort_order);
  return (current[0] ?? accounts.find((a) => a.owner_key === owner))?.key ?? '';
}

function fmtAsOf(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AccountsOverview({ accounts, txs }: { accounts: Account[]; txs: Tx[] }) {
  // Nothing to show until at least one account has a reported balance (e.g.
  // Anjoné's FNB account is seeded without one yet).
  if (!accounts.some((a) => a.stated_balance != null)) return null;

  const nw = netWorth(accounts);
  const assets = accounts.filter((a) => !a.is_liability && a.stated_balance != null);
  const liabilities = accounts.filter((a) => a.is_liability && a.stated_balance != null);

  return (
    <div className="card">
      <h3>Net worth{nw.asOf ? ` · as at ${fmtAsOf(nw.asOf)}` : ''}</h3>

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

      <div className="acct-list">
        {assets.map((a) => (
          <AccountRow key={a.key} account={a} />
        ))}
        {liabilities.length > 0 && <div className="acct-divider">Owed</div>}
        {liabilities.map((a) => (
          <AccountRow key={a.key} account={a} liability />
        ))}
      </div>

      <Collapsible title="Reconciliation · imported vs reported">
        <p className="notice" style={{ marginBottom: 10 }}>
          Compares the balance you reported with what FinTrack computes from the
          statements imported so far. Accounts whose export carries a running
          balance reconcile to the cent; the Discovery accounts show imported
          movement only (their export has no balance column).
        </p>
        <div className="acct-list">
          {accounts.map((a) => (
            <ReconRow key={a.key} account={a} accountTxs={txsForAccount(txs, a, mainKeyFor(a.owner_key, accounts))} />
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

function AccountRow({ account, liability }: { account: Account; liability?: boolean }) {
  return (
    <div className="acct-row">
      <div>
        <div className="acct-name">{account.name}</div>
        {account.external_ref && <div className="acct-ref">{account.external_ref}</div>}
      </div>
      <div className={`acct-bal ${liability ? 'neg' : ''}`}>
        {liability ? '−' : ''}
        {fmtZar(account.stated_balance ?? 0)}
      </div>
    </div>
  );
}

function ReconRow({ account, accountTxs }: { account: Account; accountTxs: Tx[] }) {
  const recon = reconcileAccount(account, accountTxs);
  const summary = summariseAccount(accountTxs);

  return (
    <div className="acct-row">
      <div>
        <div className="acct-name">{account.short_name}</div>
        <div className="acct-ref">
          {summary.count} imported
          {summary.lastDate ? ` · latest ${summary.lastDate}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {recon.computed == null ? (
          <div className="acct-ref">
            movement {summary.movement >= 0 ? '+' : ''}
            {fmtZar(summary.movement)}
          </div>
        ) : (
          <>
            <div className="acct-bal">{fmtZar(recon.computed)}</div>
            {recon.delta != null && (
              <div className={`acct-ref ${recon.aligned ? 'pos' : 'neg'}`}>
                {recon.aligned ? '✓ balances' : `off by ${fmtZar(recon.delta)}`}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
