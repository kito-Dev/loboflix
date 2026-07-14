import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, setUser } from '../api/client';
import { hasCompletedOnboarding } from '../utils/onboarding';
import { syncScheduleConfigFromPrefs } from '../utils/schedule';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.login(email, password);

      setToken(response.token);
      setUser(response);
      if (hasCompletedOnboarding()) {
        await syncScheduleConfigFromPrefs();
      }
      navigate(hasCompletedOnboarding() ? '/' : '/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na autenticação');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="pill">LoboFlix</p>
        <h1 className="page-title">Entrar</h1>
        <p className="page-subtitle">Organize filmes, maratonas e sua agenda.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? <p className="page-subtitle" style={{ color: 'var(--feedback-danger)' }}>{error}</p> : null}

          <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>

        <button
          className="btn btn-ghost"
          type="button"
          style={{ width: '100%', marginTop: 12 }}
          onClick={() => navigate('/onboarding')}
        >
          Primeira vez aqui
        </button>
      </section>
    </main>
  );
}
