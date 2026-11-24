import * as v from 'valibot';
import {appFlushRequestIdSchema} from '../common/ids';
import {parsePayload, payloadObject} from '../common/payload';

/** Bounds for main's close-handshake waiter. */
export const APP_FLUSH_LIMITS = {
  timeoutMs: 5000,
  progressIntervalMs: 1000,
  pendingRequests: 1,
} as const;

const requestSchema = payloadObject({requestId: appFlushRequestIdSchema});
const doneSchema = payloadObject({
  requestId: appFlushRequestIdSchema,
  result: v.boolean(),
});

/** Main's request to submit pending control-window edits before closing. */
export type AppFlushRequest = Readonly<v.InferOutput<typeof requestSchema>>;

/** An identified control-window result, matching the editor's boolean flush outcome. */
export type AppFlushDone = Readonly<v.InferOutput<typeof doneSchema>>;

/** Checks main's request to submit pending edits before closing. */
export function parseAppFlushRequest(value: unknown) {
  return parsePayload(requestSchema, value);
}

/** Validates whether main saved every accepted edit to disk. */
export function parseAppSavePendingResult(value: unknown) {
  return parsePayload(v.boolean(), value);
}

/**
 * Checks the control window's answer to a flush request, whose `result` is true
 * when every edit was submitted.
 */
export function parseAppFlushDone(value: unknown) {
  return parsePayload(doneSchema, value);
}
