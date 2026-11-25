import {screen} from 'electron';

/**
 * How long after the monitors change a control window whose script answers
 * may draw nothing before that counts as a graphics failure. Windows takes
 * some seconds to lay the displays out again, and the window draws nothing
 * meanwhile (church Nov 25: 18:12, 19:47 and 19:50, each right after a TV or
 * a cable change, restarted every window).
 */
export const DISPLAY_SETTLE_MS = 30_000;

/** How long a stall waits for a display change Windows reports late. */
export const LATE_DISPLAY_CHANGE_MS = 3000;

/**
 * Whether a stalled control window needs its graphics started again. A
 * window whose script does not answer is hung. One whose script answers but
 * that draws nothing is only waiting for the displays when they changed
 * within {@link DISPLAY_SETTLE_MS}.
 */
export function stallNeedsRecovery({
  scriptAnswered,
  lastDisplayChange,
  now,
}: {
  readonly scriptAnswered: boolean;
  /** When the monitors last changed, or null when they have not. */
  readonly lastDisplayChange: number | null;
  readonly now: number;
}): boolean {
  if (!scriptAnswered) return true;
  return (
    lastDisplayChange === null || now - lastDisplayChange > DISPLAY_SETTLE_MS
  );
}

/**
 * Notes when the monitors change: one is added or removed, or one's place,
 * size or scale changes.
 *
 * @returns When they last changed, and a function that stops listening.
 */
export function watchDisplayChanges(now: () => number = Date.now): {
  readonly last: () => number | null;
  readonly stop: () => void;
} {
  let last: number | null = null;
  const changed = (): void => {
    last = now();
  };
  screen.on('display-added', changed);
  screen.on('display-removed', changed);
  screen.on('display-metrics-changed', changed);
  return {
    last: () => last,
    stop: () => {
      screen.removeListener('display-added', changed);
      screen.removeListener('display-removed', changed);
      screen.removeListener('display-metrics-changed', changed);
    },
  };
}
