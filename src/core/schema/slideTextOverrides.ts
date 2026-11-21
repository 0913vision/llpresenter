import * as v from 'valibot';
import {jsonObject, jsonRecord, nonBlankText} from './primitives';
import {LIVE_STATE_LIMITS, liveTextSchema} from './liveLimits';
import {screenIdSchema, themeIdSchema} from './ids';
import {
  themeTextRoleSchema,
  themeTextSlotIdSchema,
  themeTextSlotNameSchema,
} from './themeTextSlot';
import type {ReadonlyKnown} from './fileFormat';

const key = v.pipe(nonBlankText, v.maxLength(320));
const text = v.pipe(
  liveTextSchema,
  v.check(
    value => value.split('\n').length <= LIVE_STATE_LIMITS.slideLines,
    'Too many slide lines',
  ),
);

export const manualSlideTextSchema = jsonObject({
  mode: v.literal('manual'),
  slotId: themeTextSlotIdSchema,
  role: themeTextRoleSchema,
  sourceThemeId: themeIdSchema,
  screenId: v.exactOptional(screenIdSchema),
  name: v.exactOptional(themeTextSlotNameSchema),
  uniqueRole: v.exactOptional(v.literal(true)),
  explicitSlot: v.exactOptional(v.literal(true)),
  text,
});

const slideTextValueSchema = v.union([manualSlideTextSchema, text]);

export function manualSlideTextKey(binding: {
  readonly sourceThemeId: string;
  readonly screenId?: string | undefined;
  readonly slotId: string;
}): string {
  return `${binding.sourceThemeId}/${binding.screenId ?? 'shared'}/${binding.slotId}`;
}

/** A missing binding uses the automatic text in the theme. */
export const slideTextOverridesSchema = v.pipe(
  jsonRecord(key, slideTextValueSchema),
  v.maxEntries(128),
  v.check(
    slots =>
      Object.entries(slots).every(
        ([key, value]) =>
          typeof value === 'string' || key === manualSlideTextKey(value),
      ),
    'Text override keys must match the saved binding',
  ),
);

export const itemTextOverridesSchema = v.pipe(
  jsonRecord(key, slideTextOverridesSchema),
  v.maxEntries(LIVE_STATE_LIMITS.bibleItemSlides),
  v.check(
    slides =>
      Object.values(slides).reduce(
        (size, slots) =>
          size +
          Object.entries(slots).reduce(
            (length, [binding, value]) =>
              length +
              binding.length +
              (typeof value === 'string'
                ? value.length
                : JSON.stringify(value).length),
            0,
          ),
        0,
      ) <= LIVE_STATE_LIMITS.bibleItemCharacters,
    'Too much slide text',
  ),
);

export type SlideTextOverrides = ReadonlyKnown<
  v.InferOutput<typeof slideTextOverridesSchema>
>;
export type ItemTextOverrides = ReadonlyKnown<
  v.InferOutput<typeof itemTextOverridesSchema>
>;
export type ManualSlideText = ReadonlyKnown<
  v.InferOutput<typeof manualSlideTextSchema>
>;
export type SlideTextValue = SlideTextOverrides[string];
