import type { MovieSummary } from '../api/types';

type Props = {
  movie: Pick<MovieSummary, 'imdbRating' | 'rottenTomatoesRating'>;
  size?: 'default' | 'compact';
};

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3l2.5 6 6.5.5-5 4.2 1.6 6.3L12 16.8 6.4 20l1.6-6.3-5-4.2 6.5-.5z" />
    </svg>
  );
}

export function MovieRatings({ movie, size = 'default' }: Props) {
  const chips = [];

  if (movie.imdbRating) {
    chips.push(
      <span
        key="imdb"
        className={`rating-chip rating-chip--imdb${size === 'compact' ? ' rating-chip--compact' : ''}`}
        aria-label={`IMDb ${movie.imdbRating.toFixed(1)} de 10`}
      >
        {size === 'compact' ? (
          <>★ {movie.imdbRating.toFixed(1)} IMDb</>
        ) : (
          <>
            <StarIcon />
            <span className="rating-chip__score">{movie.imdbRating.toFixed(1)}</span>
            <span className="rating-chip__label">IMDb</span>
          </>
        )}
      </span>,
    );
  }

  if (movie.rottenTomatoesRating != null) {
    chips.push(
      <span
        key="rt"
        className={`rating-chip rating-chip--rt${size === 'compact' ? ' rating-chip--compact' : ''}`}
        aria-label={`Rotten Tomatoes ${movie.rottenTomatoesRating}%`}
      >
        {size === 'compact' ? (
          <>{movie.rottenTomatoesRating}% RT</>
        ) : (
          <>
            <span className="rating-chip__icon" aria-hidden="true">
              🍅
            </span>
            <span className="rating-chip__score">{movie.rottenTomatoesRating}%</span>
            <span className="rating-chip__label">RT</span>
          </>
        )}
      </span>,
    );
  }

  if (chips.length === 0) return null;

  return <div className="rating-row">{chips}</div>;
}
