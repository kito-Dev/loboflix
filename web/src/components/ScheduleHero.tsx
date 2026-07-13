import { useEffect, useState } from 'react';
import type { MovieSummary } from '../api/types';
import { formatRuntime } from '../api/client';
import { MovieRatings } from './MovieRatings';

type Props = {
  movie: MovieSummary;
  label?: string;
  onWatched?: () => void;
  onPostpone?: () => void;
};

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5l12 7-12 7z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

export function ScheduleHero({ movie, label = 'Hoje', onWatched, onPostpone }: Props) {
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(false);
  const backdropUrl = movie.backdropUrl ?? movie.posterUrl ?? '';

  useEffect(() => {
    if (!isTrailerPlaying) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsTrailerPlaying(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTrailerPlaying]);

  return (
    <section className={`card card-schedule${isTrailerPlaying ? ' card-schedule--playing' : ''}`}>
      <div className="card-schedule__media">
        <div
          className="card-schedule__backdrop"
          style={backdropUrl ? { backgroundImage: `url(${backdropUrl})` } : undefined}
          aria-hidden={isTrailerPlaying}
        />
        {isTrailerPlaying && movie.trailerYoutubeKey ? (
          <iframe
            className="card-schedule__player"
            src={`https://www.youtube.com/embed/${movie.trailerYoutubeKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={`Trailer de ${movie.title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : null}
        {!isTrailerPlaying ? (
          <>
            <div className="card-schedule__scrim" />
            <span className="pill card-schedule__pill">{label}</span>
          </>
        ) : (
          <button
            type="button"
            className="card-schedule__close-trailer"
            onClick={() => setIsTrailerPlaying(false)}
            aria-label="Fechar trailer"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="card-schedule__content">
        <h1 className="page-title">{movie.title}</h1>
        {!isTrailerPlaying ? (
          <>
            <MovieRatings movie={movie} />
            <div className="meta-row">
              <span>{formatRuntime(movie.runtime)}</span>
              {movie.watchProviders[0] ? <span>{movie.watchProviders[0].name}</span> : null}
            </div>
            {movie.overview ? <p className="page-subtitle">{movie.overview}</p> : null}
            <div className="card-schedule__actions">
              {movie.trailerYoutubeKey ? (
                <button className="btn btn-primary" type="button" onClick={() => setIsTrailerPlaying(true)}>
                  <PlayIcon />
                  Ver trailer
                </button>
              ) : null}
              {onWatched ? (
                <button className="btn btn-secondary" type="button" onClick={onWatched}>
                  Marcar assistido
                </button>
              ) : null}
              {onPostpone ? (
                <button className="btn btn-ghost" type="button" onClick={onPostpone}>
                  Adiar
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {formatRuntime(movie.runtime)}
            {movie.watchProviders[0] ? ` · ${movie.watchProviders[0].name}` : ''}
          </p>
        )}
      </div>
    </section>
  );
}
