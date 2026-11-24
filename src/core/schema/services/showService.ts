import * as v from 'valibot';
import {labelColorSchema} from './labelColor';
import type {Result} from '@core/common/result';
import type {ReadonlyKnown} from '../common/fileFormat';
import {biblePassageSchema} from '../bible/biblePassage';
import {songIdSchema} from '../common/ids';
import {autoValuesSchema} from '../live/liveState';
import {liveItemKinds} from '../live/liveTheme';
import {SLIDE_LIMITS, slideSchema} from '../slides/slide';
import {
  parsePayload,
  payloadObject,
  plainObject,
  type PayloadError,
} from '../common/payload';

/**
 * Why a row of the 예배 순서 shows a warning icon. `newer-version`: the song
 * file comes from a newer app version, so it opens read-only.
 */
export const showRowProblems = [
  'missing-song',
  'missing-media',
  'unknown-kind',
  'newer-version',
] as const;

const id = v.pipe(v.string(), v.nonEmpty());

const showRowSchema = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({kind: v.literal('header'), id, title: v.string()}),
    v.object({
      kind: v.picklist([...liveItemKinds, 'unknown']),
      id,
      title: v.string(),
      problem: v.exactOptional(v.picklist(showRowProblems)),
      song: v.exactOptional(songIdSchema),
      passage: v.exactOptional(biblePassageSchema),
    }),
  ]),
);

/**
 * One slide as 진행 shows it: the slide, its `auto` values, and the `labelColor`
 * of its 이름표.
 */
export const showTileSchema = payloadObject({
  slide: slideSchema,
  auto: autoValuesSchema,
  /** What the tile is called under its picture. */
  caption: v.nullable(v.string()),
  labelColor: labelColorSchema,
});

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
      v.pipe(v.array(showTileSchema), v.maxLength(SLIDE_LIMITS.slides)),
    ),
  ),
});

/**
 * The open 예배 순서 as 진행 shows it. `revision` grows on every change, and a
 * window drops one older than what it has. `readOnly`: the 예배 순서 file comes
 * from a newer app version, so it can't be edited, and 진행 shows a warning.
 */
export type ShowService = ReadonlyKnown<
  v.InferOutput<typeof showServiceSchema>
>;

/**
 * One row, with the service item's id. Rows of a kind this version doesn't
 * know show a warning and can't be output.
 */
export type ShowRow = ShowService['rows'][number];

/** One slide of an item, with what is worked out for it. */
export type ShowTile = ShowService['tiles'][string][number];

/** Checks a `service:get` reply or a `service:changed` push. Never throws. */
export function parseShowService(
  value: unknown,
): Result<ShowService | null, PayloadError> {
  return value === null
    ? {ok: true, value: null}
    : parsePayload(showServiceSchema, value);
}
