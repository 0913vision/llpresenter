import * as v from 'valibot';
import {
  itemOverlayIdSchema,
  mediaIdSchema,
  screenIdSchema,
  slideIdSchema,
} from '../common/ids';
import type {ReadonlyKnown} from '../common/fileFormat';
import {
  jsonObject,
  listWithUniqueIds,
  nonBlankText,
  positiveInteger,
} from '../common/primitives';

export const ITEM_OVERLAY_LIMITS = {
  overlays: 100,
  screens: 100,
  name: 160,
} as const;

const content = v.pipe(
  v.union([
    jsonObject({media: mediaIdSchema, loop: v.boolean(), sound: v.boolean()}),
    jsonObject({text: v.string()}),
  ]),
  v.check(
    value => !(Object.hasOwn(value, 'media') && Object.hasOwn(value, 'text')),
    'Expected one overlay content source',
  ),
);

const overlayEntries = {
  id: itemOverlayIdSchema,
  name: v.pipe(nonBlankText, v.maxLength(ITEM_OVERLAY_LIMITS.name)),
  screens: v.pipe(
    v.array(screenIdSchema),
    v.maxLength(ITEM_OVERLAY_LIMITS.screens),
    v.check(
      ids => new Set(ids).size === ids.length,
      'Expected unique overlay screens',
    ),
  ),
  content,
};

/** An overlay of an item, from one of its slides to another. */
export const itemOverlaySchema = jsonObject({
  ...overlayEntries,
  from: slideIdSchema,
  to: slideIdSchema,
});

export const itemOverlaysSchema = v.pipe(
  listWithUniqueIds(itemOverlaySchema),
  v.maxLength(ITEM_OVERLAY_LIMITS.overlays),
);

/** The same, with the 1-based positions of the slides. */
export const placedOverlaySchema = jsonObject({
  ...overlayEntries,
  from: positiveInteger,
  to: positiveInteger,
});

export type ItemOverlay = ReadonlyKnown<
  v.InferOutput<typeof itemOverlaySchema>
>;
export type PlacedOverlay = ReadonlyKnown<
  v.InferOutput<typeof placedOverlaySchema>
>;
