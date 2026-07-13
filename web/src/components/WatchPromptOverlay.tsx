import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { api, formatRuntime } from '../api/client';
import type { CalendarEntry } from '../api/types';
import { useApp } from '../context/AppContext';
import { StreamingPill } from './StreamingPill';
import { addDaysToDateKey, localTodayKey } from '../utils/date';
import { getWatchPromptDismissKey, isEntryOverdue } from '../utils/schedule';
import { imdbScore, movieYear, shortGenre } from '../utils/movie';

export function WatchPromptOverlay() {
  const { calendarVersion, notifyCalendarChange } = useApp();
  const [entry, setEntry] = useState<CalendarEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const from = addDaysToDateKey(localTodayKey(), -14);
        const to = localTodayKey();
        const entries = await api.getCalendar(from, to);
        const overdue = entries.find((item) => {
          if (sessionStorage.getItem(getWatchPromptDismissKey(item.entryId))) return false;
          return isEntryOverdue(item);
        });

        if (cancelled) return;
        setEntry(overdue ?? null);
      } catch {
        if (!cancelled) setEntry(null);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [calendarVersion]);

  useEffect(() => {
    if (!entry) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [entry]);

  if (!entry) return null;

  const activeEntry = entry;
  const movie = activeEntry.movie;
  const backdrop = movie.backdropUrl ?? movie.posterUrl ?? '';

  function dismissPrompt(entryId: string) {
    sessionStorage.setItem(getWatchPromptDismissKey(entryId), '1');
    setEntry(null);
  }

  async function handleWatched() {
    setLoading(true);
    setError(null);
    try {
      await api.markWatched(activeEntry.entryId);
      notifyCalendarChange();
      dismissPrompt(activeEntry.entryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível marcar como assistido.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePostpone() {
    setLoading(true);
    setError(null);
    try {
      await api.postpone(activeEntry.entryId);
      notifyCalendarChange();
      dismissPrompt(activeEntry.entryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adiar o filme.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="watch-prompt" role="dialog" aria-modal="true" aria-label="Filme de hoje">
      <div className="watch-prompt__overlay" aria-hidden="true" />

      <div className="watch-prompt__dialog">
        <div
          className="watch-prompt__banner"
          style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}
        >
          <span className="watch-prompt__badge">Passou do horário</span>
        </div>

        <div className="watch-prompt__body">
          <h2 className="watch-prompt__title">{movie.title}</h2>

          <div className="watch-prompt__meta">
            {imdbScore(movie) ? <span>★ {imdbScore(movie)}</span> : null}
            {movieYear(movie.releaseDate) ? <span>{movieYear(movie.releaseDate)}</span> : null}
            <span>
              <Clock size={14} strokeWidth={1.5} />
              {formatRuntime(movie.runtime)}
            </span>
            {movie.genres[0] ? <span>{shortGenre(movie.genres[0])}</span> : null}
            {movie.watchProviders[0] ? <StreamingPill name={movie.watchProviders[0].name} /> : null}
          </div>

          {movie.overview ? <p className="watch-prompt__overview">{movie.overview}</p> : null}

          {error ? <p className="form-error">{error}</p> : null}

          <button type="button" className="btn btn-primary btn-block" onClick={handleWatched} disabled={loading}>
            {loading ? 'Salvando...' : 'Já assisti'}
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={handlePostpone} disabled={loading}>
            Adiar para próximo horário
          </button>
        </div>
      </div>
    </div>
  );
}
