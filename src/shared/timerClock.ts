import type {Timer} from './schema/timers';
import type {TimerRun} from './schema/timerState';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const TIME_PART_WIDTH = 2;

/** The two clocks a 타이머 reads: main's monotonic 타이머 clock and the wall clock. */
export interface TimerNow {
  readonly timer: number;
  readonly wall: number;
}

/**
 * The milliseconds a run has counted at `timerNow` on the monotonic 타이머
 * clock. A reading earlier than the run's start adds nothing.
 */
export function countedMs(run: TimerRun | undefined, timerNow: number): number {
  if (run === undefined) return 0;
  return run.state === 'running'
    ? run.countedMs + Math.max(0, timerNow - run.since)
    : run.countedMs;
}

/** The local midnight, on the wall clock, of the day of `wall`. */
export function localDay(wall: number): number {
  const date = new Date(wall);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Whether the shown value changes by itself: a running 타이머, or a clock. */
export function isTimerTicking(
  timer: Timer,
  run: TimerRun | undefined,
): boolean {
  return timer.kind === 'clock' || run?.state === 'running';
}

/**
 * The text a 타이머 shows (docs/spec/04-show.md, "타이머"): "m:ss" under an
 * hour and "h:mm:ss" from an hour, with a leading "-" past 0, and "HH:mm:ss"
 * for a clock. A countdown counts on the monotonic clock, so a wall-clock
 * correction never moves it. A 타이머 that reads the time of day reads its set
 * time on the day its run started, at the wall-clock moment of a pause, and
 * before it starts as of now.
 */
export function timerText(
  timer: Timer,
  run: TimerRun | undefined,
  now: TimerNow,
): string {
  switch (timer.kind) {
    case 'countdown':
      return durationText(
        Math.ceil(
          (timer.duration * MS_PER_SECOND - countedMs(run, now.timer)) /
            MS_PER_SECOND,
        ),
      );
    case 'countdownTo': {
      const at = wallReading(run, now);
      return durationText(
        Math.ceil((setTimeOn(timer.time, run, now) - at) / MS_PER_SECOND),
      );
    }
    case 'elapsedFrom': {
      const at = wallReading(run, now);
      return durationText(
        Math.floor((at - setTimeOn(timer.time, run, now)) / MS_PER_SECOND),
      );
    }
    case 'clock':
      return clockText(now.wall);
    default: {
      const unknown: never = timer;
      return unknown;
    }
  }
}

function wallReading(run: TimerRun | undefined, now: TimerNow): number {
  return run?.state === 'paused' ? run.wallAt : now.wall;
}

function setTimeOn(
  time: string,
  run: TimerRun | undefined,
  now: TimerNow,
): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const date = new Date(run?.day ?? localDay(now.wall));
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

function clockText(wall: number): string {
  const date = new Date(wall);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(twoDigits)
    .join(':');
}
