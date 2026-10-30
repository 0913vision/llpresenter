import type {Timer} from '@core/schema/timers';
import type {TimerConfiguration} from './timerConfiguration';

export type TimerEditDraft =
  TimerConfiguration | {readonly kind: 'elapsedFrom'; readonly time: string};

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
    case 'elapsedFrom':
      return {kind: timer.kind, time: timer.time};
    case 'clock':
      return {kind: timer.kind};
  }
}
