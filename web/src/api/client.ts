import type {
  AiCalendarResponse,
  AuthResponse,
  CalendarEntry,
  Episode,
  LibraryItem,
  Marathon,
  MovieSearchResult,
  MovieSummary,
  ScheduleConfig,
  SeriesDetail,
} from './types';

const TOKEN_KEY = 'loboflix_token';
const USER_KEY = 'loboflix_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthResponse) : null;
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function setUser(user: AuthResponse | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

function parseApiError(body: string, status: number) {
  if (!body) return `Erro na requisição (${status})`;
  if (body.trimStart().startsWith('<')) return `Erro no servidor (${status}). Reinicie a API e tente novamente.`;
  try {
    const json = JSON.parse(body) as { message?: string };
    if (json.message) return json.message;
  } catch {
    /* not json */
  }
  return body.length > 180 ? `${body.slice(0, 180)}…` : body;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers });

  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    const message = await response.text();
    throw new Error(parseApiError(message, response.status));
  }

  return response.json() as Promise<T>;
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  searchMovies: (q: string) =>
    request<MovieSearchResult[]>(`/api/movies/search?q=${encodeURIComponent(q)}`),

  getMovie: (movieId: number) => request<MovieSummary>(`/api/movies/${movieId}`),

  getSeries: (tmdbId: number) => request<SeriesDetail>(`/api/tv/${tmdbId}`),

  getSeason: (tmdbId: number, seasonNumber: number) =>
    request<Episode[]>(`/api/tv/${tmdbId}/season/${seasonNumber}`),

  ensureEpisode: (tmdbId: number, seasonNumber: number, episodeNumber: number) =>
    request<MovieSummary>(`/api/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}/ensure`, {
      method: 'POST',
    }),

  addSeasonToLibrary: (tmdbId: number, seasonNumber: number) =>
    request<LibraryItem[]>(`/api/tv/${tmdbId}/season/${seasonNumber}/library`, { method: 'POST' }),

  scheduleSeason: (tmdbId: number, seasonNumber: number) =>
    request<CalendarEntry[]>(`/api/tv/${tmdbId}/season/${seasonNumber}/schedule`, { method: 'POST' }),

  getLibrary: () => request<LibraryItem[]>('/api/library'),

  addToLibrary: (tmdbId: number) =>
    request<LibraryItem>('/api/library', {
      method: 'POST',
      body: JSON.stringify({ tmdbId }),
    }),

  addContentToLibrary: (movieId: number) =>
    request<LibraryItem>(`/api/library/content/${movieId}`, { method: 'POST' }),

  removeFromLibrary: (movieId: number) =>
    request<void>(`/api/library/${movieId}`, { method: 'DELETE' }),

  getToday: () => request<CalendarEntry | null>('/api/calendar/today'),

  getCalendar: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request<CalendarEntry[]>(`/api/calendar${query ? `?${query}` : ''}`);
  },

  getScheduleConfig: () => request<ScheduleConfig>('/api/calendar/config'),

  updateScheduleConfig: (payload: ScheduleConfig) =>
    request<ScheduleConfig>('/api/calendar/config', {
      method: 'PUT',
      body: JSON.stringify({
        mode: payload.mode,
        daysOfWeek: payload.daysOfWeek,
        maxRuntimeMinutes: payload.maxRuntimeMinutes,
        nightStartTime: payload.nightStartTime,
        nightDurationMinutes: payload.nightDurationMinutes,
      }),
    }),

  generateCalendar: (weeks = 4, tmdbIds?: number[]) =>
    request<CalendarEntry[]>('/api/calendar/generate', {
      method: 'POST',
      body: JSON.stringify({ weeks, tmdbIds }),
    }),

  buildSchedule: (movieIds: number[], replaceExisting = true) =>
    request<CalendarEntry[]>('/api/calendar/build', {
      method: 'POST',
      body: JSON.stringify({ movieIds, replaceExisting }),
    }),

  scheduleMovie: (movieId: number, date: string, time: string) =>
    request<CalendarEntry>('/api/calendar/entries', {
      method: 'POST',
      body: JSON.stringify({ movieId, date, time }),
    }),

  markWatched: (entryId: string) =>
    request<void>(`/api/calendar/${entryId}/watched`, { method: 'PATCH' }),

  postpone: (entryId: string) =>
    request<void>(`/api/calendar/${entryId}/postpone`, { method: 'PATCH' }),

  unschedule: (entryId: string) =>
    request<void>(`/api/calendar/${entryId}`, { method: 'DELETE' }),

  listMarathons: () => request<Marathon[]>('/api/marathons'),

  createMarathon: (name: string, description: string, tmdbIds: number[]) =>
    request<Marathon>('/api/marathons', {
      method: 'POST',
      body: JSON.stringify({ name, description, tmdbIds }),
    }),

  applyMarathon: (marathonId: string, weeks = 4) =>
    request<CalendarEntry[]>(`/api/marathons/${marathonId}/apply?weeks=${weeks}`, {
      method: 'POST',
    }),

  generateAiCalendar: (preferences: string, avoid: string, weeks: number) =>
    request<AiCalendarResponse>('/api/ai/generate-calendar', {
      method: 'POST',
      body: JSON.stringify({ preferences, avoid, weeks }),
    }),
};

export function formatRuntime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}
