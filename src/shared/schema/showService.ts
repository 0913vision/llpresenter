import * as v from 'valibot';
import {NO_LABEL_COLOR, paletteColors} from '../colors';
import type {Result} from '../result';
import type {ReadonlyKnown} from './fileFormat';
import {mediaChoiceSchema} from './liveState';
import {slotKinds} from './service';
import {songIdSchema, songGroupIdSchema} from './ids';
import {nonNegativeInteger} from './primitives';
import {slideHotKeySchema} from './slideHotKey';
import {
  parsePayload,
  payloadObject,
  plainObject,
  type PayloadError,
} from './payload';

/**
 * Why a row of the 예배 순서 shows a warning icon. `newer-version`: the song
 * file comes from a newer app version, so it opens read-only.
 */
export const showRowProblems = [
  'missing-song',
  'missing-background',
  'missing-media',
  'unknown-kind',
  'newer-version',
] as const;

export const SHOW_SERVICE_LIMITS = {
  tiles: 10_000,
} as const;

const id = v.pipe(v.string(), v.nonEmpty());

const showRowSchema = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({kind: v.literal('header'), id, title: v.string()}),
    v.object({
      kind: v.literal('song'),
      id,
      title: v.string(),
      problem: v.exactOptional(v.picklist(showRowProblems)),
      background: v.exactOptional(mediaChoiceSchema),
    }),
    v.object({
      kind: v.literal('slot'),
      id,
      title: v.string(),
      problem: v.exactOptional(v.picklist(showRowProblems)),
      accepts: v.exactOptional(v.picklist(slotKinds)),
    }),
    v.object({
      kind: v.picklist(['bible', 'media', 'notice', 'unknown']),
      id,
      title: v.string(),
      problem: v.exactOptional(v.picklist(showRowProblems)),
    }),
  ]),
);

/** Source identity within the projected song revision; slideIndex is zero-based. */
export const songSlideSourceSchema = payloadObject({
  songId: songIdSchema,
  groupId: songGroupIdSchema,
  slideIndex: nonNegativeInteger,
});

export type SongSlideSource = ReadonlyKnown<
  v.InferOutput<typeof songSlideSourceSchema>
>;

export const showTileSchema = v.pipe(
  payloadObject({
    label: v.nullable(v.string()),
    labelColor: v.picklist([...paletteColors, NO_LABEL_COLOR]),
    lines: v.array(v.string()),
    hotKey: v.exactOptional(slideHotKeySchema),
    sourceSlide: v.exactOptional(songSlideSourceSchema),
  }),
  v.forward(
    v.check(
      tile => tile.hotKey === undefined || tile.sourceSlide !== undefined,
      'An assigned hot key needs its source slide',
    ),
    ['sourceSlide'],
  ),
);

const showServiceSchema = payloadObject({
  revision: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id,
  name: v.string(),
  readOnly: v.boolean(),
  rows: v.array(showRowSchema),
  tiles: v.pipe(
    plainObject,
    v.record(
      v.string(),
      v.pipe(v.array(showTileSchema), v.maxLength(SHOW_SERVICE_LIMITS.tiles)),
    ),
  ),
  jumpKeys: v.pipe(plainObject, v.record(v.string(), v.string())),
});

/**
 * The open 예배 순서 as 진행 shows it. The main process resolves every item,
 * so the renderer never reads song files. `revision` grows on every change,
 * and a window drops one older than what it has. `readOnly`: the 예배 순서
 * file comes from a newer app version, so it can't be edited, and 진행 shows
 * a warning.
 */
export type ShowService = ReadonlyKnown<
  v.InferOutput<typeof showServiceSchema>
>;

/**
 * One row, with the service item's id. Rows of a kind this version doesn't
 * know show a warning and can't be output.
 * Song rows may carry their resolved, available background as a media choice.
 */
export type ShowRow = ShowService['rows'][number];

/**
 * One tile of a song item, in the order of the item's 구성. A 장 that repeats
 * has a tile for each time, and a tile's position is its index in the list.
 */
export type ShowTile = ShowService['tiles'][string][number];

/** Checks a `service:get` reply or a `service:changed` push. Never throws. */
export function parseShowService(
  value: unknown,
): Result<ShowService | null, PayloadError> {
  return value === null
    ? {ok: true, value: null}
    : parsePayload(showServiceSchema, value);
}
