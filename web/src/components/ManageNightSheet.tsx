import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Plus, X } from 'lucide-react';
import { api, formatRuntime } from '../api/client';
import type { CalendarEntry, LibraryItem, ScheduleConfig } from '../api/types';
import { useApp } from '../context/AppContext';
import {
  formatLongDate,
  isNightFull,
  remainingNightMinutes,
  sortEntriesByTime,
  suggestNextSlot,
  validateMovieForNight,
} from '../utils/schedule';
import { contentTitle, movieMeta } from '../utils/movie';

type Props = {
  open: boolean;
  date: string;
  config: ScheduleConfig;
  onClose: () => void;
};

export function ManageNightSheet({ open, date, config, onClose }: Props) {
  const { notifyCalendarChange } = useApp();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [nightEntries, lib] = await Promise.all([api.getCalendar(date, date), api.getLibrary()]);
    setEntries(sortEntriesByTime(nightEntries));
    setLibrary(lib);
  }, [date]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    reload().finally(() => setLoading(false));
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, reload]);

  if (!open) return null;

  const pendingEntries = entries.filter((entry) => entry.status === 'Pending');
  const scheduledMovieIds = new Set(entries.map((entry) => entry.movie.id));
  const candidates = library.filter(
    (item) => item.status !== 'Watched' && !scheduledMovieIds.has(item.movie.id),
  );
  const nightFull = isNightFull(pendingEntries, config);
  const remaining = Math.max(0, remainingNightMinutes(pendingEntries, config));
  const nextSlot = suggestNextSlot(pendingEntries, config);

  async function handleAdd(item: LibraryItem) {
    setError(null);
    const validationError = validateMovieForNight(pendingEntries, item.movie.runtime, config, date);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusyId(item.movie.id);
    try {
      await api.scheduleMovie(item.movie.id, date, suggestNextSlot(pendingEntries, config));
      await reload();
      notifyCalendarChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar à noite.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(entryId: string) {
    setError(null);
    setBusyId(entryId);
    try {
      await api.unschedule(entryId);
      await reload();
      notifyCalendarChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover da noite.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="manage-night" role="dialog" aria-modal="true" aria-label="Gerenciar noite">
      <button type="button" className="manage-night__backdrop" onClick={onClose} aria-label="Fechar" />
      <div className="manage-night__sheet">
        <div className="manage-night__handle" aria-hidden="true" />
        <h2 className="manage-night__title">Gerenciar noite</h2>
        <p className="manage-night__subtitle">{formatLongDate(date)}</p>

        <div className="manage-night__body scroll-y">
          {loading ? (
            <p className="results-overline">Carregando...</p>
          ) : (
            <>
              <p className="manage-night__section-label">Slots da noite</p>
              <div className="slot-list">
                {entries.map((entry) => {
                  const isWatched = entry.status === 'Watched';
                  return (
                    <div key={entry.entryId} className={`slot-row${isWatched ? ' slot-row--watched' : ''}`}>
                      <span className="slot-row__time">
                        <Clock size={13} strokeWidth={1.8} />
                        {entry.time ?? config.nightStartTime}
                      </span>
                      {entry.movie.posterUrl ? (
                        <img className="slot-row__poster" src={entry.movie.posterUrl} alt="" />
                      ) : (
                        <div className="slot-row__poster slot-row__poster--empty" />
                      )}
                      <div className="slot-row__info">
                        <strong>{contentTitle(entry.movie)}</strong>
                        <span>{isWatched ? 'Assistido' : movieMeta(entry.movie)}</span>
                      </div>
                      {isWatched ? (
                        <span className="slot-row__watched">
                          <Check size={16} strokeWidth={2.4} />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="slot-row__remove"
                          onClick={() => handleRemove(entry.entryId)}
                          disabled={busyId === entry.entryId}
                          aria-label="Remover da noite"
                        >
                          <X size={16} strokeWidth={2.2} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {!nightFull ? (
                  <div className="slot-row slot-row--empty">
                    <span className="slot-row__time slot-row__time--free">
                      <Clock size={13} strokeWidth={1.8} />
                      {nextSlot}
                    </span>
                    <span className="slot-row__empty-label">
                      Slot livre · {formatRuntime(remaining)} restantes
                    </span>
                  </div>
                ) : null}
              </div>

              {error ? <p className="form-error">{error}</p> : null}

              <p className="manage-night__section-label">Adicionar da watch list</p>
              {nightFull ? (
                <p className="manage-night__hint">
                  Esta noite atingiu o limite de horas. Remova um título para liberar tempo.
                </p>
              ) : candidates.length === 0 ? (
                <p className="manage-night__hint">
                  Nenhum filme disponível na watch list. Adicione títulos primeiro.
                </p>
              ) : (
                <div className="pick-list">
                  {candidates.map((item) => {
                    const cantFit = Boolean(
                      validateMovieForNight(pendingEntries, item.movie.runtime, config, date),
                    );
                    return (
                      <article
                        key={item.movie.id}
                        className={`pick-row${cantFit ? ' pick-row--disabled' : ''}`}
                      >
                        {item.movie.posterUrl ? (
                          <img className="pick-row__poster" src={item.movie.posterUrl} alt="" />
                        ) : (
                          <div className="pick-row__poster pick-row__poster--empty" />
                        )}
                        <div className="pick-row__info">
                          <strong>{contentTitle(item.movie)}</strong>
                          <span>{cantFit ? `${movieMeta(item.movie)} · não cabe` : movieMeta(item.movie)}</span>
                        </div>
                        <button
                          type="button"
                          className="pick-row__add"
                          onClick={() => handleAdd(item)}
                          disabled={busyId === item.movie.id || cantFit}
                          aria-label={`Adicionar ${item.movie.title} à noite`}
                        >
                          <Plus size={18} strokeWidth={2.2} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
