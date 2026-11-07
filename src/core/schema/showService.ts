import * as v from 'valibot';
import {labelColorSchema} from './labelColor';
import type {Result} from '../common/result';
import type {ReadonlyKnown} from './fileFormat';
import {biblePartSchema, mediaChoiceSchema} from './liveState';
import {BIBLE_LOOKUP_LIMITS, bibleLookupPassageSchema} from './bibleLookup';
import {bibleVerseReferenceSchema, SLIDES_LIMITS} from './service';
import {bibleReferenceSchema as bibleReferenceFrequencySchema} from './biblePassage';
import {
  mediaIdSchema,
  slideIdSchema,
  songIdSchema,
  songSlideIdSchema,
  translationIdSchema,
  themeIdSchema,
} from './ids';
import {nonBlankText, positiveInteger} from './primitives';
import {slideHotKeySchema} from './slideHotKey';
import {liveTextSchema} from './liveLimits';
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
  'missing-bible',
  'missing-background',
  'missing-media',
  'unknown-kind',
  'newer-version',
  'tile-limit',
] as const;

export const SHOW_SERVICE_LIMITS = {
  tiles: 10_000,
} as const;

const id = v.pipe(v.string(), v.nonEmpty());
const bibleReferenceSchema = v.pipe(
  payloadObject({
    translation: v.pipe(
      translationIdSchema,
      v.maxLength(BIBLE_LOOKUP_LIMITS.translationId),
    ),
    ref: v.pipe(nonBlankText, v.maxLength(BIBLE_LOOKUP_LIMITS.input)),
    verseNumbers: v.exactOptional(v.boolean()),
    translationName: v.exactOptional(v.boolean()),
    reference: v.exactOptional(bibleReferenceFrequencySchema),
    theme: v.exactOptional(themeIdSchema),
    passage: v.exactOptional(
      v.pipe(
        bibleLookupPassageSchema,
        v.check(
          passage => passage.verses.length <= SHOW_SERVICE_LIMITS.tiles,
          'Too many source Bible verses',
        ),
      ),
    ),
  }),
  v.check(
    bible =>
      bible.passage === undefined ||
      (bible.passage.translation === bible.translation &&
        bible.passage.ref === bible.ref),
    'Bible source must match its reference',
  ),
);

const showRowSchema = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({kind: v.literal('header'), id, title: v.string()}),
    v.object({
      kind: v.literal('song'),
      id,
      title: v.string(),
      theme: v.exactOptional(themeIdSchema),
      problem: v.exactOptional(v.picklist(showRowProblems)),
      background: v.exactOptional(mediaChoiceSchema),
    }),
    v.object({
      kind: v.literal('slides'),
      id,
      title: v.string(),
      form: v.picklist(['blank', 'ad']),
      sourceRevision: v.exactOptional(positiveInteger),
      theme: v.exactOptional(themeIdSchema),
      background: v.exactOptional(mediaChoiceSchema),
      problem: v.exactOptional(v.picklist(showRowProblems)),
    }),
    v.object({
      kind: v.literal('bible'),
      id,
      title: v.string(),
      problem: v.exactOptional(v.picklist(showRowProblems)),
      bible: v.exactOptional(bibleReferenceSchema),
    }),
    v.object({
      kind: v.picklist(['media', 'unknown']),
      id,
      title: v.string(),
      problem: v.exactOptional(v.picklist(showRowProblems)),
    }),
  ]),
);

/** Stable identity in the library song or the service item's own deck. */
export const songSlideSourceSchema = payloadObject({
  songId: songIdSchema,
  slideId: songSlideIdSchema,
});

export type SongSlideSource = ReadonlyKnown<
  v.InferOutput<typeof songSlideSourceSchema>
>;

export const showTileSchema = v.pipe(
  payloadObject({
    label: v.nullable(v.string()),
    labelColor: labelColorSchema,
    lines: v.array(v.string()),
    reference: v.exactOptional(liveTextSchema),
    name: v.exactOptional(liveTextSchema),
    picture: v.exactOptional(mediaIdSchema),
    kind: v.exactOptional(v.picklist(['blank', 'ad'])),
    continued: v.exactOptional(v.boolean()),
    biblePart: v.exactOptional(biblePartSchema),
    sourceSlideId: v.exactOptional(slideIdSchema),
    verse: v.exactOptional(
      payloadObject({
        reference: bibleVerseReferenceSchema,
        text: v.exactOptional(
          v.pipe(v.string(), v.maxLength(BIBLE_LOOKUP_LIMITS.verseText)),
        ),
      }),
    ),
    hotKey: v.exactOptional(slideHotKeySchema),
    sourceSlide: v.exactOptional(songSlideSourceSchema),
    media: v.exactOptional(mediaChoiceSchema),
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
      v.pipe(
        v.array(showTileSchema),
        v.maxLength(SHOW_SERVICE_LIMITS.tiles),
        v.check(
          tiles =>
            tiles.filter(tile => tile.verse !== undefined).length <=
            SLIDES_LIMITS.slides,
          'Too many source verse slides',
        ),
      ),
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
 * Bible rows may carry their successfully resolved normalized reference.
 */
export type ShowRow = ShowService['rows'][number];

/**
 * One tile of a song item, in the order of the item's 구성. A 장 that repeats
 * has a tile for each time, and a tile's position is its index in the list.
 * A tile of a media item carries the media to output.
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
