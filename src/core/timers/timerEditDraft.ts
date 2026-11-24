import type {Timer} from '@core/schema/tools/timers';
import type {TimerConfiguration} from './timerConfiguration';

/** The settings of a 타이머 while it is edited. */
export type TimerEditDraft = TimerConfiguration;

/**
 * The edit settings of a saved 타이머. A count-down-to timer without a date gets
 * `undatedDate`, and an unset `overrun` reads as true.
 */
export function timerEditDraft(
  timer: Timer,
  undatedDate: string,
): TimerEditDraft {
  switch (timer.kind) {
    case 'countdown':
      return {
        kind: timer.kind,
        duration: timer.duration,
        overrun: timer.overrun ?? true,
      };
    case 'countdownTo':
      return {
        kind: timer.kind,
        date: timer.date ?? undatedDate,
        time: timer.time,
        overrun: timer.overrun ?? true,
      };
    case 'elapsed':
      return {kind: timer.kind, start: timer.start};
    case 'clock':
      return {kind: timer.kind};
  }
}
