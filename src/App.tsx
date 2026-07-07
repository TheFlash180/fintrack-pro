import { useEffect, useState } from 'react';
import { useAuth } from './lib/useAuth';
import { useFinData } from './lib/data';
import type { DashKey } from './lib/types';
import { Login } from './components/Login';
import { TabBar } from './components/TabBar';
import { DashboardPage } from './pages/DashboardPage';

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

  if (!ready) return null;

  if (!session) {
    return <Login onSignIn={signIn} />;
  }

  const dash: DashKey = route.startsWith('#/rickus')
    ? 'rickus'
    : route.startsWith('#/anjone')
      ? 'anjone'
      : 'trollip';

  return (
    <>
      {data.error && <div className="error-banner">{data.error}</div>}

      <DashboardPage
        dash={dash}
        txs={data.txs}
        budgets={data.budgets}
        loading={data.loading}
        onChanged={() => void data.refresh()}
        userId={session.user.id}
      />

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button className="signout" onClick={() => void signOut()}>
          sign out
        </button>
      </div>

      <TabBar route={route === '' ? '#/trollip' : route} />
    </>
  );
}
