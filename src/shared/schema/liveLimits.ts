import * as v from 'valibot';
import {nonBlankText} from './primitives';

export const LIVE_STATE_LIMITS = {
  bytes: 4 * 1024 * 1024,
  textCharacters: 4000,
  slideLines: 1000,
  outputs: 200,
} as const;

const RECOVERY_HEADER_BYTES = 1024;
export const LIVE_STATE_BYTE_BUDGET =
  LIVE_STATE_LIMITS.bytes - RECOVERY_HEADER_BYTES;

export const LIVE_OUTPUT_ALIASES = [
  'main',
  'stage',
  'broadcast',
  'captions',
] as const;

export const liveTextSchema = v.pipe(
  v.string(),
  v.maxLength(LIVE_STATE_LIMITS.textCharacters),
);
export const liveNonBlankTextSchema = v.pipe(
  nonBlankText,
  v.maxLength(LIVE_STATE_LIMITS.textCharacters),
);
export const liveOutputsSchema = v.pipe(
  v.record(v.string(), v.boolean()),
  v.maxEntries(LIVE_STATE_LIMITS.outputs + LIVE_OUTPUT_ALIASES.length),
  v.check(
    outputs =>
      Object.keys(outputs).filter(
        key => !LIVE_OUTPUT_ALIASES.some(alias => alias === key),
      ).length <= LIVE_STATE_LIMITS.outputs,
    'Too many live outputs',
  ),
);

/** Includes recovery's state indentation and reserves room for its bounded header. */
export function fitsLiveStateByteBudget(state: unknown): boolean {
  try {
    const text = `${JSON.stringify({state}, null, 2)}\n`;
    return (
      text.length <= LIVE_STATE_BYTE_BUDGET &&
      new TextEncoder().encode(text).byteLength <= LIVE_STATE_BYTE_BUDGET
    );
  } catch {
    return false;
  }
}
