import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Moon } from 'lucide-react';
import { api } from '../api/client';
import type { ScheduleConfig } from '../api/types';
import { DAY_OPTIONS, DEFAULT_SCHEDULE_CONFIG, formatNightRules } from '../utils/schedule';

export function SettingsPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getScheduleConfig()
      .then(setConfig)
      .catch(() => setConfig(DEFAULT_SCHEDULE_CONFIG))
      .finally(() => setLoading(false));
  }, []);

  function toggleDay(day: number) {
    setConfig((current) => {
      const nextDays = current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((value) => value !== day)
        : [...current.daysOfWeek, day].sort();
      return { ...current, mode: 'Custom', daysOfWeek: nextDays };
    });
    setSaved(false);
  }

  async function handleSave() {
    if (config.daysOfWeek.length === 0) {
      setError('Selecione ao menos um dia da semana.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateScheduleConfig({
        ...config,
        mode: 'Custom',
      });
      setConfig(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar os ajustes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="screen empty-state">Carregando...</main>;

  const nightHours = config.nightDurationMinutes / 60;

  return (
    <main className="screen screen--settings">
      <header className="settings-page-header">
        <Link to="/profile" className="icon-btn-surface" aria-label="Voltar">
          <ArrowLeft size={20} strokeWidth={1.6} />
        </Link>
        <div>
          <p className="overline">Perfil</p>
          <h1 className="screen-title">Ajustes</h1>
        </div>
      </header>

      <section className="settings-section">
        <div className="settings-section__head">
          <Moon size={18} strokeWidth={1.6} />
          <div>
            <h2>Noites de cinema</h2>
            <p>Defina quando e quanto tempo você tem para assistir.</p>
          </div>
        </div>

        <div className="settings-block">
          <label className="settings-block__label">Dias disponíveis</label>
          <div className="chip-row">
            {DAY_OPTIONS.map((day) => (
              <button
                key={day.value}
                type="button"
                className={`chip${config.daysOfWeek.includes(day.value) ? ' chip--active' : ''}`}
                onClick={() => toggleDay(day.value)}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-block">
          <label className="settings-block__label" htmlFor="night-start">
            <Clock size={16} strokeWidth={1.6} />
            Início da noite
          </label>
          <input
            id="night-start"
            type="time"
            className="schedule-field__input"
            value={config.nightStartTime}
            onChange={(event) => {
              setConfig((current) => ({ ...current, nightStartTime: event.target.value }));
              setSaved(false);
            }}
          />
        </div>

        <div className="settings-block">
          <label className="settings-block__label" htmlFor="night-hours">
            Horas por noite
          </label>
          <div className="settings-slider-value">{nightHours}h</div>
          <input
            id="night-hours"
            type="range"
            min={2}
            max={6}
            step={1}
            value={nightHours}
            className="onboarding-slider"
            onChange={(event) => {
              const hours = Number(event.target.value);
              setConfig((current) => ({ ...current, nightDurationMinutes: hours * 60 }));
              setSaved(false);
            }}
          />
          <p className="settings-hint">
            Filmes com menos de 2h permitem até 2 títulos na mesma noite, se couberem no tempo total.
          </p>
        </div>

        <div className="settings-summary">
          <strong>Resumo</strong>
          <p>{formatNightRules(config)}</p>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {saved ? <p className="settings-saved">Ajustes salvos.</p> : null}

        <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar ajustes'}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate('/profile')}>
          Voltar ao perfil
        </button>
      </section>
    </main>
  );
}
