import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { CalendarDays } from 'lucide-react';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { humanizeFirebaseError } from '../lib/errors';

export function LoginPage({ authError }: { authError: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(authError);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isFirebaseConfigured) {
      setError('Firebase не настроен. Заполните переменные в .env.local и перезапустите приложение.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (nextError) {
      setError(humanizeFirebaseError(nextError));
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page">
    <section className="login-card">
      <div className="login-icon"><CalendarDays size={26} /></div>
      <p className="eyebrow">PEAKWAY</p>
      <h1>Календарь учителя</h1>
      <p className="login-copy">Войдите, чтобы открыть расписание вашей школы.</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label>Пароль<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button login-button" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
      </form>
    </section>
  </main>;
}
