import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type TrailerState = {
  youtubeKey: string;
  title: string;
  backdropUrl?: string | null;
} | null;

export type ScheduleNightTarget = {
  date: string;
  time: string;
};

type AppContextValue = {
  addFilmOpen: boolean;
  scheduleNightTarget: ScheduleNightTarget | null;
  openAddFilm: () => void;
  openAddFilmForNight: (date: string, time: string) => void;
  closeAddFilm: () => void;
  trailer: TrailerState;
  openTrailer: (payload: { youtubeKey: string; title: string; backdropUrl?: string | null }) => void;
  closeTrailer: () => void;
  calendarVersion: number;
  notifyCalendarChange: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [addFilmOpen, setAddFilmOpen] = useState(false);
  const [scheduleNightTarget, setScheduleNightTarget] = useState<ScheduleNightTarget | null>(null);
  const [trailer, setTrailer] = useState<TrailerState>(null);
  const [calendarVersion, setCalendarVersion] = useState(0);

  const openAddFilm = useCallback(() => {
    setScheduleNightTarget(null);
    setAddFilmOpen(true);
  }, []);

  const openAddFilmForNight = useCallback((date: string, time: string) => {
    setScheduleNightTarget({ date, time });
    setAddFilmOpen(true);
  }, []);

  const closeAddFilm = useCallback(() => {
    setAddFilmOpen(false);
    setScheduleNightTarget(null);
  }, []);

  const openTrailer = useCallback(
    (payload: { youtubeKey: string; title: string; backdropUrl?: string | null }) =>
      setTrailer(payload),
    [],
  );
  const closeTrailer = useCallback(() => setTrailer(null), []);
  const notifyCalendarChange = useCallback(() => setCalendarVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({
      addFilmOpen,
      scheduleNightTarget,
      openAddFilm,
      openAddFilmForNight,
      closeAddFilm,
      trailer,
      openTrailer,
      closeTrailer,
      calendarVersion,
      notifyCalendarChange,
    }),
    [
      addFilmOpen,
      scheduleNightTarget,
      openAddFilm,
      openAddFilmForNight,
      closeAddFilm,
      trailer,
      openTrailer,
      closeTrailer,
      calendarVersion,
      notifyCalendarChange,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
