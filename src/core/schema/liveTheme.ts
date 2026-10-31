import * as v from 'valibot';
import {screenIdSchema, themeIdSchema} from './ids';
import {
  liveNonBlankTextSchema,
  liveTextSchema,
  LIVE_STATE_LIMITS,
} from './liveLimits';
import {payloadObject} from './payload';
import {hexColor, nonNegativeInteger} from './primitives';
import {itemOverlaysSchema} from './itemOverlays';
import {themeScreenLayoutSchema} from './themes';
import {themeItemKinds} from '../themes/elementRules';
import type {ReadonlyKnown} from './fileFormat';

export const liveThemeItemSchema = payloadObject({
  id: liveNonBlankTextSchema,
  kind: v.picklist(themeItemKinds),
  source: v.picklist(['service', 'external']),
  theme: v.exactOptional(themeIdSchema),
  title: v.exactOptional(liveTextSchema),
  memo: v.exactOptional(liveTextSchema),
  overlays: v.exactOptional(itemOverlaysSchema),
  slidePosition: v.exactOptional(nonNegativeInteger),
  contentCleared: v.exactOptional(v.boolean()),
  startedAt: v.exactOptional(v.pipe(v.number(), v.finite())),
  overlayStartedAt: v.exactOptional(v.pipe(v.number(), v.finite())),
});

export const liveThemeModeSchema = v.variant('kind', [
  v.object({kind: v.literal('manual'), id: themeIdSchema}),
  v.object({kind: v.literal('legacy')}),
]);

export const themeCompositionSchema = payloadObject({
  sourceScreenId: screenIdSchema,
  layout: themeScreenLayoutSchema,
  emptyColor: hexColor,
});

export const liveThemeOutputSchema = payloadObject({
  themeId: themeIdSchema,
  revision: nonNegativeInteger,
  missing: v.pipe(v.array(liveNonBlankTextSchema), v.maxLength(2)),
  screens: v.pipe(
    v.record(screenIdSchema, themeCompositionSchema),
    v.maxEntries(LIVE_STATE_LIMITS.outputs),
  ),
});

export type LiveThemeItem = ReadonlyKnown<
  v.InferOutput<typeof liveThemeItemSchema>
>;
export type LiveThemeMode = ReadonlyKnown<
  v.InferOutput<typeof liveThemeModeSchema>
>;
export type ThemeComposition = ReadonlyKnown<
  v.InferOutput<typeof themeCompositionSchema>
>;
export type LiveThemeOutput = ReadonlyKnown<
  v.InferOutput<typeof liveThemeOutputSchema>
>;
