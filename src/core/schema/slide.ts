import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {BIBLE_LOOKUP_LIMITS} from './bibleLookup';
import {hymnSchema} from './hymn';
import {slideIdSchema, themeIdSchema, translationIdSchema} from './ids';
import {LIVE_STATE_LIMITS, liveTextSchema} from './liveLimits';
import {
  jsonObject,
  jsonRecord,
  listWithUniqueIds,
  nonBlankText,
  positiveInteger,
} from './primitives';
import {slideBackgroundSchema, THEME_FILE_LIMITS} from './theme';
import {slideHotKeySchema} from './slideHotKey';
import {slideTransitionSchema} from './slideTransition';

export const SLIDE_LIMITS = {
  slides: 10_000,
  text: LIVE_STATE_LIMITS.textCharacters,
  label: 64,
} as const;

/** The 이름표 of a slide. */
export const slideLabelSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(SLIDE_LIMITS.label),
);

/** The texts of a slide, by the name of the text box they are in. */
export const slideTextsSchema = v.pipe(
  jsonRecord(
    v.pipe(nonBlankText, v.maxLength(THEME_FILE_LIMITS.name)),
    liveTextSchema,
  ),
  v.maxEntries(THEME_FILE_LIMITS.boxes * 4),
);

/** The verse a text was taken from. */
export const bibleVerseReferenceSchema = jsonObject({
  translation: v.pipe(
    translationIdSchema,
    v.maxLength(BIBLE_LOOKUP_LIMITS.translationId),
  ),
  book: v.pipe(positiveInteger, v.maxValue(BIBLE_LOOKUP_LIMITS.books)),
  chapter: v.pipe(positiveInteger, v.maxValue(BIBLE_LOOKUP_LIMITS.chapters)),
  verse: v.pipe(positiveInteger, v.maxValue(BIBLE_LOOKUP_LIMITS.verses)),
});

/**
 * One slide of anything that has slides. It names the theme that draws it and
 * holds the text of that theme's boxes; how they look is in the theme alone.
 */
export const slideSchema = jsonObject({
  id: slideIdSchema,
  theme: themeIdSchema,
  texts: slideTextsSchema,
  /** What the slide before shows as its next text; the theme's when absent. */
  next: v.exactOptional(liveTextSchema),
  label: v.exactOptional(slideLabelSchema),
  /** What is behind the texts; the theme's own when absent. */
  background: v.exactOptional(slideBackgroundSchema),
  transition: v.exactOptional(slideTransitionSchema),
  hotKey: v.exactOptional(slideHotKeySchema),
  verse: v.exactOptional(bibleVerseReferenceSchema),
  /** The hymn that the slide is the title of. */
  hymn: v.exactOptional(hymnSchema),
  /** The text goes on on the next slide. */
  continued: v.exactOptional(v.literal(true)),
});

export const slidesSchema = v.pipe(
  listWithUniqueIds(slideSchema),
  v.maxLength(SLIDE_LIMITS.slides),
  v.check(slides => {
    const keys = slides.flatMap(slide => slide.hotKey ?? []);
    return new Set(keys).size === keys.length;
  }, 'Another slide already uses this hot key'),
);

export type Slide = ReadonlyKnown<v.InferOutput<typeof slideSchema>>;
export type SlideTexts = Slide['texts'];
export type VerseReference = ReadonlyKnown<
  v.InferOutput<typeof bibleVerseReferenceSchema>
>;
