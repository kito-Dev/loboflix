import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Plus } from 'lucide-react';
import { api, formatRuntime } from '../api/client';
import type { CalendarEntry, LibraryItem, MovieSummary } from '../api/types';
import { HomeTopBar } from '../components/HomeTopBar';
import { PosterRail } from '../components/PosterRail';
import { StreamingPill } from '../components/StreamingPill';
import { WeekStrip, buildWeekDays } from '../components/WeekStrip';
import { useApp } from '../context/AppContext';
import { addDaysToDateKey, localTodayKey } from '../utils/date';
import { getWatchProgress, imdbScore, movieYear, shortGenre } from '../utils/movie';

export function HomePage() {
  const navigate = useNavigate();
  const { openTrailer, openAddFilm, calendarVersion } = useApp();
  const [today, setToday] = useState<CalendarEntry | null>(null);
  const [calendar, setCalendar] = useState<CalendarEntry[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const from = localTodayKey();
        const to = addDaysToDateKey(from, 42);

        const [todayEntry, entries, lib] = await Promise.all([
          api.getToday(),
          api.getCalendar(from, to),
          api.getLibrary(),
        ]);

        if (!cancelled) {
          setToday(todayEntry ?? null);
          setCalendar(entries);
          setLibrary(lib);
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

  const scheduledDates = useMemo(
    () => new Set(calendar.map((entry) => entry.date)),
    [calendar],
  );

  const weekDays = buildWeekDays(new Date(), scheduledDates);
  const heroMovie: MovieSummary | null = today?.movie ?? null;
  const heroScore = heroMovie ? imdbScore(heroMovie) : null;

  const continueItems = library.slice(0, 6).map((item) => ({
    movie: item.movie,
    progress: getWatchProgress(item.movie.id),
  }));
  const recommended = library.slice(0, 8).map((item) => item.movie);

  if (loading) {
    return <main className="screen screen--home empty-state">Carregando...</main>;
  }

  return (
    <main className="screen screen--home">
      {heroMovie ? (
        <section className="home-hero">
          {(heroMovie.backdropUrl ?? heroMovie.posterUrl) ? (
            <div
              className="home-hero__photo"
              style={{ backgroundImage: `url(${heroMovie.backdropUrl ?? heroMovie.posterUrl})` }}
            />
          ) : (
            <div className="home-hero__backdrop" />
          )}
          <div className="home-hero__pattern" />
          <div className="home-hero__scrim" />
          <HomeTopBar />
          <div className="home-hero__bottom">
            <p className="home-hero__overline">
              <span className="pulse-dot" />
              Seu filme de hoje
            </p>
            <h1 className="home-hero__title">{heroMovie.title}</h1>
            <div className="home-hero__meta">
              {heroScore ? <span className="home-hero__imdb">★ {heroScore}</span> : null}
              {movieYear(heroMovie.releaseDate) ? <span>{movieYear(heroMovie.releaseDate)}</span> : null}
              <span>{formatRuntime(heroMovie.runtime)}</span>
              {heroMovie.genres[0] ? <span>{shortGenre(heroMovie.genres[0])}</span> : null}
              {heroMovie.watchProviders[0] ? (
                <StreamingPill name={heroMovie.watchProviders[0].name} />
              ) : null}
            </div>
            <div className="home-hero__actions">
              {heroMovie.trailerYoutubeKey ? (
                <button
                  type="button"
                  className="btn btn-hero"
                  onClick={() =>
                    openTrailer({
                      youtubeKey: heroMovie.trailerYoutubeKey!,
                      title: heroMovie.title,
                      backdropUrl: heroMovie.backdropUrl ?? heroMovie.posterUrl,
                    })
                  }
                >
                  <Play size={17} fill="currentColor" />
                  Assistir agora
                </button>
              ) : (
                <Link className="btn btn-hero" to={`/movies/${heroMovie.id}`}>
                  Ver detalhes
                </Link>
              )}
              <button type="button" className="btn btn-glass-square" onClick={openAddFilm} aria-label="Adicionar">
                <Plus size={22} strokeWidth={1.6} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="home-hero home-hero--empty">
          <div className="home-hero__backdrop" />
          <div className="home-hero__pattern" />
          <div className="home-hero__scrim" />
          <HomeTopBar />
          <div className="home-hero__bottom">
            <p className="home-hero__overline">Bem-vindo ao Loboflix</p>
            <h1 className="home-hero__title">
              {library.length > 0
                ? 'Nenhum filme agendado para hoje'
                : 'Monte sua lista e deixe a agenda pronta'}
            </h1>
            {library.length > 0 ? (
              <Link className="btn btn-hero" to="/schedule">
                Ver agenda
              </Link>
            ) : (
              <button type="button" className="btn btn-hero" onClick={openAddFilm}>
                Adicionar primeiro filme
              </button>
            )}
          </div>
        </section>
      )}

      <WeekStrip
        days={weekDays}
        onSelect={(day) => navigate(`/schedule?date=${day.dateKey}`)}
        seeAllTo="/schedule"
      />

      <PosterRail title="Continuar" items={continueItems} seeAllTo="/library" variant="continue" />
      <PosterRail title="Combina com você" items={recommended.map((m) => ({ movie: m }))} seeAllTo="/library" variant="recommended" />
    </main>
  );
}
