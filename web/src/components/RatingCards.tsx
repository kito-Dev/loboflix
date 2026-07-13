import type { MovieSummary } from '../api/types';

type Props = Pick<MovieSummary, 'imdbRating' | 'rottenTomatoesRating' | 'tmdbRating'>;

export function RatingCards({ movie }: { movie: Props }) {
  return (
    <div className="rating-cards">
      {movie.imdbRating != null ? (
        <div className="rating-card">
          <div className="rating-card__value rating-card__value--imdb">
            <span aria-hidden="true">★</span> {movie.imdbRating.toFixed(1)}
          </div>
          <div className="rating-card__label">IMDb</div>
        </div>
      ) : null}
      {movie.rottenTomatoesRating != null ? (
        <div className="rating-card">
          <div className="rating-card__value rating-card__value--rt">{movie.rottenTomatoesRating}%</div>
          <div className="rating-card__label">Rotten Tomatoes</div>
        </div>
      ) : null}
      {movie.tmdbRating != null ? (
        <div className="rating-card">
          <div className="rating-card__value">{movie.tmdbRating.toFixed(1)}</div>
          <div className="rating-card__label">Público</div>
        </div>
      ) : null}
    </div>
  );
}
