import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, ChevronLeft, Plus, Share2, Play } from 'lucide-react';
import { api, formatRuntime } from '../api/client';
import type { MovieSummary } from '../api/types';
import { RatingCards } from '../components/RatingCards';
import { ScheduleModal } from '../components/ScheduleModal';
import { StreamingPill } from '../components/StreamingPill';
import { useApp } from '../context/AppContext';
import { initials, movieYear } from '../utils/movie';

export function MovieDetailPage() {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const { openTrailer, openAddFilm } = useApp();
  const [movie, setMovie] = useState<MovieSummary | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!movieId) return;
    api
      .getMovie(Number(movieId))
      .then(setMovie)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar filme'));
  }, [movieId]);

  if (error) return <main className="screen empty-state">{error}</main>;
  if (!movie) return <main className="screen empty-state">Carregando filme...</main>;

  const overview = movie.overview ?? '';
  const shortOverview = overview.length > 180 && !expanded ? `${overview.slice(0, 180)}…` : overview;

  return (
    <main className="screen screen--detail">
      <div className="detail-top">
        <button type="button" className="icon-btn-glass" onClick={() => navigate(-1)} aria-label="Voltar">
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
        <div className="detail-top__actions">
          <button type="button" className="icon-btn-glass" aria-label="Compartilhar">
            <Share2 size={19} strokeWidth={1.7} />
          </button>
          <button type="button" className="icon-btn-glass" onClick={openAddFilm} aria-label="Adicionar">
            <Plus size={19} strokeWidth={1.7} />
          </button>
        </div>
      </div>

      <section className="detail-hero">
        <div
          className="detail-hero__backdrop"
          style={{ backgroundImage: `url(${movie.backdropUrl ?? movie.posterUrl ?? ''})` }}
        />
        <div className="detail-hero__scrim" />
        {movie.trailerYoutubeKey ? (
          <button
            type="button"
            className="detail-hero__play"
            onClick={() =>
              openTrailer({
                youtubeKey: movie.trailerYoutubeKey!,
                title: movie.title,
                backdropUrl: movie.backdropUrl ?? movie.posterUrl,
              })
            }
            aria-label="Ver trailer"
          >
            <Play size={24} fill="currentColor" />
          </button>
        ) : null}
        <div className="detail-hero__title-block">
          <h1>{movie.title}</h1>
          <div className="detail-hero__meta">
            {movieYear(movie.releaseDate) ? <span>{movieYear(movie.releaseDate)}</span> : null}
            <span>{formatRuntime(movie.runtime)}</span>
            {movie.genres[0] ? <span>{movie.genres[0]}</span> : null}
          </div>
        </div>
      </section>

      <section className="detail-body">
        <RatingCards movie={movie} />

        <div className="detail-cta-row">
          <button type="button" className="btn btn-primary btn-block" onClick={() => setScheduleOpen(true)}>
            <Calendar size={18} strokeWidth={2} />
            Agendar
          </button>
          <button type="button" className="btn btn-secondary-square" onClick={openAddFilm} aria-label="Adicionar">
            <Plus size={22} strokeWidth={1.6} />
          </button>
        </div>

        {movie.watchProviders.length > 0 ? (
          <>
            <p className="overline">Onde assistir</p>
            <div className="streaming-row">
              {movie.watchProviders.map((provider) => (
                <StreamingPill key={`${provider.name}-${provider.type}`} name={provider.name} />
              ))}
            </div>
          </>
        ) : null}

        {overview ? (
          <>
            <p className="overline">Sinopse</p>
            <p className="detail-synopsis">{shortOverview}</p>
            {overview.length > 180 ? (
              <button type="button" className="text-link" onClick={() => setExpanded((value) => !value)}>
                {expanded ? 'Ver menos' : 'Ler mais'}
              </button>
            ) : null}
          </>
        ) : null}

        {movie.director ? (
          <div className="director-card">
            <div className="director-card__avatar">{initials(movie.director)}</div>
            <div>
              <small>Direção</small>
              <strong>{movie.director}</strong>
            </div>
          </div>
        ) : null}

        {movie.cast.length > 0 ? (
          <>
            <p className="overline">Elenco</p>
            <div className="cast-rail scroll-x">
              {movie.cast.map((name) => (
                <div key={name} className="cast-chip">
                  <div className="cast-chip__avatar">{initials(name)}</div>
                  <strong>{name}</strong>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <ScheduleModal movie={movie} open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
    </main>
  );
}
