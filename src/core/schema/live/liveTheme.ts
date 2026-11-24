import * as v from 'valibot';
import {themeIdSchema} from '../common/ids';
import {
  liveNonBlankTextSchema,
  liveTextSchema,
  LIVE_STATE_LIMITS,
} from './liveLimits';
import {payloadObject} from '../common/payload';
import {hexColor, nonNegativeInteger} from '../common/primitives';
import {
  ITEM_OVERLAY_LIMITS,
  placedOverlaySchema,
} from '../services/itemOverlays';
import {slideBackgroundSchema, themeFileSchema} from '../screens/theme';
import type {ReadonlyKnown} from '../common/fileFormat';

/** The kinds of item that can be on output. */
export const liveItemKinds = [
  'song',
  'bible',
  'sermon',
  'liturgy',
  'notice',
  'blank',
  'media',
] as const;
/** One of `liveItemKinds`. */
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

/** How the theme on output was chosen: by hand, with the theme's id. */
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

/**
 * The item on output: its id, its kind, whether it is from the 예배 순서 or from
 * outside it, its title and overlays, its slide position, and when it started.
 */
export type LiveItem = ReadonlyKnown<v.InferOutput<typeof liveItemSchema>>;
/** How the theme on output was chosen. */
export type LiveThemeMode = ReadonlyKnown<
  v.InferOutput<typeof liveThemeModeSchema>
>;
/**
 * The theme on output with its background and revision, the id of the theme it
 * could not find, and the empty color of each screen.
 */
export type LiveThemeOutput = ReadonlyKnown<
  v.InferOutput<typeof liveThemeOutputSchema>
>;
