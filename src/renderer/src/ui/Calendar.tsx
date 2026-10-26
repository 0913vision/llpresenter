import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {createPortal} from 'react-dom';
import {Button} from './Button';
import {IconButton} from './IconButton';
import {layerContainer} from './layers';
import {modalStack} from './modalStack';
import {useCalendarSurface} from './useCalendarSurface';
import {tabbableElements} from './useModal';
import {isComposing} from './ime';
import {
  calendarDateLabel,
  calendarDateValue,
  calendarDays,
  calendarMonthLabel,
  calendarWeekday,
  localCalendarDate,
  parseCalendarDate,
  shiftCalendarDays,
  shiftCalendarMonths,
  type CalendarDate,
} from './calendarDates';
import styles from './Calendar.module.css';

export type CalendarCloseReason = 'choose' | 'escape' | 'outside';

export interface CalendarProps {
  readonly id?: string | undefined;
  readonly anchor: HTMLElement;
  readonly value: string;
  readonly today?: string | undefined;
  readonly onChange: (date: string) => void;
  readonly onClose: (reason: CalendarCloseReason) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const WEEK_LENGTH = 7;
const WEEKS = 6;
const YEAR_MONTHS = 12;

function moveDay(
  date: CalendarDate,
  event: KeyboardEvent,
): CalendarDate | null {
  switch (event.key) {
    case 'ArrowLeft':
      return shiftCalendarDays(date, -1);
    case 'ArrowRight':
      return shiftCalendarDays(date, 1);
    case 'ArrowUp':
      return shiftCalendarDays(date, -WEEK_LENGTH);
    case 'ArrowDown':
      return shiftCalendarDays(date, WEEK_LENGTH);
    case 'Home':
      return shiftCalendarDays(date, -calendarWeekday(date));
    case 'End':
      return shiftCalendarDays(date, WEEK_LENGTH - 1 - calendarWeekday(date));
    case 'PageUp':
      return shiftCalendarMonths(date, event.shiftKey ? -YEAR_MONTHS : -1);
    case 'PageDown':
      return shiftCalendarMonths(date, event.shiftKey ? YEAR_MONTHS : 1);
    default:
      return null;
  }
}

function currentToday(value: string | undefined): CalendarDate {
  return parseCalendarDate(value ?? '') ?? localCalendarDate(new Date());
}

/** A bounded date grid in the popover layer; browsing never commits a date. */
export function Calendar({
  id,
  anchor,
  value,
  today,
  onChange,
  onClose,
}: CalendarProps): JSX.Element {
  const todayDate = currentToday(today);
  const [view, setView] = useState(() => ({
    date: parseCalendarDate(value) ?? todayDate,
    focus: true,
  }));
  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) {
    setSeenValue(value);
    setView({date: parseCalendarDate(value) ?? todayDate, focus: true});
  }
  const {surface, ref} = useCalendarSurface(anchor, () => onClose('outside'));
  const focusedDay = useRef<HTMLButtonElement>(null);
  const monthId = useId();
  const activeValue = calendarDateValue(view.date);
  const todayValue = calendarDateValue(todayDate);
  const days = calendarDays(view.date);

  useLayoutEffect(() => {
    if (view.focus) focusedDay.current?.focus({preventScroll: true});
  }, [activeValue, view.focus]);

  const choose = (date: string): void => {
    onChange(date);
    onClose('choose');
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isComposing(event)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose('escape');
    } else if (event.key === 'Tab' && surface.current !== null) {
      const cycle = tabbableElements(surface.current).filter(
        element =>
          element.tabIndex >= 0 &&
          element.getAttribute('aria-disabled') !== 'true',
      );
      const index = cycle.findIndex(
        element => element === document.activeElement,
      );
      const next =
        (index + (event.shiftKey ? -1 : 1) + cycle.length) % cycle.length;
      event.preventDefault();
      event.stopPropagation();
      cycle[next]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.stopPropagation();
    }
  };
  const dayKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (isComposing(event) || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    const next = moveDay(view.date, event);
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    setView({date: next, focus: true});
  };

  return createPortal(
    <div
      id={id}
      role="dialog"
      aria-label="날짜 선택"
      data-over-modal={modalStack.isOpen || undefined}
      className={styles.calendar}
      onKeyDown={keyDown}
      ref={ref}
    >
      <div className={styles.head}>
        <IconButton
          icon="right"
          label="이전 달"
          className={styles.previous}
          disabled={view.date.year === 0 && view.date.month === 1}
          onClick={() =>
            setView({date: shiftCalendarMonths(view.date, -1), focus: false})
          }
        />
        <span
          id={monthId}
          role="heading"
          aria-level={2}
          aria-live="polite"
          className={styles.month}
        >
          {calendarMonthLabel(view.date)}
        </span>
        <IconButton
          icon="right"
          label="다음 달"
          disabled={view.date.year === 9999 && view.date.month === 12}
          onClick={() =>
            setView({date: shiftCalendarMonths(view.date, 1), focus: false})
          }
        />
      </div>
      <div role="grid" aria-labelledby={monthId} className={styles.grid}>
        <div role="row" className={styles.week}>
          {WEEKDAYS.map(day => (
            <span role="columnheader" key={day} className={styles.weekday}>
              {day}
            </span>
          ))}
        </div>
        {Array.from({length: WEEKS}, (_, week) => (
          <div role="row" className={styles.week} key={week}>
            {days
              .slice(week * WEEK_LENGTH, (week + 1) * WEEK_LENGTH)
              .map(day => (
                <div
                  role="gridcell"
                  aria-selected={day.value === value}
                  key={calendarDateValue(day.date)}
                >
                  <button
                    type="button"
                    className={styles.day}
                    aria-label={calendarDateLabel(day.date)}
                    aria-current={day.value === todayValue ? 'date' : undefined}
                    data-outside={!day.currentMonth || undefined}
                    disabled={day.value === null}
                    tabIndex={day.value === activeValue ? 0 : -1}
                    ref={day.value === activeValue ? focusedDay : undefined}
                    onKeyDown={dayKeyDown}
                    onClick={() => {
                      if (day.value !== null) choose(day.value);
                    }}
                  >
                    {day.date.day}
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>
      <div className={styles.foot}>
        <Button onClick={() => choose(calendarDateValue(currentToday(today)))}>
          오늘
        </Button>
      </div>
    </div>,
    layerContainer('popover'),
  );
}
