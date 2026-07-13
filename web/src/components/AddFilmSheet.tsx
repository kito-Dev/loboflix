import { useEffect, useState } from 'react';
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Plus, Search, Tv, X } from 'lucide-react';
import { api, formatRuntime } from '../api/client';
import type { Episode, MovieSearchResult, ScheduleConfig, SeriesDetail } from '../api/types';
import { useApp } from '../context/AppContext';
import { DEFAULT_SCHEDULE_CONFIG, validateMovieForNight } from '../utils/schedule';

export function AddFilmSheet() {
  const { addFilmOpen, closeAddFilm, notifyCalendarChange, scheduleNightTarget } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieSearchResult[]>([]);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [addedEpisodes, setAddedEpisodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
  const [dayEntries, setDayEntries] = useState<Awaited<ReturnType<typeof api.getCalendar>>>([]);

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [seasonBusy, setSeasonBusy] = useState<'library' | 'schedule' | null>(null);

  useEffect(() => {
    if (!addFilmOpen) return;
    api.getScheduleConfig().then(setScheduleConfig).catch(() => setScheduleConfig(DEFAULT_SCHEDULE_CONFIG));
    if (scheduleNightTarget) {
      api
        .getCalendar(scheduleNightTarget.date, scheduleNightTarget.date)
        .then(setDayEntries)
        .catch(() => setDayEntries([]));
    } else {
      setDayEntries([]);
    }
  }, [addFilmOpen, scheduleNightTarget]);

  useEffect(() => {
    if (!addFilmOpen) {
      setQuery('');
      setResults([]);
      setAdded(new Set());
      setAddedEpisodes(new Set());
      setError(null);
      setSeries(null);
      setActiveSeason(null);
      setEpisodes([]);
      return;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [addFilmOpen]);

  useEffect(() => {
    if (!addFilmOpen || series || query.trim().length < 2) {
      if (!series) setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await api.searchMovies(query.trim()));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [addFilmOpen, query, series]);

  if (!addFilmOpen) return null;

  async function handleAdd(tmdbId: number) {
    setError(null);
    const item = await api.addToLibrary(tmdbId);
    setAdded((current) => new Set(current).add(tmdbId));
    try {
      if (scheduleNightTarget) {
        const validationError = validateMovieForNight(
          dayEntries,
          item.movie.runtime,
          scheduleConfig,
          scheduleNightTarget.date,
        );
        if (validationError) {
          setError(validationError);
          return;
        }
        await api.scheduleMovie(item.movie.id, scheduleNightTarget.date, scheduleNightTarget.time);
      } else {
        await api.generateCalendar(4);
      }
      notifyCalendarChange();
      closeAddFilm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível agendar este filme.');
    }
  }

  async function openSeries(tmdbId: number) {
    setError(null);
    setSeriesLoading(true);
    try {
      const detail = await api.getSeries(tmdbId);
      setSeries(detail);
      const firstSeason = detail.seasons[0]?.seasonNumber ?? null;
      if (firstSeason !== null) {
        await loadSeason(tmdbId, firstSeason);
      }
    } catch {
      setError('Não foi possível carregar a série.');
    } finally {
      setSeriesLoading(false);
    }
  }

  async function loadSeason(tmdbId: number, seasonNumber: number) {
    setActiveSeason(seasonNumber);
    setEpisodesLoading(true);
    try {
      setEpisodes(await api.getSeason(tmdbId, seasonNumber));
    } catch {
      setEpisodes([]);
    } finally {
      setEpisodesLoading(false);
    }
  }

  async function handleAddEpisode(ep: Episode) {
    setError(null);
    const key = `${ep.seasonNumber}-${ep.episodeNumber}`;
    try {
      const content = await api.ensureEpisode(ep.seriesTmdbId, ep.seasonNumber, ep.episodeNumber);
      await api.addContentToLibrary(content.id);
      if (scheduleNightTarget) {
        const validationError = validateMovieForNight(
          dayEntries,
          content.runtime,
          scheduleConfig,
          scheduleNightTarget.date,
        );
        if (validationError) {
          setError(validationError);
          return;
        }
        await api.scheduleMovie(content.id, scheduleNightTarget.date, scheduleNightTarget.time);
        notifyCalendarChange();
        closeAddFilm();
        return;
      }
      setAddedEpisodes((current) => new Set(current).add(key));
      notifyCalendarChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar o episódio.');
    }
  }

  async function handleAddSeason() {
    if (!series || activeSeason == null) return;
    setError(null);
    setSeasonBusy('library');
    try {
      const items = await api.addSeasonToLibrary(series.tmdbId, activeSeason);
      setAddedEpisodes((current) => {
        const next = new Set(current);
        items.forEach((item) => {
          if (item.movie.seasonNumber != null && item.movie.episodeNumber != null) {
            next.add(`${item.movie.seasonNumber}-${item.movie.episodeNumber}`);
          }
        });
        return next;
      });
      notifyCalendarChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar a temporada.');
    } finally {
      setSeasonBusy(null);
    }
  }

  async function handleScheduleSeason() {
    if (!series || activeSeason == null) return;
    setError(null);
    setSeasonBusy('schedule');
    try {
      await api.scheduleSeason(series.tmdbId, activeSeason);
      notifyCalendarChange();
      closeAddFilm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível agendar a temporada.');
    } finally {
      setSeasonBusy(null);
    }
  }

  function backToSearch() {
    setSeries(null);
    setActiveSeason(null);
    setEpisodes([]);
    setError(null);
    setSeasonBusy(null);
  }

  return (
    <div className="overlay-sheet" role="dialog" aria-modal="true" aria-label="Adicionar título">
      <div className="overlay-sheet__header">
        {series ? (
          <button type="button" className="overlay-sheet__back" onClick={backToSearch} aria-label="Voltar">
            <ChevronLeft size={18} strokeWidth={2} />
            Voltar
          </button>
        ) : (
          <h1 className="overlay-sheet__title">Adicionar título</h1>
        )}
        <button type="button" className="overlay-sheet__cancel" onClick={closeAddFilm}>
          Cancelar
        </button>
      </div>

      {series ? (
        <div className="overlay-sheet__body scroll-y">
          <div className="series-head">
            {series.posterUrl ? (
              <img className="series-head__poster" src={series.posterUrl} alt="" />
            ) : (
              <div className="series-head__poster series-head__poster--empty" />
            )}
            <div className="series-head__info">
              <span className="series-head__kind">
                <Tv size={13} strokeWidth={1.8} /> Série
              </span>
              <strong>{series.title}</strong>
              <p>
                {series.year ?? '—'}
                {series.rating ? ` · ★ ${series.rating.toFixed(1)}` : ''}
              </p>
            </div>
          </div>

          <div className="season-tabs">
            {series.seasons.map((season) => (
              <button
                key={season.seasonNumber}
                type="button"
                className={`chip${activeSeason === season.seasonNumber ? ' chip--active' : ''}`}
                onClick={() => loadSeason(series.tmdbId, season.seasonNumber)}
              >
                {season.seasonNumber === 0 ? 'Especiais' : `T${season.seasonNumber}`}
              </button>
            ))}
          </div>

          {activeSeason != null ? (
            <div className="season-actions">
              <button
                type="button"
                className="btn btn-secondary season-actions__btn"
                onClick={handleAddSeason}
                disabled={seasonBusy !== null || episodesLoading}
              >
                <Plus size={16} strokeWidth={2} />
                {seasonBusy === 'library' ? 'Adicionando...' : 'Adicionar temporada'}
              </button>
              <button
                type="button"
                className="btn btn-primary season-actions__btn"
                onClick={handleScheduleSeason}
                disabled={seasonBusy !== null || episodesLoading}
              >
                <CalendarPlus size={16} strokeWidth={2} />
                {seasonBusy === 'schedule' ? 'Agendando...' : 'Agendar temporada'}
              </button>
            </div>
          ) : null}
          <p className="season-actions__hint">
            Agendar distribui os episódios pelos próximos dias livres, um por noite.
          </p>

          {episodesLoading ? <p className="results-overline">Carregando episódios...</p> : null}

          <div className="episode-list">
            {episodes.map((ep) => {
              const key = `${ep.seasonNumber}-${ep.episodeNumber}`;
              const isAdded = addedEpisodes.has(key);
              return (
                <article key={key} className="episode-row">
                  <div className="episode-row__num">{ep.episodeNumber}</div>
                  <div className="episode-row__body">
                    <strong>{ep.name}</strong>
                    <p>{ep.runtime > 0 ? formatRuntime(ep.runtime) : 'Duração —'}</p>
                  </div>
                  <button
                    type="button"
                    className={`search-result__action${isAdded ? ' search-result__action--done' : ''}`}
                    onClick={() => handleAddEpisode(ep)}
                    disabled={isAdded}
                    aria-label={isAdded ? 'Adicionado' : 'Adicionar episódio'}
                  >
                    {isAdded ? <Check size={19} strokeWidth={2.4} /> : <Plus size={20} strokeWidth={2.2} />}
                  </button>
                </article>
              );
            })}
          </div>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      ) : (
        <>
          <div className="search-field search-field--active">
            <Search size={18} strokeWidth={1.7} className="search-field__icon" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar filme ou série..."
              aria-label="Buscar título"
            />
            {query ? (
              <button type="button" className="search-field__clear" onClick={() => setQuery('')} aria-label="Limpar">
                <X size={12} strokeWidth={2.4} />
              </button>
            ) : null}
          </div>

          <div className="overlay-sheet__body scroll-y">
            {(loading || seriesLoading) ? <p className="results-overline">Buscando...</p> : null}
            {!loading && results.length > 0 ? (
              <p className="results-overline">{results.length} RESULTADOS</p>
            ) : null}

            <div className="search-results">
              {results.map((result) => {
                const isSeries = result.mediaType === 'tv';
                const isAdded = added.has(result.tmdbId);
                return (
                  <article
                    key={`${result.mediaType}-${result.tmdbId}`}
                    className={`search-result${isAdded ? ' search-result--added' : ''}`}
                  >
                    {result.posterUrl ? (
                      <img className="search-result__poster" src={result.posterUrl} alt="" />
                    ) : (
                      <div className="search-result__poster search-result__poster--empty" />
                    )}
                    <div className="search-result__body">
                      <strong>{result.title}</strong>
                      <p>
                        {result.year ?? '—'}
                        {result.rating ? ` · ${result.rating.toFixed(1)}` : ''}
                      </p>
                      <div className="search-result__chips">
                        {isSeries ? (
                          <span className="media-chip">
                            <Tv size={12} strokeWidth={1.8} /> Série
                          </span>
                        ) : null}
                        {result.rating ? (
                          <span className="rating-chip rating-chip--imdb rating-chip--compact">
                            ★ {result.rating.toFixed(1)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {isSeries ? (
                      <button
                        type="button"
                        className="search-result__action search-result__action--browse"
                        onClick={() => openSeries(result.tmdbId)}
                        aria-label="Ver temporadas"
                      >
                        <ChevronRight size={20} strokeWidth={2.2} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`search-result__action${isAdded ? ' search-result__action--done' : ''}`}
                        onClick={() => handleAdd(result.tmdbId)}
                        disabled={isAdded}
                        aria-label={isAdded ? 'Adicionado' : 'Adicionar'}
                      >
                        {isAdded ? <Check size={19} strokeWidth={2.4} /> : <Plus size={20} strokeWidth={2.2} />}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="search-hint">
              <span aria-hidden="true">ℹ</span>
              {scheduleNightTarget
                ? 'O título será adicionado à noite selecionada, respeitando seus ajustes.'
                : 'Séries abrem a lista de episódios. Ao adicionar, encaixamos numa noite livre conforme seus ajustes.'}
            </div>
            {error ? <p className="form-error">{error}</p> : null}
          </div>
        </>
      )}
    </div>
  );
}
