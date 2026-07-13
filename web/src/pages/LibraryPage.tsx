import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, LayoutGrid, Search, Star, Tv, X } from 'lucide-react';
import { api } from '../api/client';
import type { LibraryItem } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useApp } from '../context/AppContext';
import { contentTitle, imdbScore, movieMeta } from '../utils/movie';

const FILTERS = ['Todos', 'Não vistos', 'Assistidos', 'Drama', 'Ficção', 'Menos de 2h', 'Netflix'] as const;

type GridCard =
  | { kind: 'movie'; key: string; item: LibraryItem }
  | {
      kind: 'series';
      key: string;
      seriesTmdbId: number;
      title: string;
      posterUrl?: string | null;
      episodes: LibraryItem[];
    };

function groupCards(items: LibraryItem[]): GridCard[] {
  const cards: GridCard[] = [];
  const seriesIndex = new Map<number, Extract<GridCard, { kind: 'series' }>>();

  for (const item of items) {
    const isEpisode = item.movie.mediaType === 'episode' && item.movie.seriesTmdbId != null;
    if (isEpisode) {
      const sid = item.movie.seriesTmdbId as number;
      let card = seriesIndex.get(sid);
      if (!card) {
        card = {
          kind: 'series',
          key: `series-${sid}`,
          seriesTmdbId: sid,
          title: item.movie.seriesTitle ?? item.movie.title,
          posterUrl: item.movie.posterUrl,
          episodes: [],
        };
        seriesIndex.set(sid, card);
        cards.push(card);
      }
      card.episodes.push(item);
    } else {
      cards.push({ kind: 'movie', key: `movie-${item.movie.id}`, item });
    }
  }

  return cards;
}

function SeriesCard({ card }: { card: Extract<GridCard, { kind: 'series' }> }) {
  const to = `/series/${card.seriesTmdbId}`;
  const count = card.episodes.length;
  return (
    <article className="library-card">
      <div className="library-card__poster-wrap">
        <Link className="library-card__poster library-card__poster--idle" to={to}>
          {card.posterUrl ? (
            <img src={card.posterUrl} alt={card.title} loading="lazy" />
          ) : (
            <div className="library-card__placeholder" />
          )}
          <span className="library-card__series-badge">
            <Tv size={11} strokeWidth={2} />
            {count}
          </span>
          <span className="library-card__bar library-card__bar--idle" />
        </Link>
      </div>
      <Link className="library-card__text" to={to}>
        <div className="library-card__title">
          {card.title}
          <ChevronRight size={14} strokeWidth={2.2} className="library-card__title-icon" />
        </div>
        <div className="library-card__meta">
          Série · {count} episódio{count === 1 ? '' : 's'}
        </div>
      </Link>
    </article>
  );
}

function LibraryCard({
  item,
  isRemoving,
  onRemove,
}: {
  item: LibraryItem;
  isRemoving: boolean;
  onRemove: (item: LibraryItem) => void;
}) {
  const status = item.status === 'Watched' ? 'watched' : item.status === 'Scheduled' ? 'scheduled' : 'idle';

  return (
    <article className="library-card">
      <div className="library-card__poster-wrap">
        <Link className={`library-card__poster library-card__poster--${status}`} to={`/movies/${item.movie.id}`}>
          {item.movie.posterUrl ? (
            <img src={item.movie.posterUrl} alt={item.movie.title} loading="lazy" />
          ) : (
            <div className="library-card__placeholder" />
          )}
          {imdbScore(item.movie) ? <span className="library-card__rating">★ {imdbScore(item.movie)}</span> : null}
          <span className={`library-card__bar library-card__bar--${status}`} />
        </Link>
        {status !== 'watched' ? (
          <button
            type="button"
            className="library-card__action"
            onClick={() => onRemove(item)}
            disabled={isRemoving}
            aria-label={`Remover ${item.movie.title} da watch list`}
          >
            <X size={13} strokeWidth={2.4} />
          </button>
        ) : null}
      </div>
      <Link className="library-card__text" to={`/movies/${item.movie.id}`}>
        <div className="library-card__title">
          {contentTitle(item.movie)}
          {status === 'watched' ? (
            <Check size={12} strokeWidth={2.4} className="library-card__title-icon library-card__title-icon--watched" />
          ) : null}
          {status === 'scheduled' ? (
            <Star size={12} fill="currentColor" className="library-card__title-icon library-card__title-icon--scheduled" />
          ) : null}
        </div>
        <div className="library-card__meta">{movieMeta(item.movie)}</div>
      </Link>
    </article>
  );
}

export function LibraryPage() {
  const { openAddFilm, notifyCalendarChange, calendarVersion } = useApp();
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('Todos');
  const [loading, setLoading] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState<LibraryItem | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    api
      .getLibrary()
      .then(setLibrary)
      .catch(() => setLibrary([]))
      .finally(() => setLoading(false));
  }, [calendarVersion]);

  function matchesFilter(item: LibraryItem) {
    const title = `${item.movie.seriesTitle ?? ''} ${item.movie.title}`.toLowerCase();
    const q = query.trim().toLowerCase();
    if (q && !title.includes(q)) return false;

    if (activeFilter === 'Não vistos' && item.status === 'Watched') return false;
    if (activeFilter === 'Assistidos' && item.status !== 'Watched') return false;
    if (activeFilter === 'Drama' && !item.movie.genres.some((g) => g.toLowerCase().includes('drama'))) return false;
    if (activeFilter === 'Ficção' && !item.movie.genres.some((g) => /fic|sci/i.test(g))) return false;
    if (activeFilter === 'Menos de 2h' && item.movie.runtime > 120) return false;
    if (
      activeFilter === 'Netflix' &&
      !item.movie.watchProviders.some((p) => p.name.toLowerCase().includes('netflix'))
    ) {
      return false;
    }
    return true;
  }

  const toWatch = useMemo(
    () => groupCards(library.filter((item) => item.status !== 'Watched' && matchesFilter(item))),
    [library, query, activeFilter],
  );

  const watched = useMemo(
    () => groupCards(library.filter((item) => item.status === 'Watched' && matchesFilter(item))),
    [library, query, activeFilter],
  );

  const totalCards = useMemo(() => groupCards(library).length, [library]);

  const showToWatch = activeFilter !== 'Assistidos';
  const showWatched = activeFilter === 'Todos' || activeFilter === 'Assistidos';

  async function handleRemove() {
    if (!confirmRemove) return;
    const movieId = confirmRemove.movie.id;
    setRemovingId(movieId);
    try {
      await api.removeFromLibrary(movieId);
      setLibrary((current) => current.filter((item) => item.movie.id !== movieId));
      notifyCalendarChange();
      setConfirmRemove(null);
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) return <main className="screen empty-state">Carregando...</main>;

  if (library.length === 0) {
    return (
      <main className="screen screen--library">
        <header className="library-header">
          <p className="overline overline--muted">0 FILMES</p>
          <h1 className="screen-title">Watch List</h1>
        </header>

        <div className="search-field search-field--disabled">
          <Search size={18} strokeWidth={1.6} />
          <span>Buscar na sua lista</span>
        </div>

        <section className="empty-library">
          <div className="empty-library__art" aria-hidden="true">
            <div className="empty-library__posters" />
            <span className="empty-library__plus">+</span>
          </div>
          <h2>Sua watch list começa aqui</h2>
          <p>Adicione títulos que quer ver e o Loboflix monta noites livres automaticamente.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={openAddFilm}>
            Adicionar primeiro filme
          </button>
          <button type="button" className="btn btn-ghost" onClick={openAddFilm}>
            ou <span className="text-accent">buscar um título</span>
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="screen screen--library">
      <header className="library-header">
        <div className="library-header__row">
          <div>
            <p className="overline">{totalCards} TÍTULOS</p>
            <h1 className="screen-title">Watch List</h1>
          </div>
          <button type="button" className="icon-btn-surface" aria-label="Ordenar">
            <LayoutGrid size={20} strokeWidth={1.6} />
          </button>
        </div>

        <div className="search-field">
          <Search size={18} strokeWidth={1.6} className="search-field__icon" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar na sua lista"
            aria-label="Buscar na watch list"
          />
        </div>

        <div className="chip-row scroll-x">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`chip${activeFilter === filter ? ' chip--active' : ''}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </header>

      {showToWatch ? (
        <section className="library-section">
          {activeFilter === 'Todos' ? <h2 className="library-section__title">Para ver</h2> : null}
          {toWatch.length > 0 ? (
            <div className="library-grid">
              {toWatch.map((card) =>
                card.kind === 'series' ? (
                  <SeriesCard key={card.key} card={card} />
                ) : (
                  <LibraryCard
                    key={card.key}
                    item={card.item}
                    isRemoving={removingId === card.item.movie.id}
                    onRemove={setConfirmRemove}
                  />
                ),
              )}
            </div>
          ) : activeFilter !== 'Todos' ? (
            <p className="library-section__empty">Nenhum filme encontrado.</p>
          ) : null}
        </section>
      ) : null}

      {showWatched && watched.length > 0 ? (
        <section className="library-section">
          <h2 className="library-section__title">Assistidos</h2>
          <div className="library-grid">
            {watched.map((card) =>
              card.kind === 'series' ? (
                <SeriesCard key={card.key} card={card} />
              ) : (
                <LibraryCard
                  key={card.key}
                  item={card.item}
                  isRemoving={removingId === card.item.movie.id}
                  onRemove={setConfirmRemove}
                />
              ),
            )}
          </div>
        </section>
      ) : null}

      {showToWatch && showWatched && toWatch.length === 0 && watched.length === 0 ? (
        <p className="library-section__empty">Nenhum filme encontrado.</p>
      ) : null}

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remover da watch list?"
        message={
          confirmRemove
            ? `"${confirmRemove.movie.title}" será removido da sua watch list e de qualquer noite agendada. Essa ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Remover"
        loading={removingId !== null}
        onConfirm={handleRemove}
        onClose={() => setConfirmRemove(null)}
      />
    </main>
  );
}

