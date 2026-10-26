import type {Timer} from './schema/timers';
import type {TimerRun} from './schema/timerState';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const TIME_PART_WIDTH = 2;

/**
 * The milliseconds a run has counted at `now`. A clock that steps back never
 * makes it count backwards.
 */
export function countedMs(run: TimerRun | undefined, now: number): number {
  if (run === undefined) return 0;
  return run.state === 'running'
    ? run.countedMs + Math.max(0, now - run.since)
    : run.countedMs;
}

/** Whether the shown value changes by itself: a running 타이머, or a clock. */
export function isTimerTicking(
  timer: Timer,
  run: TimerRun | undefined,
): boolean {
  return timer.kind === 'clock' || run?.state === 'running';
}

/**
 * The text a 타이머 shows at `now` (docs/spec/04-show.md, "타이머"): "m:ss"
 * under an hour and "h:mm:ss" from an hour, with a leading "-" past 0, and
 * "HH:mm:ss" for a clock. A paused 타이머 shows its value at the pause; a
 * wall-clock 타이머 that hasn't started shows its value as of `now`.
 */
export function timerText(
  timer: Timer,
  run: TimerRun | undefined,
  now: number,
): string {
  switch (timer.kind) {
    case 'countdown':
      return durationText(
        Math.ceil(
          (timer.duration * MS_PER_SECOND - countedMs(run, now)) /
            MS_PER_SECOND,
        ),
      );
    case 'countdownTo': {
      const at = readingTime(run, now);
      return durationText(
        Math.ceil((todayAt(timer.time, at) - at) / MS_PER_SECOND),
      );
    }
    case 'elapsedFrom': {
      const at = readingTime(run, now);
      return durationText(
        Math.floor((at - todayAt(timer.time, at)) / MS_PER_SECOND),
      );
    }
    case 'clock':
      return clockText(now);
    default: {
      const unknown: never = timer;
      return unknown;
    }
  }
}

function readingTime(run: TimerRun | undefined, now: number): number {
  return run?.state === 'paused' ? run.at : now;
}

function todayAt(time: string, reference: number): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const date = new Date(reference);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

function twoDigits(value: number): string {
  return String(value).padStart(TIME_PART_WIDTH, '0');
}

function durationText(signedSeconds: number): string {
  const seconds = Math.abs(signedSeconds);
  const sign = signedSeconds < 0 ? '-' : '';
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const rest = twoDigits(seconds % SECONDS_PER_MINUTE);
  return hours === 0
    ? `${sign}${minutes}:${rest}`
    : `${sign}${hours}:${twoDigits(minutes)}:${rest}`;
}

function clockText(now: number): string {
  const date = new Date(now);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(twoDigits)
    .join(':');
}
