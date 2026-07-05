import { useState } from 'react';

export function Login({
  onSignIn,
}: {
  onSignIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await onSignIn(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(
        /invalid/i.test(err.message)
          ? 'Wrong email or password.'
          : 'Could not sign in — check your connection.',
      );
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>
          FinTrack <span>Pro</span>
        </h1>
        <p>Trollip household finance. Members only.</p>
        <form onSubmit={(e) => void submit(e)}>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="error-banner">{error}</div>}
          <button className="btn" type="submit" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
