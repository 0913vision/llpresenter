import * as v from 'valibot';
import type {Result} from '@core/common/result';
import {songIdSchema} from '../common/ids';
import {
  parsePayload,
  payloadObject,
  type PayloadError,
} from '../common/payload';

/** The MIME type that carries a song id while a library song is dragged. */
export const SONG_DRAG_MIME = 'application/x-llp-song';

const songDragPayloadSchema = payloadObject({
  kind: v.literal('song'),
  songId: songIdSchema,
});

/**
 * One library song dropped on the service. The receiver supplies the insertion
 * position, no override, and no start macro.
 */
export type SongDragPayload = Readonly<
  v.InferOutput<typeof songDragPayloadSchema>
>;

/** Checks the payload of a song drag. */
export function parseSongDragPayload(value: unknown) {
  return parsePayload(songDragPayloadSchema, value);
}

/** Checks the custom MIME's JSON without trusting text from DataTransfer. */
export function readSongDragData(
  text: string,
): Result<SongDragPayload, PayloadError> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {ok: false, error: {field: '', message: 'Expected song drag JSON'}};
  }
  return parseSongDragPayload(value);
}

/** Turns a song drag payload into the JSON text for `DataTransfer`. */
export function serializeSongDragPayload(
  value: SongDragPayload,
): Result<string, PayloadError> {
  const parsed = parseSongDragPayload(value);
  return parsed.ok ? {ok: true, value: JSON.stringify(parsed.value)} : parsed;
}
