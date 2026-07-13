import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, Check, ChevronLeft, Plus, Tv, X } from 'lucide-react';
import { api, formatRuntime } from '../api/client';
import type { Episode, LibraryItem, SeriesDetail } from '../api/types';
import { useApp } from '../context/AppContext';

export function SeriesDetailPage() {
  const { seriesId } = useParams();
  const sid = Number(seriesId);
  const navigate = useNavigate();
  const { notifyCalendarChange } = useApp();

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [seasonBusy, setSeasonBusy] = useState<'library' | 'schedule' | null>(null);

  useEffect(() => {
    if (!sid) return;
    Promise.all([api.getSeries(sid), api.getLibrary().catch(() => [] as LibraryItem[])])
      .then(([detail, lib]) => {
        setSeries(detail);
        setLibrary(lib);
        const libSeasons = new Set(
          lib
            .filter((item) => item.movie.seriesTmdbId === sid && item.movie.seasonNumber != null)
            .map((item) => item.movie.seasonNumber),
        );
        const first =
          detail.seasons.find((season) => libSeasons.has(season.seasonNumber))?.seasonNumber ??
          detail.seasons[0]?.seasonNumber ??
          null;
        setActiveSeason(first);
      })
      .catch(() => setError('Não foi possível carregar a série.'))
      .finally(() => setLoading(false));
  }, [sid]);

  useEffect(() => {
    if (!sid || activeSeason == null) return;
    setEpisodesLoading(true);
    api
      .getSeason(sid, activeSeason)
      .then(setEpisodes)
      .catch(() => setEpisodes([]))
      .finally(() => setEpisodesLoading(false));
  }, [sid, activeSeason]);

  const libByKey = useMemo(() => {
    const map = new Map<string, LibraryItem>();
    library.forEach((item) => {
      if (
        item.movie.seriesTmdbId === sid &&
        item.movie.seasonNumber != null &&
        item.movie.episodeNumber != null
      ) {
        map.set(`${item.movie.seasonNumber}-${item.movie.episodeNumber}`, item);
      }
    });
    return map;
  }, [library, sid]);

  const inListCount = useMemo(
    () => [...libByKey.keys()].filter((key) => key.startsWith(`${activeSeason}-`)).length,
    [libByKey, activeSeason],
  );

  async function reloadLibrary() {
    const lib = await api.getLibrary().catch(() => [] as LibraryItem[]);
    setLibrary(lib);
  }

  async function handleAddEpisode(ep: Episode) {
    setError(null);
    setBusyKey(`${ep.seasonNumber}-${ep.episodeNumber}`);
    try {
      const content = await api.ensureEpisode(ep.seriesTmdbId, ep.seasonNumber, ep.episodeNumber);
      await api.addContentToLibrary(content.id);
      await reloadLibrary();
      notifyCalendarChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar o episódio.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRemoveEpisode(item: LibraryItem) {
    setError(null);
    setBusyKey(`${item.movie.seasonNumber}-${item.movie.episodeNumber}`);
    try {
      await api.removeFromLibrary(item.movie.id);
      await reloadLibrary();
      notifyCalendarChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover o episódio.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAddSeason() {
    if (activeSeason == null) return;
    setError(null);
    setSeasonBusy('library');
    try {
      await api.addSeasonToLibrary(sid, activeSeason);
      await reloadLibrary();
      notifyCalendarChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar a temporada.');
    } finally {
      setSeasonBusy(null);
    }
  }

  async function handleScheduleSeason() {
    if (activeSeason == null) return;
    setError(null);
    setSeasonBusy('schedule');
    try {
      await api.scheduleSeason(sid, activeSeason);
      notifyCalendarChange();
      navigate('/schedule');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível agendar a temporada.');
    } finally {
      setSeasonBusy(null);
    }
  }

  if (loading) return <main className="screen empty-state">Carregando série...</main>;
  if (error && !series) return <main className="screen empty-state">{error}</main>;
  if (!series) return <main className="screen empty-state">Série não encontrada.</main>;

  const overview = series.overview ?? '';

  return (
    <main className="screen screen--detail">
      <div className="detail-top">
        <button type="button" className="icon-btn-glass" onClick={() => navigate(-1)} aria-label="Voltar">
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
      </div>

      <section className="detail-hero detail-hero--series">
        <div
          className="detail-hero__backdrop"
          style={{ backgroundImage: `url(${series.backdropUrl ?? series.posterUrl ?? ''})` }}
        />
        <div className="detail-hero__scrim" />
        <div className="detail-hero__title-block">
          <span className="series-head__kind">
            <Tv size={13} strokeWidth={1.8} /> Série
          </span>
          <h1>{series.title}</h1>
          <div className="detail-hero__meta">
            {series.year ? <span>{series.year}</span> : null}
            {series.rating ? <span>★ {series.rating.toFixed(1)}</span> : null}
            <span>{series.seasons.length} temporada{series.seasons.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </section>

      <section className="detail-body">
        {overview ? (
          <>
            <p className="overline">Sinopse</p>
            <p className="detail-synopsis">{overview}</p>
          </>
        ) : null}

        <p className="overline">Temporadas</p>
        <div className="season-tabs">
          {series.seasons.map((season) => (
            <button
              key={season.seasonNumber}
              type="button"
              className={`chip${activeSeason === season.seasonNumber ? ' chip--active' : ''}`}
              onClick={() => setActiveSeason(season.seasonNumber)}
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
          {inListCount > 0
            ? `${inListCount} episódio${inListCount === 1 ? '' : 's'} desta temporada na sua lista.`
            : 'Agendar distribui os episódios pelos próximos dias livres, um por noite.'}
        </p>

        {error ? <p className="form-error">{error}</p> : null}
        {episodesLoading ? <p className="results-overline">Carregando episódios...</p> : null}

        <div className="episode-list">
          {episodes.map((ep) => {
            const key = `${ep.seasonNumber}-${ep.episodeNumber}`;
            const libItem = libByKey.get(key);
            const isWatched = libItem?.status === 'Watched';
            const isBusy = busyKey === key;
            return (
              <article key={key} className="episode-row">
                <div className="episode-row__num">{ep.episodeNumber}</div>
                <div className="episode-row__body">
                  <strong>{ep.name}</strong>
                  <p>{ep.runtime > 0 ? formatRuntime(ep.runtime) : 'Duração —'}</p>
                </div>
                {isWatched ? (
                  <span className="search-result__action search-result__action--done" aria-label="Assistido">
                    <Check size={19} strokeWidth={2.4} />
                  </span>
                ) : libItem ? (
                  <button
                    type="button"
                    className="search-result__action search-result__action--remove"
                    onClick={() => handleRemoveEpisode(libItem)}
                    disabled={isBusy}
                    aria-label="Remover da lista"
                  >
                    <X size={18} strokeWidth={2.4} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="search-result__action"
                    onClick={() => handleAddEpisode(ep)}
                    disabled={isBusy}
                    aria-label="Adicionar à lista"
                  >
                    <Plus size={20} strokeWidth={2.2} />
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
