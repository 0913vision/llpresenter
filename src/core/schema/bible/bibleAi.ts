import * as v from 'valibot';
import {BIBLE_LOOKUP_LIMITS} from './bibleLookup';
import type {ReadonlyKnown} from '../common/fileFormat';
import {parsePayload, payloadObject} from '../common/payload';
import {nonBlankText, nonNegativeInteger} from '../common/primitives';

/**
 * Bounds of a verse comparison by the local AI: the longest lookup id in
 * characters, the most candidates, and the most comparisons waiting.
 */
export const BIBLE_AI_LIMITS = {
  lookupId: 128,
  candidates: 3,
  pending: 8,
} as const;

const lookupId = v.pipe(nonBlankText, v.maxLength(BIBLE_AI_LIMITS.lookupId));
const verseText = v.pipe(
  nonBlankText,
  v.maxLength(BIBLE_LOOKUP_LIMITS.verseText),
);
const cancelSchema = payloadObject({lookupId});
const requestSchema = v.pipe(
  payloadObject({
    lookupId,
    fullText: verseText,
    remaining: verseText,
    candidates: v.pipe(
      v.array(verseText),
      v.minLength(1),
      v.maxLength(BIBLE_AI_LIMITS.candidates),
    ),
  }),
  v.check(
    value =>
      value.fullText.endsWith(value.remaining) &&
      value.candidates.every(text => value.remaining.startsWith(text)),
    'Expected remaining verse text and candidate prefixes',
  ),
);
const stateSchema = v.pipe(
  payloadObject({
    status: v.picklist(['missing', 'starting', 'ready', 'failed', 'stopped']),
    available: v.boolean(),
    reason: v.pipe(v.string(), v.maxLength(BIBLE_LOOKUP_LIMITS.verseText)),
  }),
  v.check(
    state => state.available === (state.status === 'ready'),
    'Availability must match the server status',
  ),
);

/**
 * A question to the local AI where to cut a verse: `remaining` is the end of
 * `fullText` that is still to be cut, and each candidate is a possible first
 * part of it. The AI chooses one.
 */
export type BibleAiRequest = ReadonlyKnown<v.InferOutput<typeof requestSchema>>;
/**
 * Whether the local AI server runs: its `status`, `available` (true only when
 * `ready`), and the `reason` for the status as a text.
 */
export type BibleAiState = Readonly<v.InferOutput<typeof stateSchema>>;

/** Checks a verse comparison request. */
export function parseBibleAiRequest(value: unknown) {
  return parsePayload(requestSchema, value);
}

/** Checks a request to cancel the comparisons of a lookup. */
export function parseBibleAiCancel(value: unknown) {
  return parsePayload(cancelSchema, value);
}

/** Checks the state of the local AI server. */
export function parseBibleAiState(value: unknown) {
  return parsePayload(stateSchema, value);
}

/** Checks the answer to `request`: the index of the chosen candidate. */
export function parseBibleAiIndex(value: unknown, request: BibleAiRequest) {
  return parsePayload(
    v.pipe(nonNegativeInteger, v.maxValue(request.candidates.length - 1)),
    value,
  );
}

/**
 * Checks the answer to a cancel request: whether a comparison was cancelled.
 */
export function parseBibleAiCancelled(value: unknown) {
  return parsePayload(v.boolean(), value);
}
