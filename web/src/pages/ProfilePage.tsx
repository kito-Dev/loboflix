import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, LogOut, Moon, Plus, Settings, Tv } from 'lucide-react';
import { api, getUser, setToken, setUser } from '../api/client';
import type { LibraryItem } from '../api/types';
import { initials } from '../utils/movie';

export function ProfilePage() {
  const navigate = useNavigate();
  const user = getUser();
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [reminders, setReminders] = useState(true);

  useEffect(() => {
    api.getLibrary().then(setLibrary).catch(() => setLibrary([]));
  }, []);

  const genreStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of library) {
      for (const genre of item.movie.genres) {
        counts.set(genre, (counts.get(genre) ?? 0) + 1);
      }
    }
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0) || 1;
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count], index) => ({
        name,
        pct: `${Math.round((count / total) * 100)}%`,
        color: ['var(--accent-primary)', '#6aa6e0', '#b57be0', '#5fbe86'][index % 4],
      }));
  }, [library]);

  const watched = library.filter((item) => item.status === 'Watched');
  const totalHours = Math.round(library.reduce((sum, item) => sum + item.movie.runtime, 0) / 60);

  function logout() {
    setToken(null);
    setUser(null);
    navigate('/login');
  }

  return (
    <main className="screen screen--profile">
      <div className="profile-top">
        <Link to="/profile/settings" className="icon-btn-surface profile-settings" aria-label="Ajustes">
          <Settings size={20} strokeWidth={1.6} />
        </Link>
      </div>

      <section className="profile-hero">
        <div className="profile-avatar">{initials(user?.name ?? 'Você')}</div>
        <h1>{user?.name ?? 'Cinéfilo'}</h1>
        <p>
          Cinéfilo desde {new Date().getFullYear()}
          <span className="profile-badge">PRO</span>
        </p>
      </section>

      <div className="stats-row">
        <Link className="stat-card" to="/profile/history">
          <strong>{library.length}</strong>
          <span>Filmes</span>
        </Link>
        <div className="stat-card">
          <strong>
            {totalHours}
            <small>h</small>
          </strong>
          <span>Assistidas</span>
        </div>
        <div className="stat-card stat-card--accent">
          <strong>{watched.length || 1}</strong>
          <span>Dias seguidos</span>
        </div>
      </div>

      {genreStats.length > 0 ? (
        <section className="profile-section">
          <p className="overline">Seu gosto</p>
          <div className="taste-card">
            {genreStats.map((genre) => (
              <div key={genre.name} className="taste-row">
                <div className="taste-row__head">
                  <span>{genre.name}</span>
                  <span>{genre.pct}</span>
                </div>
                <div className="taste-row__track">
                  <div className="taste-row__fill" style={{ width: genre.pct, background: genre.color }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="profile-section">
        <p className="overline">Configurações</p>
        <div className="settings-card">
          <Link to="/profile/settings" className="settings-row settings-row--link">
            <span className="settings-row__icon">
              <Moon size={18} strokeWidth={1.6} />
            </span>
            <span className="settings-row__text">
              <strong>Noites de cinema</strong>
              <small>Dias, horário e duração</small>
            </span>
            <ChevronRight size={18} />
          </Link>
          <label className="settings-row">
            <span className="settings-row__icon">
              <Plus size={18} strokeWidth={1.6} />
            </span>
            <span className="settings-row__text">
              <strong>Agendar automaticamente</strong>
              <small>Preencher noites livres</small>
            </span>
            <input
              type="checkbox"
              className="toggle"
              checked={autoSchedule}
              onChange={(event) => setAutoSchedule(event.target.checked)}
            />
          </label>
          <label className="settings-row">
            <span className="settings-row__icon">
              <Bell size={18} strokeWidth={1.6} />
            </span>
            <span className="settings-row__text">
              <strong>Lembretes</strong>
              <small>30 min antes de cada filme</small>
            </span>
            <input
              type="checkbox"
              className="toggle"
              checked={reminders}
              onChange={(event) => setReminders(event.target.checked)}
            />
          </label>
          <button type="button" className="settings-row settings-row--link">
            <span className="settings-row__icon">
              <Moon size={18} strokeWidth={1.6} />
            </span>
            <span className="settings-row__text">
              <strong>Aparência</strong>
              <small>Escuro</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button type="button" className="settings-row settings-row--link">
            <span className="settings-row__icon">
              <Tv size={18} strokeWidth={1.6} />
            </span>
            <span className="settings-row__text">
              <strong>Serviços de streaming</strong>
              <small>4 conectados</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <button type="button" className="btn btn-danger-outline btn-block" onClick={logout}>
        <LogOut size={18} />
        Sair da conta
      </button>
    </main>
  );
}
