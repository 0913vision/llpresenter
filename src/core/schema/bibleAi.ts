import * as v from 'valibot';
import {BIBLE_LOOKUP_LIMITS} from './bibleLookup';
import type {ReadonlyKnown} from './fileFormat';
import {parsePayload, payloadObject} from './payload';
import {nonBlankText, nonNegativeInteger} from './primitives';

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

export type BibleAiRequest = ReadonlyKnown<v.InferOutput<typeof requestSchema>>;
export type BibleAiCancel = Readonly<v.InferOutput<typeof cancelSchema>>;
export type BibleAiState = Readonly<v.InferOutput<typeof stateSchema>>;

export function parseBibleAiRequest(value: unknown) {
  return parsePayload(requestSchema, value);
}

export function parseBibleAiCancel(value: unknown) {
  return parsePayload(cancelSchema, value);
}

export function parseBibleAiState(value: unknown) {
  return parsePayload(stateSchema, value);
}

export function parseBibleAiIndex(value: unknown, request: BibleAiRequest) {
  return parsePayload(
    v.pipe(nonNegativeInteger, v.maxValue(request.candidates.length - 1)),
    value,
  );
}

export function parseBibleAiCancelled(value: unknown) {
  return parsePayload(v.boolean(), value);
}
