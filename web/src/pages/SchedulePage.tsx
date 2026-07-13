import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Filter, Play, Plus, Check, CalendarClock, Sparkles } from 'lucide-react';
import { api, formatRuntime } from '../api/client';
import type { CalendarEntry, ScheduleConfig } from '../api/types';
import { ManageNightSheet } from '../components/ManageNightSheet';
import { StreamingPill } from '../components/StreamingPill';
import { WeekStrip, buildWeekDays } from '../components/WeekStrip';
import { useApp } from '../context/AppContext';
import { addDaysToDateKey, isPastDateKey, localTodayKey, parseLocalDate } from '../utils/date';
import { contentTitle, episodeTag, imdbScore, shortGenre } from '../utils/movie';
import {
  DEFAULT_SCHEDULE_CONFIG,
  formatLongDate,
  isDayAllowed,
  isNightFull,
  sortEntriesByTime,
} from '../utils/schedule';

function formatTimelineTime(time?: string | null, fallback = '19:00') {
  return time ?? fallback;
}

export function SchedulePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { openTrailer, calendarVersion, notifyCalendarChange } = useApp();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [actionEntryId, setActionEntryId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const selectedDate = searchParams.get('date') ?? localTodayKey();
  const activeDate = parseLocalDate(selectedDate);
  const isToday = selectedDate === localTodayKey();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const from = addDaysToDateKey(localTodayKey(), -14);
        const to = addDaysToDateKey(localTodayKey(), 84);
        const [data, config] = await Promise.all([
          api.getCalendar(from, to),
          api.getScheduleConfig().catch(() => DEFAULT_SCHEDULE_CONFIG),
        ]);
        if (!cancelled) {
          setEntries(data);
          setScheduleConfig(config);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [calendarVersion]);

  const scheduledDates = useMemo(() => new Set(entries.map((entry) => entry.date)), [entries]);
  const weekDays = useMemo(
    () =>
      buildWeekDays(activeDate, scheduledDates).map((day) => ({
        ...day,
        isDisabled: !isPastDateKey(day.dateKey) && !isDayAllowed(day.dateKey, scheduleConfig),
      })),
    [activeDate, scheduledDates, scheduleConfig],
  );

  useEffect(() => {
    if (loading) return;
    if (isPastDateKey(selectedDate)) return;
    if (!isDayAllowed(selectedDate, scheduleConfig)) {
      const fallback = weekDays.find((day) => !day.isDisabled);
      if (fallback && fallback.dateKey !== selectedDate) {
        navigate(`/schedule?date=${fallback.dateKey}`, { replace: true });
      }
    }
  }, [loading, selectedDate, scheduleConfig, weekDays, navigate]);

  const weekRangeLabel = useMemo(() => {
    const first = weekDays[0]?.date;
    const last = weekDays[weekDays.length - 1]?.date;
    if (!first || !last) return '';
    const firstMonth = first.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const lastMonth = last.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    if (firstMonth === lastMonth) {
      return `${first.getDate()} – ${last.getDate()} de ${lastMonth}`;
    }
    return `${first.getDate()} ${firstMonth} – ${last.getDate()} ${lastMonth}`;
  }, [weekDays]);

  const dayEntries = useMemo(
    () => sortEntriesByTime(entries.filter((entry) => entry.date === selectedDate)),
    [entries, selectedDate],
  );
  const pendingDayEntries = useMemo(
    () => dayEntries.filter((entry) => entry.status === 'Pending'),
    [dayEntries],
  );
  const nightFullMessage = isNightFull(pendingDayEntries, scheduleConfig)
    ? 'Esta noite atingiu o limite de horas.'
    : null;

  async function reloadEntries() {
    const from = addDaysToDateKey(localTodayKey(), -14);
    const to = addDaysToDateKey(localTodayKey(), 84);
    const data = await api.getCalendar(from, to);
    setEntries(data);
  }

  function shiftWeek(deltaDays: number) {
    navigate(`/schedule?date=${addDaysToDateKey(selectedDate, deltaDays)}`);
  }

  async function handleMarkWatched(entryId: string) {
    setActionEntryId(entryId);
    try {
      await api.markWatched(entryId);
      await reloadEntries();
      notifyCalendarChange();
    } finally {
      setActionEntryId(null);
    }
  }

  async function handlePostpone(entryId: string) {
    setActionEntryId(entryId);
    try {
      await api.postpone(entryId);
      await reloadEntries();
      notifyCalendarChange();
    } finally {
      setActionEntryId(null);
    }
  }

  if (loading) return <main className="screen empty-state">Carregando...</main>;

  return (
    <main className="screen screen--schedule">
      <header className="screen-header">
        <p className="overline">
          {activeDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
        </p>
        <div className="screen-header__row">
          <h1 className="screen-title">Agenda</h1>
          <button type="button" className="icon-btn-surface" aria-label="Filtrar">
            <Filter size={20} strokeWidth={1.6} />
          </button>
        </div>
      </header>

      <div className="week-nav">
        <button
          type="button"
          className="week-nav__btn"
          onClick={() => shiftWeek(-7)}
          aria-label="Semana anterior"
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <span className="week-nav__label">{weekRangeLabel}</span>
        <button
          type="button"
          className="week-nav__btn"
          onClick={() => shiftWeek(7)}
          aria-label="Próxima semana"
        >
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>

      <WeekStrip days={weekDays} title="" onSelect={(day) => navigate(`/schedule?date=${day.dateKey}`)} />

      <button type="button" className="build-cta" onClick={() => navigate('/schedule/build')}>
        <span className="build-cta__icon" aria-hidden="true">
          <Sparkles size={18} strokeWidth={1.8} />
        </span>
        <span className="build-cta__text">
          <strong>Montar agenda</strong>
          <span>Priorize sua watch list em 1 minuto</span>
        </span>
        <ChevronRight size={18} className="build-cta__chevron" />
      </button>

      <div className="section-header">
        <h2 className="section-title">Sua noite</h2>
        <div className="section-header__actions">
          <button
            type="button"
            className="section-link section-link--button"
            onClick={() => setManageOpen(true)}
          >
            Gerenciar
          </button>
        </div>
      </div>

      <div className="night-timeline">
        {dayEntries.map((entry, index) => {
          const isBusy = actionEntryId === entry.entryId;
          const isWatched = entry.status === 'Watched';
          const isFeatured = index === 0;
          const isActiveSlot = !isWatched && entry.entryId === pendingDayEntries[0]?.entryId;
          return (
          <div key={entry.entryId} className="night-timeline__row">
            <div className="night-timeline__rail">
              <span
                className={`night-timeline__time${
                  isActiveSlot ? ' night-timeline__time--active' : ''
                }${isWatched ? ' night-timeline__time--watched' : ''}`}
              >
                {formatTimelineTime(entry.time, scheduleConfig.nightStartTime)}
              </span>
              <span
                className={`night-timeline__dot${
                  isActiveSlot ? ' night-timeline__dot--active' : ''
                }${isWatched ? ' night-timeline__dot--watched' : ''}`}
              />
              <span className="night-timeline__line" />
            </div>

            {isFeatured ? (
              <article className={`night-card night-card--featured${isWatched ? ' night-card--watched' : ''}`}>
                <div
                  className="night-card__banner"
                  style={{
                    backgroundImage: `url(${entry.movie.backdropUrl ?? entry.movie.posterUrl ?? ''})`,
                  }}
                >
                  <span className={`night-card__badge${isWatched ? ' night-card__badge--watched' : ''}`}>
                    {isWatched ? 'Assistido' : isToday ? 'Hoje à noite' : formatLongDate(selectedDate)}
                  </span>
                </div>
                <div className="night-card__body">
                  <h3>{contentTitle(entry.movie)}</h3>
                  {episodeTag(entry.movie) ? (
                    <p className="night-card__episode">
                      {episodeTag(entry.movie)} · {entry.movie.title}
                    </p>
                  ) : null}
                  <div className="night-card__meta">
                    <span>
                      <Clock size={14} strokeWidth={1.5} />
                      {formatRuntime(entry.movie.runtime)}
                    </span>
                    {entry.movie.watchProviders[0] ? (
                      <StreamingPill name={entry.movie.watchProviders[0].name} />
                    ) : null}
                  </div>
                  {isWatched ? (
                    <div className="night-card__watched-status">
                      <Check size={16} strokeWidth={2.4} />
                      Você assistiu este filme
                    </div>
                  ) : (
                  <div className="night-card__schedule-actions">
                    <button
                      type="button"
                      className="btn btn-hero btn-block"
                      onClick={() => {
                        if (entry.movie.trailerYoutubeKey) {
                          openTrailer({
                            youtubeKey: entry.movie.trailerYoutubeKey,
                            title: entry.movie.title,
                            backdropUrl: entry.movie.backdropUrl ?? entry.movie.posterUrl,
                          });
                        } else {
                          navigate(`/movies/${entry.movie.id}`);
                        }
                      }}
                    >
                      <Play size={16} fill="currentColor" />
                      Começar a assistir
                    </button>
                    <div className="night-card__secondary-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleMarkWatched(entry.entryId)}
                        disabled={isBusy}
                      >
                        <Check size={16} strokeWidth={2} />
                        {isBusy ? 'Salvando...' : 'Já assisti'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handlePostpone(entry.entryId)}
                        disabled={isBusy}
                      >
                        <CalendarClock size={16} strokeWidth={1.8} />
                        Adiar
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              </article>
            ) : (
              <div className={`night-card night-card--compact-wrap${isWatched ? ' night-card--compact-wrap--watched' : ''}`}>
              <Link className={`night-card night-card--compact${isWatched ? ' night-card--watched' : ''}`} to={`/movies/${entry.movie.id}`}>
                {entry.movie.posterUrl ? (
                  <img src={entry.movie.posterUrl} alt="" />
                ) : (
                  <div className="night-card__poster-empty" />
                )}
                <div className="night-card__info">
                  <strong>{contentTitle(entry.movie)}</strong>
                  <p>
                    {episodeTag(entry.movie) ? `${episodeTag(entry.movie)} · ` : ''}
                    {formatRuntime(entry.movie.runtime)}
                    {!episodeTag(entry.movie) && entry.movie.genres[0]
                      ? ` · ${shortGenre(entry.movie.genres[0])}`
                      : ''}
                  </p>
                  <div className="night-card__chips">
                    {imdbScore(entry.movie) ? (
                      <span className="night-card__rating">★ {imdbScore(entry.movie)}</span>
                    ) : null}
                    {entry.movie.watchProviders[0] ? (
                      <StreamingPill name={entry.movie.watchProviders[0].name} />
                    ) : null}
                  </div>
                </div>
                <ChevronRight size={18} className="night-card__chevron" />
              </Link>
              {!isWatched ? (
              <div className="night-card__compact-actions">
                <button
                  type="button"
                  className="night-card__icon-action"
                  onClick={() => handleMarkWatched(entry.entryId)}
                  disabled={isBusy}
                  aria-label="Marcar como assistido"
                >
                  <Check size={15} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className="night-card__icon-action"
                  onClick={() => handlePostpone(entry.entryId)}
                  disabled={isBusy}
                  aria-label="Adiar filme"
                >
                  <CalendarClock size={15} strokeWidth={1.8} />
                </button>
              </div>
              ) : (
                <div className="night-card__watched-pill">
                  <Check size={13} strokeWidth={2.4} />
                  Assistido
                </div>
              )}
              </div>
            )}
          </div>
        );
        })}

        <div className="night-timeline__row night-timeline__row--add">
          <div className="night-timeline__rail night-timeline__rail--end">
            <span className="night-timeline__time night-timeline__time--free">Livre</span>
            <span className="night-timeline__dot" />
          </div>
          {nightFullMessage ? (
            <div className="add-slot add-slot--full" role="status">
              {nightFullMessage}
            </div>
          ) : (
            <button
              type="button"
              className="add-slot"
              onClick={() => setManageOpen(true)}
            >
              <Plus size={18} strokeWidth={1.8} />
              Adicionar filme a esta noite
            </button>
          )}
        </div>
      </div>

      <ManageNightSheet
        open={manageOpen}
        date={selectedDate}
        config={scheduleConfig}
        onClose={() => setManageOpen(false)}
      />
    </main>
  );
}
