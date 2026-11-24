import * as v from 'valibot';
import {screenIdSchema} from '../common/ids';
import {nonBlankText} from '../common/primitives';

/**
 * Bounds for the live state: its size in bytes, the longest text in
 * characters, how many peer slides one slide can carry, and how many screens
 * it can name.
 */
export const LIVE_STATE_LIMITS = {
  bytes: 4 * 1024 * 1024,
  textCharacters: 4000,
  /** Slides whose texts are sized together with the live one. */
  slidePeers: 400,
  outputs: 200,
} as const;

const RECOVERY_HEADER_BYTES = 1024;
/**
 * What the live state may take in bytes: its limit less the room for the
 * recovery header.
 */
export const LIVE_STATE_BYTE_BUDGET =
  LIVE_STATE_LIMITS.bytes - RECOVERY_HEADER_BYTES;

/**
 * A text in the live state, at most `LIVE_STATE_LIMITS.textCharacters`
 * characters; it may be empty.
 */
export const liveTextSchema = v.pipe(
  v.string(),
  v.maxLength(LIVE_STATE_LIMITS.textCharacters),
);
/**
 * A text in the live state with something in it, at most
 * `LIVE_STATE_LIMITS.textCharacters` characters.
 */
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
