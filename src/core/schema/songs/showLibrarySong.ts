import * as v from 'valibot';
import {revisionSchema} from '../services/contentDocuments';
import type {ReadonlyKnown} from '../common/fileFormat';
import {songIdSchema, type SongId} from '../common/ids';
import {parsePayload, payloadObject} from '../common/payload';
import {showTileSchema} from '../services/showService';
import {SLIDE_LIMITS} from '../slides/slide';

const requestSchema = payloadObject({songId: songIdSchema});
const songSchema = payloadObject({
  songId: songIdSchema,
  songRevision: revisionSchema,
  title: v.string(),
  readOnly: v.boolean(),
  tiles: v.pipe(v.array(showTileSchema), v.maxLength(SLIDE_LIMITS.slides)),
  problem: v.exactOptional(v.literal('newer-version')),
});

/** A request to project the library song with this id in 진행. */
export type ShowLibrarySongRequest = Readonly<
  v.InferOutput<typeof requestSchema>
>;

/** A library song projected for 진행 without a service item. */
export type ShowLibrarySong = ReadonlyKnown<v.InferOutput<typeof songSchema>>;

/** Checks a request to project a library song. */
export function parseShowLibrarySongRequest(value: unknown) {
  return parsePayload(requestSchema, value);
}

/**
 * Checks the answer to a request to project a library song: the song, or `null`
 * when it is gone.
 */
export function parseShowLibrarySong(value: unknown) {
  return parsePayload(v.nullable(songSchema), value);
}

/**
 * Checks the answer like {@link parseShowLibrarySong}, and refuses one that
 * names a song other than the one asked for.
 */
export function parseShowLibrarySongReply(songId: SongId, value: unknown) {
  const parsed = parseShowLibrarySong(value);
  return parsed.ok && parsed.value !== null && parsed.value.songId !== songId
    ? ({
        ok: false,
        error: {field: 'songId', message: 'The reply names another song'},
      } as const)
    : parsed;
}
