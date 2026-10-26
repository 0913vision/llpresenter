import * as v from 'valibot';
import {appFlushRequestIdSchema, type AppFlushRequestId} from './ids';
import {parsePayload, payloadObject} from './payload';

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

export function parseAppFlushRequest(value: unknown) {
  return parsePayload(requestSchema, value);
}

/** Validates whether main saved every accepted edit to disk. */
export function parseAppSavePendingResult(value: unknown) {
  return parsePayload(v.boolean(), value);
}

/** Validates a result and optionally the pending request it must answer. */
export function parseAppFlushDone(
  value: unknown,
  expectedRequestId?: AppFlushRequestId,
) {
  const parsed = parsePayload(doneSchema, value);
  return parsed.ok &&
    expectedRequestId !== undefined &&
    parsed.value.requestId !== expectedRequestId
    ? ({
        ok: false,
        error: {
          field: 'requestId',
          message: 'The reply names another flush request',
        },
      } as const)
    : parsed;
}
