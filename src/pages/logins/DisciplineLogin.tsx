import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import '../../components/discipline/discipline-login.css';

/** Public reference labels and palette, using the main portal's existing accounts. */
export const DisciplineLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'FACULTY' | 'HOD' | 'ADMIN'>('FACULTY');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const result = await API.login(email, password, role);
      if (!result.user || result.user.role !== role) throw new Error('Unable to verify portal access.');
      navigate('/discipline', { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Sign in failed. Please try again.');
    } finally { setPending(false); }
  };

  return (
    <div className="discipline-login">
      <header className="discipline-letterhead">
        <div><h1>AVS Engineering College <span>(Autonomous)</span></h1><p>Discipline Monitoring System</p></div>
      </header>
      <main>
        <section className="discipline-login-card" aria-labelledby="discipline-title">
          <img src="/images/avsec-salem-logo.png" alt="AVS Engineering College" />
          <h2 id="discipline-title">Discipline Portal</h2>
          <p className="discipline-login-subtitle">Discipline Register Access</p>
          <form onSubmit={submit} autoComplete="off">
            <label htmlFor="discipline-email">Registered Email</label>
            <input id="discipline-email" name="discipline-identifier" type="email" autoComplete="off" placeholder="Enter registered email"
              required value={email} onChange={event => setEmail(event.target.value)} disabled={pending} />
            <label htmlFor="discipline-password">Password</label>
            <input id="discipline-password" name="discipline-password" type="password" autoComplete="new-password" required
              value={password} onChange={event => setPassword(event.target.value)} disabled={pending} />
            <label htmlFor="discipline-role">Select Role</label>
            <select id="discipline-role" value={role} onChange={event => { setRole(event.target.value as typeof role); setEmail(''); setPassword(''); setError(''); }} disabled={pending}>
              <option value="FACULTY">Faculty</option><option value="ADMIN">Admin</option>
            </select>
            {error && <p className="discipline-login-error" role="alert">{error}</p>}
            <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign In'}</button>
          </form>
        </section>
      </main>
      <footer>AVS Engineering College (Autonomous) — Discipline Monitoring System</footer>
    </div>
  );
};
