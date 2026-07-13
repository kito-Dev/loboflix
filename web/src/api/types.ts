export type WatchProvider = {
  name: string;
  type: string;
};

export type MovieSummary = {
  id: number;
  tmdbId: number;
  title: string;
  overview?: string | null;
  runtime: number;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  releaseDate?: string | null;
  imdbRating?: number | null;
  rottenTomatoesRating?: number | null;
  tmdbRating?: number | null;
  trailerYoutubeKey?: string | null;
  director?: string | null;
  genres: string[];
  cast: string[];
  watchProviders: WatchProvider[];
  mediaType?: string;
  seriesTitle?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  seriesTmdbId?: number | null;
};

export type MovieSearchResult = {
  tmdbId: number;
  title: string;
  year?: number | null;
  posterUrl?: string | null;
  rating?: number | null;
  mediaType?: string;
};

export type SeriesSeason = {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  posterUrl?: string | null;
};

export type SeriesDetail = {
  tmdbId: number;
  title: string;
  overview?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  year?: number | null;
  rating?: number | null;
  seasons: SeriesSeason[];
};

export type Episode = {
  seriesTmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview?: string | null;
  runtime: number;
  stillUrl?: string | null;
  airDate?: string | null;
};

export type LibraryItem = {
  movie: MovieSummary;
  status: string;
  addedAt: string;
};

export type CalendarEntry = {
  entryId: string;
  date: string;
  time?: string | null;
  status: string;
  movie: MovieSummary;
};

export type ScheduleConfig = {
  mode: string;
  daysOfWeek: number[];
  maxRuntimeMinutes: number;
  nightStartTime: string;
  nightDurationMinutes: number;
};

export type Marathon = {
  id: string;
  name: string;
  description?: string | null;
  movies: MovieSummary[];
};

export type AuthResponse = {
  token: string;
  userId: string;
  name: string;
  email: string;
};

export type AiCalendarResponse = {
  marathonName?: string | null;
  reasoning?: string | null;
  entries: CalendarEntry[];
};
