import * as v from 'valibot';
import {serviceIdSchema, serviceItemIdSchema} from './ids';
import {positiveInteger} from './primitives';
import {parsePayload, payloadObject} from './payload';
import {SHOW_SERVICE_LIMITS, showTileSchema} from './showService';
import type {ReadonlyKnown} from './fileFormat';
import {LIVE_STATE_LIMITS} from './liveLimits';
import {SLIDES_PROJECTION_LIMITS} from './slidesProjection';

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
            (tile.label === null ||
              tile.label.length <= LIVE_STATE_LIMITS.textCharacters) &&
            tile.lines.length <= LIVE_STATE_LIMITS.slideLines &&
            tile.lines.every(
              line => line.length <= LIVE_STATE_LIMITS.textCharacters,
            ),
        ),
      'Bible slide exceeds live limits',
    ),
    v.check(
      tiles =>
        tiles.reduce(
          (sum, tile) =>
            sum +
            (tile.label?.length ?? 0) +
            tile.lines.reduce((count, line) => count + line.length, 0),
          0,
        ) <= SLIDES_PROJECTION_LIMITS.characters,
      'Bible sequence exceeds text budget',
    ),
  ),
});

export type BibleProjectionPayload = ReadonlyKnown<
  v.InferOutput<typeof schema>
>;
export const parseBibleProjection = (value: unknown) =>
  parsePayload(schema, value);
