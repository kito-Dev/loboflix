import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Clock } from 'lucide-react';
import { api, formatRuntime } from '../api/client';
import type { CalendarEntry, MovieSummary, ScheduleConfig } from '../api/types';
import { useApp } from '../context/AppContext';
import { addDaysToDateKey, localTodayKey, parseLocalDate } from '../utils/date';
import {
  DEFAULT_SCHEDULE_CONFIG,
  formatNightRules,
  isDayAllowed,
  suggestNextSlot,
  validateMovieForNight,
} from '../utils/schedule';

type Props = {
  movie: MovieSummary;
  open: boolean;
  onClose: () => void;
};

type NightOption = {
  dateKey: string;
  slot: string;
  fits: boolean;
};

function nightLabel(dateKey: string) {
  const date = parseLocalDate(dateKey);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const dayMonth = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dayMonth}`;
}

function slotLabel(time: string) {
  return time.replace(':', 'h');
}

export function ScheduleModal({ movie, open, onClose }: Props) {
  const navigate = useNavigate();
  const { notifyCalendarChange } = useApp();
  const [config, setConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const today = localTodayKey();
    Promise.all([
      api.getScheduleConfig().catch(() => DEFAULT_SCHEDULE_CONFIG),
      api.getCalendar(today, addDaysToDateKey(today, 60)).catch(() => [] as CalendarEntry[]),
    ])
      .then(([cfg, cal]) => {
        setConfig(cfg);
        setEntries(cal);
      })
      .finally(() => setLoading(false));
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const nights = useMemo<NightOption[]>(() => {
    const list: NightOption[] = [];
    let cursor = localTodayKey();
    let guard = 0;
    while (list.length < 12 && guard < 120) {
      if (isDayAllowed(cursor, config)) {
        const dayPending = entries.filter((entry) => entry.date === cursor && entry.status === 'Pending');
        const validationError = validateMovieForNight(dayPending, movie.runtime, config, cursor);
        list.push({
          dateKey: cursor,
          slot: suggestNextSlot(dayPending, config),
          fits: !validationError,
        });
      }
      cursor = addDaysToDateKey(cursor, 1);
      guard += 1;
    }
    return list;
  }, [entries, config, movie.runtime]);

  useEffect(() => {
    if (!open) return;
    const firstFit = nights.find((night) => night.fits);
    setSelected(firstFit ? firstFit.dateKey : null);
  }, [open, nights]);

  if (!open) return null;

  const selectedNight = nights.find((night) => night.dateKey === selected) ?? null;

  async function handleConfirm() {
    if (!selectedNight) return;
    setSaving(true);
    setError(null);
    try {
      await api.scheduleMovie(movie.id, selectedNight.dateKey, selectedNight.slot);
      notifyCalendarChange();
      onClose();
      navigate(`/schedule?date=${selectedNight.dateKey}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível agendar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="schedule-modal" role="dialog" aria-modal="true" aria-label="Agendar filme">
      <button type="button" className="schedule-modal__backdrop" onClick={onClose} aria-label="Fechar" />
      <div className="schedule-modal__sheet">
        <div className="schedule-modal__handle" aria-hidden="true" />
        <h2 className="schedule-modal__title">Agendar filme</h2>
        <p className="schedule-modal__subtitle">
          {movie.title} · {formatRuntime(movie.runtime)}
        </p>
        <p className="schedule-modal__rules">{formatNightRules(config)}</p>

        {loading ? (
          <p className="results-overline">Buscando próximas noites...</p>
        ) : nights.length === 0 ? (
          <p className="schedule-modal__empty">
            Nenhum dia disponível na sua agenda. Ajuste os dias da semana em Ajustes.
          </p>
        ) : (
          <div className="night-picker scroll-y">
            {nights.map((night) => (
              <button
                key={night.dateKey}
                type="button"
                className={`night-option${selected === night.dateKey ? ' night-option--active' : ''}${
                  !night.fits ? ' night-option--full' : ''
                }`}
                onClick={() => night.fits && setSelected(night.dateKey)}
                disabled={!night.fits}
                aria-pressed={selected === night.dateKey}
              >
                <span className="night-option__date">{nightLabel(night.dateKey)}</span>
                <span className="night-option__slot">
                  <Clock size={13} strokeWidth={1.8} />
                  {night.fits ? slotLabel(night.slot) : 'Sem espaço'}
                </span>
                {selected === night.dateKey ? (
                  <Check size={16} strokeWidth={2.4} className="night-option__check" />
                ) : null}
              </button>
            ))}
          </div>
        )}

        {error ? <p className="form-error">{error}</p> : null}

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={handleConfirm}
          disabled={saving || !selectedNight}
        >
          {saving
            ? 'Agendando...'
            : selectedNight
              ? `Agendar · ${nightLabel(selectedNight.dateKey)} ${slotLabel(selectedNight.slot)}`
              : 'Selecione uma noite'}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
