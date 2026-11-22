import * as v from 'valibot';
import {revisionSchema} from './contentDocuments';
import type {ReadonlyKnown} from './fileFormat';
import {songIdSchema, type SongId} from './ids';
import {parsePayload, payloadObject} from './payload';
import {showTileSchema} from './showService';
import {SLIDE_LIMITS} from './slide';

const requestSchema = payloadObject({songId: songIdSchema});
const songSchema = payloadObject({
  songId: songIdSchema,
  songRevision: revisionSchema,
  title: v.string(),
  readOnly: v.boolean(),
  tiles: v.pipe(v.array(showTileSchema), v.maxLength(SLIDE_LIMITS.slides)),
  problem: v.exactOptional(v.literal('newer-version')),
});

export type ShowLibrarySongRequest = Readonly<
  v.InferOutput<typeof requestSchema>
>;

/** A library song projected for 진행 without a service item. */
export type ShowLibrarySong = ReadonlyKnown<v.InferOutput<typeof songSchema>>;

export function parseShowLibrarySongRequest(value: unknown) {
  return parsePayload(requestSchema, value);
}

export function parseShowLibrarySong(value: unknown) {
  return parsePayload(v.nullable(songSchema), value);
}

export function parseShowLibrarySongReply(songId: SongId, value: unknown) {
  const parsed = parseShowLibrarySong(value);
  return parsed.ok && parsed.value !== null && parsed.value.songId !== songId
    ? ({
        ok: false,
        error: {field: 'songId', message: 'The reply names another song'},
      } as const)
    : parsed;
}
