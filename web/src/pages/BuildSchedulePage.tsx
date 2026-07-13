import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Check, Clock3, GripVertical, Layers, RefreshCw, Rewind, X, Zap } from 'lucide-react';
import { api, formatRuntime } from '../api/client';
import type { CalendarEntry, LibraryItem } from '../api/types';
import { useApp } from '../context/AppContext';
import { buildRanking, type RankedItem } from '../utils/priority';
import { contentTitle, movieYear, shortGenre } from '../utils/movie';
import { addDaysToDateKey, localTodayKey } from '../utils/date';

type Step = 'intro' | 'swipe' | 'ranking' | 'done';

const SWIPE_THRESHOLD = 90;

function weekdayShort(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`)
    .toLocaleDateString('pt-BR', { weekday: 'short' })
    .replace('.', '')
    .slice(0, 3)
    .toUpperCase();
}

export function BuildSchedulePage() {
  const navigate = useNavigate();
  const { notifyCalendarChange } = useApp();

  const [step, setStep] = useState<Step>('intro');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<Record<number, boolean>>({});
  const [ranking, setRanking] = useState<RankedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CalendarEntry[]>([]);
  const [hasExisting, setHasExisting] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const [dragX, setDragX] = useState(0);
  const [flinging, setFlinging] = useState(false);
  const startXRef = useRef<number | null>(null);

  useEffect(() => {
    const today = localTodayKey();
    Promise.all([
      api.getLibrary().catch(() => []),
      api.getCalendar(today, addDaysToDateKey(today, 84)).catch(() => []),
    ])
      .then(([lib, calendar]) => {
        setItems(lib.filter((item) => item.status !== 'Watched'));
        setHasExisting(calendar.some((entry) => entry.status === 'Pending'));
      })
      .finally(() => setLoading(false));
  }, []);

  const current = items[index];
  const progress = items.length ? Math.round(((index) / items.length) * 100) : 0;

  function decide(wantSoon: boolean) {
    if (!current || flinging) return;
    const movieId = current.movie.id;
    setChoices((prev) => ({ ...prev, [movieId]: wantSoon }));
    setFlinging(true);
    setDragX(wantSoon ? 600 : -600);
    window.setTimeout(() => {
      setFlinging(false);
      setDragX(0);
      startXRef.current = null;
      const nextIndex = index + 1;
      if (nextIndex >= items.length) {
        const nextChoices = { ...choices, [movieId]: wantSoon };
        setRanking(buildRanking(items, nextChoices));
        setStep('ranking');
      } else {
        setIndex(nextIndex);
      }
    }, 220);
  }

  function onPointerDown(event: React.PointerEvent) {
    if (flinging) return;
    startXRef.current = event.clientX;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (startXRef.current == null || flinging) return;
    setDragX(event.clientX - startXRef.current);
  }

  function onPointerUp() {
    if (startXRef.current == null || flinging) return;
    if (dragX > SWIPE_THRESHOLD) decide(true);
    else if (dragX < -SWIPE_THRESHOLD) decide(false);
    else {
      setDragX(0);
      startXRef.current = null;
    }
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const entries = await api.buildSchedule(ranking.map((r) => r.item.movie.id), replaceExisting);
      setResult(entries);
      notifyCalendarChange();
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="screen build-flow">
      <header className="build-flow__top">
        <button
          type="button"
          className="build-flow__close"
          onClick={() => navigate('/schedule')}
          aria-label="Fechar"
        >
          <X size={20} strokeWidth={2} />
        </button>
        <div className="build-flow__brand">
          <span className="build-flow__brand-title">Montar Agenda</span>
          <span className="build-flow__brand-sub">Priorização gamificada</span>
        </div>
        <span className="build-flow__spacer" />
      </header>

      {step === 'intro' ? (
        <section className="build-intro">
          <div className="build-intro__icon" aria-hidden="true">
            <CalendarDays size={30} strokeWidth={1.6} />
          </div>
          <h1 className="build-intro__title">O que vem primeiro?</h1>
          <p className="build-intro__desc">
            {loading
              ? 'Carregando sua lista...'
              : items.length === 0
                ? 'Sua watch list está vazia. Adicione filmes ou séries antes de montar a agenda.'
                : `${items.length} ${items.length === 1 ? 'título' : 'títulos'} na sua lista. Decida rápido: quero ver logo, ou pode esperar. A gente monta a agenda em volta disso.`}
          </p>
          <div className="build-intro__badge">
            <Clock3 size={14} strokeWidth={1.8} />
            Leva menos de 1 minuto
          </div>

          {!loading && items.length > 0 && hasExisting ? (
            <div className="build-mode">
              <p className="build-mode__label">Você já tem uma agenda montada. O que fazer?</p>
              <button
                type="button"
                className={`build-mode__option${!replaceExisting ? ' build-mode__option--active' : ''}`}
                onClick={() => setReplaceExisting(false)}
                aria-pressed={!replaceExisting}
              >
                <span className="build-mode__icon" aria-hidden="true">
                  <Layers size={18} strokeWidth={1.8} />
                </span>
                <span className="build-mode__text">
                  <strong>Adicionar aos próximos dias</strong>
                  <span>Mantém o que já está agendado e encaixa nos slots livres seguintes</span>
                </span>
                {!replaceExisting ? <Check size={18} strokeWidth={2.4} className="build-mode__check" /> : null}
              </button>
              <button
                type="button"
                className={`build-mode__option${replaceExisting ? ' build-mode__option--active' : ''}`}
                onClick={() => setReplaceExisting(true)}
                aria-pressed={replaceExisting}
              >
                <span className="build-mode__icon" aria-hidden="true">
                  <RefreshCw size={18} strokeWidth={1.8} />
                </span>
                <span className="build-mode__text">
                  <strong>Substituir a agenda atual</strong>
                  <span>Apaga os títulos pendentes e monta tudo de novo do zero</span>
                </span>
                {replaceExisting ? <Check size={18} strokeWidth={2.4} className="build-mode__check" /> : null}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="btn btn-primary btn-block build-intro__cta"
            disabled={loading || items.length === 0}
            onClick={() => setStep('swipe')}
          >
            Começar
          </button>
          {!loading && items.length === 0 ? (
            <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate('/library')}>
              Ir para a watch list
            </button>
          ) : null}
        </section>
      ) : null}

      {step === 'swipe' && current ? (
        <section className="build-swipe">
          <div className="build-swipe__meta">
            <span className="build-swipe__count">
              {index + 1} DE {items.length}
            </span>
            <div className="build-swipe__progress">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className="build-swipe__hint">Arraste pra decidir a prioridade</p>
          </div>

          <div className="build-swipe__stage">
            {items[index + 1] ? (
              <article className="swipe-card swipe-card--behind" aria-hidden="true">
                {items[index + 1].movie.posterUrl ? (
                  <img src={items[index + 1].movie.posterUrl ?? ''} alt="" />
                ) : (
                  <div className="swipe-card__empty" />
                )}
              </article>
            ) : null}

            <article
              className="swipe-card"
              style={{
                transform: `translateX(${dragX}px) rotate(${dragX / 22}deg)`,
                transition: startXRef.current == null || flinging ? 'transform 0.22s ease' : 'none',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {current.movie.posterUrl ? (
                <img src={current.movie.posterUrl} alt="" draggable={false} />
              ) : (
                <div className="swipe-card__empty" />
              )}
              <span
                className="swipe-card__stamp swipe-card__stamp--soon"
                style={{ opacity: Math.max(0, Math.min(1, dragX / SWIPE_THRESHOLD)) }}
              >
                Quero logo
              </span>
              <span
                className="swipe-card__stamp swipe-card__stamp--later"
                style={{ opacity: Math.max(0, Math.min(1, -dragX / SWIPE_THRESHOLD)) }}
              >
                Sem pressa
              </span>
              <div className="swipe-card__info">
                <strong>{contentTitle(current.movie)}</strong>
                <p>
                  {movieYear(current.movie.releaseDate) ?? '—'} · {formatRuntime(current.movie.runtime)}
                  {current.movie.genres[0] ? ` · ${shortGenre(current.movie.genres[0])}` : ''}
                </p>
              </div>
            </article>
          </div>

          <div className="build-swipe__actions">
            <button type="button" className="swipe-btn swipe-btn--later" onClick={() => decide(false)}>
              <Rewind size={18} strokeWidth={1.8} />
              Sem pressa
            </button>
            <button type="button" className="swipe-btn swipe-btn--soon" onClick={() => decide(true)}>
              <Zap size={18} strokeWidth={1.8} fill="currentColor" />
              Quero logo
            </button>
          </div>
        </section>
      ) : null}

      {step === 'ranking' ? (
        <RankingStep
          ranking={ranking}
          onReorder={setRanking}
          onConfirm={handleConfirm}
          submitting={submitting}
        />
      ) : null}

      {step === 'done' ? (
        <section className="build-done">
          <div className="build-done__check" aria-hidden="true">
            <Check size={34} strokeWidth={2.4} />
          </div>
          <h1 className="build-done__title">Agenda atualizada</h1>
          <p className="build-done__desc">
            {replaceExisting
              ? 'Reorganizamos sua semana pra priorizar o que você quer ver primeiro.'
              : 'Encaixamos seus títulos nos próximos dias livres, sem mexer no que já estava agendado.'}
          </p>

          <div className="build-done__preview">
            {result.slice(0, 4).map((entry) => (
              <div key={entry.entryId} className="build-done__row">
                <span className="build-done__day">{weekdayShort(entry.date)}</span>
                {entry.movie.posterUrl ? (
                  <img src={entry.movie.posterUrl} alt="" />
                ) : (
                  <div className="build-done__poster-empty" />
                )}
                <div className="build-done__row-info">
                  <strong>{contentTitle(entry.movie)}</strong>
                  <span>{formatRuntime(entry.movie.runtime)}</span>
                </div>
              </div>
            ))}
            {result.length === 0 ? (
              <p className="build-done__empty">Nenhum título coube nas próximas noites disponíveis.</p>
            ) : null}
          </div>

          <button
            type="button"
            className="btn btn-primary btn-block build-done__cta"
            onClick={() => {
              notifyCalendarChange();
              navigate('/schedule');
            }}
          >
            Ver agenda completa
          </button>
        </section>
      ) : null}
    </main>
  );
}

function RankingStep({
  ranking,
  onReorder,
  onConfirm,
  submitting,
}: {
  ranking: RankedItem[];
  onReorder: (next: RankedItem[]) => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const rowHeightRef = useRef(0);
  const listTopRef = useRef(0);

  function beginDrag(event: React.PointerEvent, movieId: number) {
    const list = listRef.current;
    if (!list) return;
    const rows = list.querySelectorAll('.rank-row');
    if (rows.length > 1) {
      const r0 = rows[0].getBoundingClientRect();
      const r1 = rows[1].getBoundingClientRect();
      rowHeightRef.current = r1.top - r0.top;
    } else if (rows.length === 1) {
      rowHeightRef.current = rows[0].getBoundingClientRect().height + 10;
    }
    listTopRef.current = list.getBoundingClientRect().top;
    setDragId(movieId);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent) {
    if (dragId == null || rowHeightRef.current <= 0) return;
    const from = ranking.findIndex((r) => r.item.movie.id === dragId);
    if (from < 0) return;
    let to = Math.round((event.clientY - listTopRef.current) / rowHeightRef.current);
    to = Math.max(0, Math.min(ranking.length - 1, to));
    if (to === from) return;
    const next = [...ranking];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  }

  function endDrag() {
    setDragId(null);
  }

  return (
    <section className="build-ranking">
      <div className="build-ranking__head">
        <span className="build-ranking__badge">
          <Check size={13} strokeWidth={2.4} /> Prioridades definidas
        </span>
        <h1 className="build-ranking__title">Seu ranking</h1>
        <p className="build-ranking__desc">Ordem que vamos seguir pra montar sua semana</p>
      </div>

      <div className="rank-list scroll-y" ref={listRef}>
        {ranking.map((ranked, position) => (
          <article
            key={ranked.item.movie.id}
            className={`rank-row${dragId === ranked.item.movie.id ? ' rank-row--dragging' : ''}${
              ranked.wantSoon ? ' rank-row--soon' : ''
            }`}
          >
            <span className="rank-row__num">{position + 1}</span>
            {ranked.item.movie.posterUrl ? (
              <img className="rank-row__poster" src={ranked.item.movie.posterUrl} alt="" draggable={false} />
            ) : (
              <div className="rank-row__poster rank-row__poster--empty" />
            )}
            <div className="rank-row__info">
              <strong>{contentTitle(ranked.item.movie)}</strong>
              <span>
                {formatRuntime(ranked.item.movie.runtime)}
                {ranked.wantSoon ? ' · Quero logo' : ''}
              </span>
            </div>
            <button
              type="button"
              className="rank-row__handle"
              aria-label="Reordenar"
              onPointerDown={(event) => beginDrag(event, ranked.item.movie.id)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <GripVertical size={18} strokeWidth={1.8} />
            </button>
          </article>
        ))}
      </div>

      <div className="build-ranking__footer">
        <p className="build-ranking__foot-hint">Arraste um item pra reordenar</p>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={onConfirm}
          disabled={submitting || ranking.length === 0}
        >
          {submitting ? 'Montando agenda...' : 'Colocar na agenda'}
        </button>
      </div>
    </section>
  );
}
