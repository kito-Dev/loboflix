import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { api, setToken, setUser } from '../api/client';
import { Logo } from '../components/Logo';
import { completeOnboarding, saveUserPrefs } from '../utils/onboarding';
import { syncScheduleConfigFromPrefs } from '../utils/schedule';

const SERVICES = [
  { name: 'Netflix', color: '#e5615a' },
  { name: 'Prime Video', color: '#6aa6e0' },
  { name: 'Disney+', color: '#5b6fe0' },
  { name: 'Max', color: '#b57be0' },
  { name: 'Apple TV+', color: '#f4f3f1' },
];

const GENRES = ['Drama', 'Ficção', 'Ação', 'Suspense', 'Comédia', 'Terror', 'Romance', 'Animação', 'Documentário'];

const DAY_OPTIONS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

const WELCOME_STEP = 0;
const ACCOUNT_STEP = 1;
const SERVICES_STEP = 2;
const GENRES_STEP = 3;
const NIGHTS_STEP = 4;
const DONE_STEP = 5;

const PROGRESS_STEPS = [ACCOUNT_STEP, SERVICES_STEP, GENRES_STEP, NIGHTS_STEP];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(WELCOME_STEP);
  const [services, setServices] = useState<string[]>(['Netflix', 'Prime Video']);
  const [genres, setGenres] = useState<string[]>(['Drama', 'Ficção', 'Suspense']);
  const [nights, setNights] = useState(4);
  const [days, setDays] = useState<number[]>([1, 3, 5, 6]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort(),
    );
  }

  async function createAccount() {
    if (!name.trim() || !email.trim() || !password) {
      setAuthError('Preencha nome, email e senha.');
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const response = await api.register(email, password, name);
      setToken(response.token);
      setUser(response);
      setStep(SERVICES_STEP);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    saveUserPrefs({ services, genres, nightsPerWeek: nights, daysOfWeek: days });
    completeOnboarding({ services, genres, nightsPerWeek: nights, daysOfWeek: days });

    try {
      await syncScheduleConfigFromPrefs();
    } catch {
      /* preferências ficam salvas localmente mesmo se a sync falhar */
    }

    navigate('/');
  }

  return (
    <main className="onboarding">
      {PROGRESS_STEPS.includes(step) ? (
        <div className="onboarding-progress">
          {PROGRESS_STEPS.map((value) => (
            <span key={value} className={step >= value ? 'active' : undefined} />
          ))}
        </div>
      ) : null}

      {step === WELCOME_STEP ? (
        <section className="onboarding-step onboarding-step--welcome">
          <Logo size={78} />
          <h1>
            Qual filme
            <br />
            assistir hoje?
          </h1>
          <p>O Loboflix organiza sua lista e monta o cronograma perfeito para suas noites livres.</p>
          <button type="button" className="btn btn-hero btn-block" onClick={() => setStep(ACCOUNT_STEP)}>
            Começar
          </button>
          <p className="onboarding-login">
            Já tenho conta · <Link to="/login">Entrar</Link>
          </p>
        </section>
      ) : null}

      {step === ACCOUNT_STEP ? (
        <section className="onboarding-step">
          <h2>
            Crie sua
            <br />
            conta
          </h2>
          <p>Primeiro criamos seu perfil para salvar suas escolhas.</p>
          <div className="form-field">
            <label htmlFor="onb-name">Nome</label>
            <input id="onb-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="onb-email">Email</label>
            <input id="onb-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="onb-pass">Senha</label>
            <input id="onb-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {authError ? <p className="form-error">{authError}</p> : null}
          <button type="button" className="btn btn-primary btn-block" disabled={loading} onClick={createAccount}>
            {loading ? 'Criando...' : 'Criar conta e continuar'}
          </button>
          <p className="onboarding-login">
            Já tenho conta · <Link to="/login">Entrar</Link>
          </p>
        </section>
      ) : null}

      {step === SERVICES_STEP ? (
        <section className="onboarding-step">
          <h2>
            Onde você
            <br />
            assiste?
          </h2>
          <p>Só mostramos filmes disponíveis pra você.</p>
          <div className="onboarding-list">
            {SERVICES.map((service) => {
              const selected = services.includes(service.name);
              return (
                <button
                  key={service.name}
                  type="button"
                  className={`onboarding-item${selected ? ' onboarding-item--active' : ''}`}
                  onClick={() => toggle(services, service.name, setServices)}
                >
                  <span className="service-dot" style={{ background: service.color }} />
                  <span>{service.name}</span>
                  {selected ? <Check size={18} strokeWidth={2.4} /> : null}
                </button>
              );
            })}
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setStep(GENRES_STEP)}>
            Continuar
          </button>
        </section>
      ) : null}

      {step === GENRES_STEP ? (
        <section className="onboarding-step">
          <h2>
            O que você
            <br />
            curte?
          </h2>
          <p>Escolha ao menos 3 gêneros.</p>
          <div className="chip-wrap">
            {GENRES.map((genre) => (
              <button
                key={genre}
                type="button"
                className={`chip${genres.includes(genre) ? ' chip--active' : ''}`}
                onClick={() => toggle(genres, genre, setGenres)}
              >
                {genre}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={genres.length < 3}
            onClick={() => setStep(NIGHTS_STEP)}
          >
            Continuar
          </button>
        </section>
      ) : null}

      {step === NIGHTS_STEP ? (
        <section className="onboarding-step">
          <h2>
            Quantas noites
            <br />
            por semana?
          </h2>
          <p>Defina seu ritmo de cinema.</p>
          <div className="onboarding-number">{nights}</div>
          <input
            type="range"
            min={1}
            max={7}
            value={nights}
            onChange={(event) => setNights(Number(event.target.value))}
            className="onboarding-slider"
          />
          <div className="chip-row">
            {DAY_OPTIONS.map((day) => (
              <button
                key={day.value}
                type="button"
                className={`chip${days.includes(day.value) ? ' chip--active' : ''}`}
                onClick={() => toggleDay(day.value)}
              >
                {day.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setStep(DONE_STEP)}>
            Continuar
          </button>
        </section>
      ) : null}

      {step === DONE_STEP ? (
        <section className="onboarding-step">
          <div className="onboarding-check">✓</div>
          <h2>Tudo pronto</h2>
          <p>Sua semana está pronta. Vamos começar!</p>
          <button type="button" className="btn btn-primary btn-block" onClick={finish}>
            Entrar no Loboflix
          </button>
        </section>
      ) : null}
    </main>
  );
}
