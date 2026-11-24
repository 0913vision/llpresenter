import * as v from 'valibot';
import {screenIdSchema} from '../common/ids';
import {nonBlankText} from '../common/primitives';

export const LIVE_STATE_LIMITS = {
  bytes: 4 * 1024 * 1024,
  textCharacters: 4000,
  /** Slides whose texts are sized together with the live one. */
  slidePeers: 400,
  outputs: 200,
} as const;

const RECOVERY_HEADER_BYTES = 1024;
export const LIVE_STATE_BYTE_BUDGET =
  LIVE_STATE_LIMITS.bytes - RECOVERY_HEADER_BYTES;

export const liveTextSchema = v.pipe(
  v.string(),
  v.maxLength(LIVE_STATE_LIMITS.textCharacters),
);
export const liveNonBlankTextSchema = v.pipe(
  nonBlankText,
  v.maxLength(LIVE_STATE_LIMITS.textCharacters),
);
/** The output on or off of each screen, by screen id and nothing else. */
export const liveOutputsSchema = v.pipe(
  v.record(v.string(), v.boolean()),
  v.maxEntries(LIVE_STATE_LIMITS.outputs),
  v.check(
    outputs => Object.keys(outputs).every(key => v.is(screenIdSchema, key)),
    'Expected screen ids as output keys',
  ),
);
