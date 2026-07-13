import { Link } from 'react-router-dom';
import type { MovieSummary } from '../api/types';
import { continueMeta, imdbScore, movieMeta } from '../utils/movie';

export type RailItem = {
  movie: MovieSummary;
  progress?: number;
};

type Props = {
  title: string;
  items: RailItem[];
  seeAllTo?: string;
  variant?: 'continue' | 'recommended';
};

export function PosterRail({ title, items, seeAllTo, variant = 'recommended' }: Props) {
  if (items.length === 0) return null;

  return (
    <section className={`rail-section${variant === 'continue' ? ' rail-section--continue' : ''}${variant === 'recommended' ? ' rail-section--recommended' : ''}`}>
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {seeAllTo ? (
          <Link className="section-link" to={seeAllTo}>
            Ver tudo
          </Link>
        ) : null}
      </div>
      <div className="poster-rail scroll-x">
        {items.map(({ movie, progress = 0 }) => (
          <Link
            key={movie.id}
            className={`poster-rail__item poster-rail__item--${variant}`}
            to={`/movies/${movie.id}`}
          >
            <div className="poster-rail__poster">
              {movie.posterUrl ? (
                <img src={movie.posterUrl} alt={movie.title} loading="lazy" />
              ) : (
                <div className="poster-rail__placeholder" />
              )}
              {variant === 'continue' ? <span className="poster-rail__play" aria-hidden="true" /> : null}
              {variant === 'recommended' && imdbScore(movie) ? (
                <span className="poster-rail__rating">★ {imdbScore(movie)}</span>
              ) : null}
              {variant === 'continue' && progress > 0 ? (
                <span className="poster-rail__progress" style={{ width: `${progress}%` }} />
              ) : null}
            </div>
            <div className="poster-rail__title">{movie.title}</div>
            <div className="poster-rail__meta">
              {variant === 'continue' ? continueMeta(movie, progress) : movieMeta(movie)}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
