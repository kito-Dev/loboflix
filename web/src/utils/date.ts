export function toLocalDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function localTodayKey() {
  return toLocalDateKey(new Date());
}

export function parseLocalDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = parseLocalDate(dateKey);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
}

export function isPastDateKey(dateKey: string) {
  return dateKey < localTodayKey();
}
