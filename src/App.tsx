import { useEffect, useState } from 'react';
import { useAuth } from './lib/useAuth';
import { useFinData } from './lib/data';
import { supabase } from './lib/supabase';
import type { DashKey, OwnerKey } from './lib/types';
import { Login } from './components/Login';
import { TabBar } from './components/TabBar';
import { DashboardPage } from './pages/DashboardPage';
import { ImportPage } from './pages/ImportPage';

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash || '#/trollip');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/trollip');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export default function App() {
  const { session, ready, signIn, signOut } = useAuth();
  const route = useHashRoute();
  const data = useFinData(Boolean(session));
  const [myOwner, setMyOwner] = useState<OwnerKey>('rickus');

  useEffect(() => {
    if (!session) return;
    supabase
      .from('profiles')
      .select('owner_key')
      .eq('id', session.user.id)
      .single()
      .then(({ data: p }) => {
        if (p?.owner_key === 'anjone' || p?.owner_key === 'rickus') setMyOwner(p.owner_key);
      });
  }, [session]);

  if (!ready) return null;

  if (!session) {
    return <Login onSignIn={signIn} />;
  }

  const dash: DashKey | null = route.startsWith('#/rickus')
    ? 'rickus'
    : route.startsWith('#/anjone')
      ? 'anjone'
      : route.startsWith('#/trollip')
        ? 'trollip'
        : null;

  return (
    <>
      {data.error && <div className="error-banner">{data.error}</div>}

      {dash ? (
        <DashboardPage
          dash={dash}
          txs={data.txs}
          budgets={data.budgets}
          loading={data.loading}
          onChanged={() => void data.refresh()}
        />
      ) : (
        <ImportPage
          userId={session.user.id}
          defaultOwner={myOwner}
          onImported={() => void data.refresh()}
        />
      )}

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button className="signout" onClick={() => void signOut()}>
          sign out
        </button>
      </div>

      <TabBar route={route === '' ? '#/trollip' : route} />
    </>
  );
}
