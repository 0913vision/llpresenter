import * as v from 'valibot';
import {overlayRangesOverlap} from '../themes/overlayRanges';
import {THEME_LIMITS} from '../themes/elementRules';
import {itemOverlayIdSchema, mediaIdSchema, screenIdSchema} from './ids';
import type {ReadonlyKnown} from './fileFormat';
import {
  jsonObject,
  listWithUniqueIds,
  nonBlankText,
  positiveInteger,
} from './primitives';

const position = v.pipe(positiveInteger, v.maxValue(Number.MAX_SAFE_INTEGER));
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

export const itemOverlaySchema = v.pipe(
  jsonObject({
    id: itemOverlayIdSchema,
    name: v.pipe(nonBlankText, v.maxLength(THEME_LIMITS.name)),
    from: position,
    to: position,
    screens: v.pipe(
      v.array(screenIdSchema),
      v.maxLength(THEME_LIMITS.screens),
      v.check(
        ids => new Set(ids).size === ids.length,
        'Expected unique overlay screens',
      ),
    ),
    content,
  }),
  v.check(
    value => value.from <= value.to,
    'Expected an inclusive forward slide range',
  ),
);

export const itemOverlaysSchema = v.pipe(
  listWithUniqueIds(itemOverlaySchema),
  v.maxLength(THEME_LIMITS.overlays),
  v.check(
    value => !overlayRangesOverlap(value),
    'Overlay slide ranges overlap',
  ),
);

export type ItemOverlay = ReadonlyKnown<
  v.InferOutput<typeof itemOverlaySchema>
>;
