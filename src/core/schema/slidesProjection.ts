import * as v from 'valibot';
import {serviceIdSchema, serviceItemIdSchema} from './ids';
import {positiveInteger} from './primitives';
import {parsePayload, payloadObject} from './payload';
import {SHOW_SERVICE_LIMITS, showTileSchema} from './showService';
import {SLIDES_LIMITS} from './service';
import {BIBLE_LOOKUP_LIMITS} from './bibleLookup';
import {LIVE_STATE_LIMITS} from './liveLimits';
import type {ReadonlyKnown} from './fileFormat';

export const SLIDES_PROJECTION_LIMITS = {
  characters:
    SLIDES_LIMITS.slides * BIBLE_LOOKUP_LIMITS.verseText +
    SHOW_SERVICE_LIMITS.tiles * 256,
} as const;

const schema = payloadObject({
  serviceId: serviceIdSchema,
  itemId: serviceItemIdSchema,
  revision: positiveInteger,
  measurement: payloadObject({
    themes: positiveInteger,
    screens: positiveInteger,
    bibleCuts: positiveInteger,
  }),
  tiles: v.pipe(
    v.array(showTileSchema),
    v.minLength(1),
    v.maxLength(SHOW_SERVICE_LIMITS.tiles),
    v.check(
      tiles =>
        tiles.every(
          tile =>
            tile.sourceSlideId !== undefined &&
            tile.kind !== undefined &&
            tile.verse === undefined &&
            tile.media === undefined &&
            tile.sourceSlide === undefined &&
            tile.hotKey === undefined &&
            !Object.hasOwn(tile, 'notice'),
        ),
      'Expected resolved slides with source identities',
    ),
    v.check(
      tiles =>
        tiles.every(
          tile =>
            (tile.label === null ||
              tile.label.length <= LIVE_STATE_LIMITS.textCharacters) &&
            tile.lines.length <= LIVE_STATE_LIMITS.slideLines &&
            tile.lines.every(
              line => line.length <= LIVE_STATE_LIMITS.textCharacters,
            ),
        ),
      'Slide lines exceed live limits',
    ),
    v.check(
      tiles =>
        tiles.reduce(
          (count, tile) =>
            count +
            tile.lines.reduce((sum, line) => sum + line.length, 0) +
            (tile.label?.length ?? 0) +
            (tile.name?.length ?? 0) +
            (tile.reference?.length ?? 0),
          0,
        ) <= SLIDES_PROJECTION_LIMITS.characters,
      'Slide sequence exceeds text budget',
    ),
  ),
});

export type SlidesProjection = ReadonlyKnown<v.InferOutput<typeof schema>>;
export const parseSlidesProjection = (value: unknown) =>
  parsePayload(schema, value);
