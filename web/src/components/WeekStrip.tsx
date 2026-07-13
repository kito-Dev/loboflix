import { Link } from 'react-router-dom';
import { toLocalDateKey } from '../utils/date';

const DOW = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export type WeekDay = {
  date: Date;
  dateKey: string;
  dow: string;
  num: number;
  isToday: boolean;
  isActive: boolean;
  hasSchedule: boolean;
  isDisabled?: boolean;
};

export function buildWeekDays(activeDate = new Date(), scheduledDates = new Set<string>()): WeekDay[] {
  const start = new Date(activeDate);
  start.setHours(12, 0, 0, 0);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);

  const todayKey = toLocalDateKey(new Date());
  const activeKey = toLocalDateKey(activeDate);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = toLocalDateKey(date);
    return {
      date,
      dateKey,
      dow: DOW[date.getDay()],
      num: date.getDate(),
      isToday: dateKey === todayKey,
      isActive: dateKey === activeKey,
      hasSchedule: scheduledDates.has(dateKey),
    };
  });
}

export function toDateKey(date: Date) {
  return toLocalDateKey(date);
}

type Props = {
  days: WeekDay[];
  onSelect?: (day: WeekDay) => void;
  seeAllTo?: string;
  title?: string;
};

export function WeekStrip({ days, onSelect, seeAllTo, title = 'Sua semana' }: Props) {
  return (
    <section className="week-section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {seeAllTo ? (
          <Link className="section-link" to={seeAllTo}>
            Ver tudo
          </Link>
        ) : null}
      </div>
      <div className="week-strip scroll-x">
        {days.map((day) => (
          <button
            key={day.dateKey}
            type="button"
            className={`week-pill${day.isActive ? ' week-pill--active' : ''}${day.hasSchedule && !day.isActive && !day.isDisabled ? ' week-pill--scheduled' : ''}${day.isDisabled ? ' week-pill--disabled' : ''}`}
            onClick={() => {
              if (!day.isDisabled) onSelect?.(day);
            }}
            disabled={day.isDisabled}
            aria-disabled={day.isDisabled}
          >
            <span className="week-pill__dow">{day.dow}</span>
            <span className="week-pill__num">{day.num}</span>
            <span className="week-pill__dot" />
          </button>
        ))}
      </div>
    </section>
  );
}
