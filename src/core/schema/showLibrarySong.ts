import * as v from 'valibot';
import {revisionSchema} from './contentDocuments';
import type {ReadonlyKnown} from './fileFormat';
import {songIdSchema, type SongId} from './ids';
import {mediaChoiceSchema} from './liveState';
import {parsePayload, payloadObject, plainObject} from './payload';
import {showTileSchema} from './showService';

export const SHOW_LIBRARY_SONG_LIMITS = {
  tiles: 10_000,
  linesPerTile: 1000,
  jumpKeys: 200,
} as const;

const requestSchema = payloadObject({songId: songIdSchema});
const tileSchema = v.pipe(
  showTileSchema,
  v.check(
    tile => tile.lines.length <= SHOW_LIBRARY_SONG_LIMITS.linesPerTile,
    'A tile has too many lines',
  ),
);
const songSchema = payloadObject({
  songId: songIdSchema,
  songRevision: revisionSchema,
  title: v.string(),
  readOnly: v.boolean(),
  tiles: v.pipe(
    v.array(tileSchema),
    v.maxLength(SHOW_LIBRARY_SONG_LIMITS.tiles),
  ),
  jumpKeys: v.pipe(
    plainObject,
    v.record(v.string(), v.string()),
    v.maxEntries(SHOW_LIBRARY_SONG_LIMITS.jumpKeys),
  ),
  background: v.exactOptional(mediaChoiceSchema),
  problem: v.exactOptional(
    v.picklist(['missing-background', 'newer-version', 'tile-limit']),
  ),
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
