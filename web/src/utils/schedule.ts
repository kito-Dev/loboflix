import { api } from '../api/client';
import type { CalendarEntry, ScheduleConfig } from '../api/types';
import { getUserPrefs } from './onboarding';
import { localTodayKey, parseLocalDate } from './date';

export const GAP_BETWEEN_MOVIES_MINUTES = 15;

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  mode: 'Custom',
  daysOfWeek: [1, 3, 5],
  maxRuntimeMinutes: 120,
  nightStartTime: '19:00',
  nightDurationMinutes: 240,
};

export const DAY_OPTIONS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
] as const;

export async function syncScheduleConfigFromPrefs() {
  const prefs = getUserPrefs();
  if (prefs.daysOfWeek.length === 0) return;

  await api.updateScheduleConfig({
    ...DEFAULT_SCHEDULE_CONFIG,
    daysOfWeek: prefs.daysOfWeek,
  });
}

export async function regenerateCalendar(weeks = 4) {
  return api.generateCalendar(weeks);
}

function dateKeyToDotNetDay(dateKey: string) {
  const day = parseLocalDate(dateKey).getDay();
  return day === 0 ? 7 : day;
}

export function isDayAllowed(dateKey: string, config: ScheduleConfig) {
  const dotnetDay = dateKeyToDotNetDay(dateKey);
  if (config.mode === 'Daily') return true;
  if (config.mode === 'Weekends') return dotnetDay === 6 || dotnetDay === 7;
  return config.daysOfWeek.includes(dotnetDay);
}

function parseTimeToMinutes(time?: string | null) {
  if (!time) return 19 * 60;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(total: number) {
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function sortEntriesByTime(entries: CalendarEntry[]) {
  return [...entries].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
}

export function suggestNextSlot(entries: CalendarEntry[], config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG) {
  const defaultStart = config.nightStartTime || DEFAULT_SCHEDULE_CONFIG.nightStartTime;
  if (entries.length === 0) return defaultStart;
  const sorted = sortEntriesByTime(entries);
  const last = sorted[sorted.length - 1];
  const end = parseTimeToMinutes(last.time ?? defaultStart) + last.movie.runtime + GAP_BETWEEN_MOVIES_MINUTES;
  return minutesToTime(end);
}

export function remainingNightMinutes(entries: CalendarEntry[], config: ScheduleConfig) {
  const used = entries.reduce((sum, entry) => sum + entry.movie.runtime, 0)
    + Math.max(0, entries.length - 1) * GAP_BETWEEN_MOVIES_MINUTES;
  return config.nightDurationMinutes - used;
}

export function isNightFull(entries: CalendarEntry[], config: ScheduleConfig) {
  const perFilmGap = entries.length > 0 ? GAP_BETWEEN_MOVIES_MINUTES : 0;
  return remainingNightMinutes(entries, config) - perFilmGap <= 0;
}

export function validateMovieForNight(
  entries: CalendarEntry[],
  movieRuntime: number,
  config: ScheduleConfig,
  dateKey?: string,
) {
  if (dateKey && !isDayAllowed(dateKey, config)) {
    return 'Este dia da semana não está disponível na sua agenda.';
  }

  if (movieRuntime > config.nightDurationMinutes) {
    return 'Este título é mais longo que o tempo disponível por noite.';
  }

  const totalRuntime = entries.reduce((sum, entry) => sum + entry.movie.runtime, 0) + movieRuntime;
  const gaps = entries.length * GAP_BETWEEN_MOVIES_MINUTES;
  if (totalRuntime + gaps > config.nightDurationMinutes) {
    const hours = Math.floor(config.nightDurationMinutes / 60);
    return `Esta noite tem apenas ${hours}h disponíveis. Esse título não cabe no tempo restante.`;
  }

  return null;
}

export function formatNightRules(config: ScheduleConfig) {
  const hours = config.nightDurationMinutes / 60;
  const days = DAY_OPTIONS.filter((day) => config.daysOfWeek.includes(day.value))
    .map((day) => day.label)
    .join(', ');
  return `Noites de ${config.nightStartTime} com ${hours}h · ${days || 'nenhum dia selecionado'}. Encaixamos quantos títulos couberem no tempo da noite.`;
}

export function formatLongDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function isEntryOverdue(entry: CalendarEntry, now = new Date()) {
  if (entry.status !== 'Pending') return false;

  const today = localTodayKey();
  if (entry.date < today) return true;
  if (entry.date > today) return false;

  const [hours, minutes] = (entry.time ?? '19:00').split(':').map(Number);
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);
  return now >= scheduled;
}

export function getWatchPromptDismissKey(entryId: string) {
  return `loboflix_watch_prompt_${entryId}`;
}
