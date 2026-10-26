import type {Timer} from '@shared/schema/timers';
import type {TimerRuns} from '@shared/schema/timerState';
import {isTimerTicking, timerText} from '@shared/timerClock';

/** The 타이머 definitions and live runs that 소품 text reads its tokens from. */
export interface RenderTimers {
  readonly list: readonly Timer[];
  readonly runs: TimerRuns | undefined;
}

const TIMER_TOKEN = /\{timer:([0-9a-f-]{36})\}/g;

function runOf(timers: RenderTimers, id: string) {
  return Object.entries(timers.runs ?? {}).find(([key]) => key === id)?.[1];
}

/**
 * The text with each `{timer:<id>}` token replaced by that 타이머's value at
 * `now` (docs/spec/02-data.md, 소품). A token of a 타이머 that is gone reads
 * as nothing.
 */
export function fillTimerTokens(
  text: string,
  timers: RenderTimers,
  now: number,
): string {
  return text.replace(TIMER_TOKEN, (_token, id: string) => {
    const timer = timers.list.find(item => item.id === id);
    return timer === undefined ? '' : timerText(timer, runOf(timers, id), now);
  });
}

/** Whether the text shows a value that changes by itself. */
export function hasTickingToken(text: string, timers: RenderTimers): boolean {
  for (const [, id] of text.matchAll(TIMER_TOKEN)) {
    const timer = timers.list.find(item => item.id === id);
    if (timer !== undefined && isTimerTicking(timer, runOf(timers, id ?? ''))) {
      return true;
    }
  }
  return false;
}
