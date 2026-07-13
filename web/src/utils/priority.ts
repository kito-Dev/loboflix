import type { LibraryItem, MovieSummary } from '../api/types';

function normalize(value?: number | null) {
  if (value == null) return null;
  return value > 10 ? value / 10 : value;
}

export function publicScore(movie: MovieSummary) {
  return normalize(movie.tmdbRating);
}

export function finalScore(movie: MovieSummary) {
  const imdb = normalize(movie.imdbRating);
  if (imdb != null) return imdb;
  if (movie.rottenTomatoesRating != null) return movie.rottenTomatoesRating / 10;
  return normalize(movie.tmdbRating);
}

const WANT_WEIGHT = 0.4;
const PUBLIC_WEIGHT = 0.35;
const FINAL_WEIGHT = 0.25;

export function priorityScore(movie: MovieSummary, wantSoon: boolean) {
  const pub = (publicScore(movie) ?? 0) / 10;
  const fin = (finalScore(movie) ?? 0) / 10;
  return WANT_WEIGHT * (wantSoon ? 1 : 0) + PUBLIC_WEIGHT * pub + FINAL_WEIGHT * fin;
}

export type RankedItem = {
  item: LibraryItem;
  wantSoon: boolean;
  score: number;
};

export function buildRanking(
  items: LibraryItem[],
  choices: Record<number, boolean>,
): RankedItem[] {
  return items
    .map((item) => {
      const wantSoon = choices[item.movie.id] ?? false;
      return { item, wantSoon, score: priorityScore(item.movie, wantSoon) };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const pubDiff = (publicScore(b.item.movie) ?? 0) - (publicScore(a.item.movie) ?? 0);
      if (pubDiff !== 0) return pubDiff;
      return (finalScore(b.item.movie) ?? 0) - (finalScore(a.item.movie) ?? 0);
    });
}
