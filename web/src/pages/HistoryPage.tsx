import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, MoreHorizontal } from 'lucide-react';
import { api, formatRuntime } from '../api/client';
import type { LibraryItem } from '../api/types';

export function HistoryPage() {
  const [library, setLibrary] = useState<LibraryItem[]>([]);

  useEffect(() => {
    api.getLibrary().then(setLibrary).catch(() => setLibrary([]));
  }, []);

  const watched = library.filter((item) => item.status === 'Watched');
  const totalHours = Math.round(watched.reduce((sum, item) => sum + item.movie.runtime, 0) / 60);
  const avgRating =
    watched.length > 0
      ? (
          watched.reduce((sum, item) => sum + (item.movie.imdbRating ?? item.movie.tmdbRating ?? 0), 0) /
          watched.length
        ).toFixed(1)
      : '—';

  const groups = useMemo(() => {
    const map = new Map<string, LibraryItem[]>();
    for (const item of watched) {
      const date = new Date(item.addedAt);
      const key = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [watched]);

  return (
    <main className="screen screen--history">
      <header className="app-bar">
        <Link className="icon-btn-glass" to="/profile" aria-label="Voltar">
          <ChevronLeft size={20} strokeWidth={1.8} />
        </Link>
        <h1>Histórico</h1>
        <span />
      </header>

      <div className="stats-row">
        <div className="stat-card stat-card--accent-soft">
          <strong>{watched.length}</strong>
          <span>Assistidos</span>
        </div>
        <div className="stat-card">
          <strong>
            {totalHours}
            <small>h</small>
          </strong>
          <span>No total</span>
        </div>
        <div className="stat-card">
          <strong>{avgRating}</strong>
          <span>Nota média</span>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">Nenhum filme assistido ainda.</div>
      ) : (
        groups.map(([label, items]) => (
          <section key={label} className="history-group">
            <p className="overline">{label.toUpperCase()}</p>
            {items.map((item) => (
              <Link key={item.movie.id} className="history-row" to={`/movies/${item.movie.id}`}>
                {item.movie.posterUrl ? (
                  <img src={item.movie.posterUrl} alt="" />
                ) : (
                  <div className="history-row__poster-empty" />
                )}
                <div>
                  <strong>{item.movie.title}</strong>
                  <p>
                    {new Date(item.addedAt).toLocaleDateString('pt-BR')} · {formatRuntime(item.movie.runtime)}
                  </p>
                  <div className="history-stars" aria-label="Sua nota">
                    {'★★★★★'}
                  </div>
                </div>
                <button type="button" className="icon-btn-ghost" aria-label="Opções" onClick={(e) => e.preventDefault()}>
                  <MoreHorizontal size={18} />
                </button>
              </Link>
            ))}
          </section>
        ))
      )}
    </main>
  );
}
