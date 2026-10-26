import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {timerIdSchema} from './ids';
import {epochMillisecondsSchema} from './overlayState';
import {plainObject} from './payload';
import {nonNegativeNumber} from './primitives';

/** At most this many 타이머 carry a run in the live state. */
export const MAX_LIVE_TIMERS = 200;

const countedMs = v.pipe(
  nonNegativeNumber,
  v.maxValue(Number.MAX_SAFE_INTEGER),
);

const timerRunSchema = v.pipe(
  plainObject,
  v.variant('state', [
    v.object({
      state: v.literal('running'),
      since: epochMillisecondsSchema,
      countedMs,
    }),
    v.object({
      state: v.literal('paused'),
      at: epochMillisecondsSchema,
      countedMs,
    }),
  ]),
);

/** The runs of the started 타이머, by 타이머 id. A 타이머 without one is stopped. */
export const timerRunsSchema = v.pipe(
  plainObject,
  v.record(timerIdSchema, timerRunSchema),
  v.maxEntries(MAX_LIVE_TIMERS),
);

/**
 * One started 타이머: running since a main-clock time, or paused at one, with
 * the milliseconds it counted before that.
 */
export type TimerRun = ReadonlyKnown<v.InferOutput<typeof timerRunSchema>>;

export type TimerRuns = ReadonlyKnown<v.InferOutput<typeof timerRunsSchema>>;
