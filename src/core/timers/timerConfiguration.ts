import {checkPart} from '@core/schema/common/fileFormat';
import {calendarDate, timeOfDay} from '@core/schema/common/primitives';
import {MAX_TIMER_SECONDS} from '@core/schema/tools/timers';

/**
 * The settings of a 타이머 by kind. Durations and starts are in seconds; `overrun`
 * keeps counting past zero.
 */
export type TimerConfiguration =
  | {
      readonly kind: 'countdown';
      readonly duration: number;
      readonly overrun: boolean;
    }
  | {
      readonly kind: 'countdownTo';
      readonly date: string;
      readonly time: string;
      readonly overrun: boolean;
    }
  | {readonly kind: 'elapsed'; readonly start: number}
  | {readonly kind: 'clock'};

/** Why a date text is not valid, or undefined when it is. */
export const timerDateReason = (date: string): string | undefined =>
  checkPart(calendarDate, date).ok ? undefined : '날짜 형식이 맞지 않습니다.';

/** Why a time of day text is not valid, or undefined when it is. */
export const timerTimeReason = (time: string): string | undefined =>
  checkPart(timeOfDay, time).ok ? undefined : '시각 형식이 맞지 않습니다.';

/**
 * Whether the settings can be saved: a valid date and time, or a length or
 * start in whole seconds within the timer limit.
 */
export function validTimerConfiguration(timer: TimerConfiguration): boolean {
  switch (timer.kind) {
    case 'clock':
      return true;
    case 'countdownTo':
      return (
        timerDateReason(timer.date) === undefined &&
        timerTimeReason(timer.time) === undefined
      );
    case 'countdown':
      return (
        Number.isSafeInteger(timer.duration) &&
        timer.duration > 0 &&
        timer.duration <= MAX_TIMER_SECONDS
      );
    case 'elapsed':
      return (
        Number.isSafeInteger(timer.start) &&
        timer.start >= 0 &&
        timer.start <= MAX_TIMER_SECONDS
      );
  }
}

/** The local date as `YYYY-MM-DD`. */
export function localDateText(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
