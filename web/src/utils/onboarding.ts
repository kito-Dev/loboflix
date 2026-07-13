const ONBOARDING_KEY = 'loboflix_onboarding_done';
const PREFS_KEY = 'loboflix_prefs';

export type UserPrefs = {
  services: string[];
  genres: string[];
  nightsPerWeek: number;
  daysOfWeek: number[];
};

const defaultPrefs: UserPrefs = {
  services: [],
  genres: [],
  nightsPerWeek: 4,
  daysOfWeek: [1, 3, 5, 6],
};

export function hasCompletedOnboarding() {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function completeOnboarding(prefs?: Partial<UserPrefs>) {
  localStorage.setItem(ONBOARDING_KEY, '1');
  if (prefs) {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...defaultPrefs, ...prefs }));
  }
}

export function getUserPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs;
  } catch {
    return defaultPrefs;
  }
}

export function saveUserPrefs(prefs: Partial<UserPrefs>) {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...getUserPrefs(), ...prefs }));
}
