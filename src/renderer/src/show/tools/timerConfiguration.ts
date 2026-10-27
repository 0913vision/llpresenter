import {checkPart} from '@shared/schema/fileFormat';
import {calendarDate, timeOfDay} from '@shared/schema/primitives';
import {MAX_TIMER_SECONDS} from '@shared/schema/timers';

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

export const timerDateReason = (date: string): string | undefined =>
  checkPart(calendarDate, date).ok
    ? undefined
    : '날짜는 YYYY-MM-DD로 입력해 주세요';

export const timerTimeReason = (time: string): string | undefined =>
  checkPart(timeOfDay, time).ok
    ? undefined
    : '시각은 00:00부터 23:59까지 입력해 주세요';

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

export function localDateText(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
