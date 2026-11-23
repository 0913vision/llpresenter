import * as v from 'valibot';
import {themeIdSchema} from './ids';
import {
  liveNonBlankTextSchema,
  liveTextSchema,
  LIVE_STATE_LIMITS,
} from './liveLimits';
import {payloadObject} from './payload';
import {hexColor, nonNegativeInteger} from './primitives';
import {ITEM_OVERLAY_LIMITS, placedOverlaySchema} from './itemOverlays';
import {slideBackgroundSchema, themeFileSchema} from './theme';
import type {ReadonlyKnown} from './fileFormat';

export const liveItemKinds = [
  'song',
  'bible',
  'sermon',
  'liturgy',
  'notice',
  'blank',
  'media',
] as const;
export type LiveItemKind = (typeof liveItemKinds)[number];

/** The item on output, as it is saved now, with the times it gathered. */
export const liveItemSchema = payloadObject({
  id: liveNonBlankTextSchema,
  kind: v.picklist(liveItemKinds),
  source: v.picklist(['service', 'external']),
  title: v.exactOptional(liveTextSchema),
  overlays: v.exactOptional(
    v.pipe(
      v.array(placedOverlaySchema),
      v.maxLength(ITEM_OVERLAY_LIMITS.overlays),
    ),
  ),
  slidePosition: v.exactOptional(nonNegativeInteger),
  contentCleared: v.exactOptional(v.boolean()),
  startedAt: v.exactOptional(v.pipe(v.number(), v.finite())),
  overlayStartedAt: v.exactOptional(v.pipe(v.number(), v.finite())),
});

export const liveThemeModeSchema = v.object({
  kind: v.literal('manual'),
  id: themeIdSchema,
});

/** The theme on output, and the color of each screen that shows nothing. */
export const liveThemeOutputSchema = payloadObject({
  theme: themeFileSchema,
  /** What is behind the slide, also after its texts are cleared. */
  background: slideBackgroundSchema,
  revision: nonNegativeInteger,
  missing: v.pipe(v.array(liveNonBlankTextSchema), v.maxLength(2)),
  emptyColors: v.pipe(
    v.record(v.string(), hexColor),
    v.maxEntries(LIVE_STATE_LIMITS.outputs),
  ),
});

export type LiveItem = ReadonlyKnown<v.InferOutput<typeof liveItemSchema>>;
export type LiveThemeMode = ReadonlyKnown<
  v.InferOutput<typeof liveThemeModeSchema>
>;
export type LiveThemeOutput = ReadonlyKnown<
  v.InferOutput<typeof liveThemeOutputSchema>
>;
