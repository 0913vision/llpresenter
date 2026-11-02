import * as v from 'valibot';
import type {Result} from '../common/result';
import {parsePayload, payloadObject, type PayloadError} from './payload';

const clientRectSchema = payloadObject({
  left: v.number(),
  top: v.number(),
  right: v.number(),
  bottom: v.number(),
});

/** The box of an element in page pixels, as `getBoundingClientRect` gives it. */
export type ClientRect = Readonly<v.InferOutput<typeof clientRectSchema>>;

/** Checks the JSON text of a page element's box. */
export function parseClientRectJson(
  value: unknown,
): Result<ClientRect, PayloadError> {
  if (typeof value !== 'string') {
    return {ok: false, error: {field: '', message: 'Expected JSON text'}};
  }
  let json: unknown;
  try {
    json = JSON.parse(value);
  } catch {
    return {ok: false, error: {field: '', message: 'Expected valid JSON'}};
  }
  return parsePayload(clientRectSchema, json);
}
