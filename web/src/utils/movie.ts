import type { MovieSummary } from '../api/types';
import { formatRuntime } from '../api/client';

const PROVIDER_COLORS: Record<string, string> = {
  netflix: '#e5615a',
  'prime video': '#6aa6e0',
  'amazon prime': '#6aa6e0',
  'amazon prime video': '#6aa6e0',
  prime: '#6aa6e0',
  'disney+': '#5b6fe0',
  'disney plus': '#5b6fe0',
  max: '#b57be0',
  'hbo max': '#b57be0',
  'apple tv+': '#f4f3f1',
  'apple tv': '#f4f3f1',
};

const PROVIDER_SHORT: Record<string, string> = {
  netflix: 'Netflix',
  'prime video': 'Prime',
  'amazon prime video': 'Prime',
  'amazon prime': 'Prime',
  'sony one amazon channel': 'Prime',
  prime: 'Prime',
  'disney plus': 'Disney+',
  'disney+': 'Disney+',
  'hbo max': 'Max',
  max: 'Max',
  'apple tv plus': 'Apple TV+',
  'apple tv+': 'Apple TV+',
};

const GENRE_SHORT: Record<string, string> = {
  'ficção científica': 'Ficção',
  'science fiction': 'Ficção',
  'sci-fi': 'Ficção',
};

function normalizeRating(value: number) {
  return value > 10 ? value / 10 : value;
}

export function providerColor(name: string) {
  const lower = name.toLowerCase();
  if (PROVIDER_COLORS[lower]) return PROVIDER_COLORS[lower];
  if (lower.includes('netflix')) return PROVIDER_COLORS.netflix;
  if (lower.includes('prime') || lower.includes('amazon')) return PROVIDER_COLORS.prime;
  if (lower.includes('disney')) return PROVIDER_COLORS['disney+'];
  if (lower.includes('hbo') || lower.includes('max')) return PROVIDER_COLORS.max;
  if (lower.includes('apple')) return PROVIDER_COLORS['apple tv+'];
  return '#9a99a0';
}

export function providerShortName(name: string) {
  const lower = name.toLowerCase();
  if (PROVIDER_SHORT[lower]) return PROVIDER_SHORT[lower];
  if (lower.includes('netflix')) return 'Netflix';
  if (lower.includes('prime') || lower.includes('amazon')) return 'Prime';
  if (lower.includes('disney')) return 'Disney+';
  if (lower.includes('hbo') || lower === 'max') return 'Max';
  if (lower.includes('apple')) return 'Apple TV+';
  return name.split(/\s+/)[0];
}

export function shortGenre(genre: string) {
  const lower = genre.toLowerCase();
  if (GENRE_SHORT[lower]) return GENRE_SHORT[lower];
  const first = genre.split(/[\s/]+/)[0];
  return first.length > 14 ? first.slice(0, 12) : first;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function movieYear(releaseDate?: string | null) {
  return releaseDate ? releaseDate.slice(0, 4) : null;
}

export function isEpisode(movie: MovieSummary) {
  return movie.mediaType === 'episode';
}

export function episodeTag(movie: MovieSummary) {
  if (!isEpisode(movie)) return null;
  return `T${movie.seasonNumber ?? 0}:E${movie.episodeNumber ?? 0}`;
}

export function contentTitle(movie: MovieSummary) {
  if (isEpisode(movie) && movie.seriesTitle) return movie.seriesTitle;
  return movie.title;
}

export function movieMeta(movie: MovieSummary) {
  if (isEpisode(movie)) {
    const parts = [episodeTag(movie), movie.title, formatRuntime(movie.runtime)].filter(Boolean);
    return parts.join(' · ');
  }
  const parts = [
    movieYear(movie.releaseDate),
    movie.genres[0] ? shortGenre(movie.genres[0]) : null,
    formatRuntime(movie.runtime),
  ].filter(Boolean);
  return parts.join(' · ');
}

export function imdbScore(movie: MovieSummary) {
  const raw = movie.imdbRating ?? movie.tmdbRating;
  if (raw == null) return null;
  return normalizeRating(raw).toFixed(1);
}

export function getWatchProgress(movieId: number) {
  try {
    const raw = localStorage.getItem('loboflix_watch_progress');
    if (raw) return (JSON.parse(raw) as Record<string, number>)[String(movieId)] ?? 0;
  } catch {
    /* ignore */
  }
  return 0;
}

export function continueMeta(movie: MovieSummary, progressPercent: number) {
  if (progressPercent > 0) {
    const remaining = Math.round(movie.runtime * (1 - progressPercent / 100));
    if (remaining > 0) return `${remaining} min restantes`;
    return 'Quase lá';
  }
  return formatRuntime(movie.runtime);
}
