import * as v from 'valibot';
import type {Result} from '@core/common/result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from '../common/fileFormat';
import {
  mediaIdSchema,
  screenIdSchema,
  themeElementIdSchema,
  themeIdSchema,
} from '../common/ids';
import {
  finiteNumber,
  hexColor,
  jsonObject,
  jsonRecord,
  listWithUniqueIds,
  nonBlankText,
  nonNegativeNumber,
  percent,
  positiveInteger,
  positiveNumber,
} from '../common/primitives';
import {pictureAreaSchema, pictureFitSchema} from '../media/picturePlace';
import {SCREEN_KIND_ORDER} from './screens';
import {textOutlineSchema, textShadowSchema} from '../slides/textEffects';

/**
 * Bounds for a theme file: name length, counts of text boxes, elements,
 * splits, templates, rows and gradient stops, the length of a template, and
 * the ranges of font size, weight, line height and tracking.
 */
export const THEME_FILE_LIMITS = {
  name: 80,
  boxes: 12,
  elements: 40,
  splits: 4,
  templates: 6,
  template: 4000,
  fontSize: {min: 12, max: 400},
  weight: {min: 100, max: 900},
  lineHeight: {min: 0.8, max: 3},
  tracking: {min: -20, max: 200},
  rows: 20,
  gradientStops: 6,
} as const;

/** What a slide is for; a theme is offered only to slides of its purpose. */
export const slidePurposes = [
  'songTitle',
  'lyrics',
  'sermonTitle',
  'scripture',
  'notice',
  'title',
  'creed',
  'preparation',
  'standby',
  'blank',
  'picture',
  'media',
] as const;
/** One of `slidePurposes`. */
export type SlidePurpose = (typeof slidePurposes)[number];

function range(min: number, max: number) {
  return v.pipe(v.number(), v.finite(), v.minValue(min), v.maxValue(max));
}

const frameSchema = jsonObject({
  x: finiteNumber,
  y: finiteNumber,
  w: positiveNumber,
  h: positiveNumber,
});

const boxName = v.pipe(
  nonBlankText,
  v.maxLength(THEME_FILE_LIMITS.name),
  v.regex(/^[^{}[\]]+$/u, 'Expected a name without brackets'),
);
const template = v.pipe(v.string(), v.maxLength(THEME_FILE_LIMITS.template));
/** The first template whose values are all there is the one that shows. */
const templates = v.pipe(
  v.array(template),
  v.maxLength(THEME_FILE_LIMITS.templates),
);

/** A named text box: what a slide with this theme has text for. */
const boxSchema = jsonObject({
  name: boxName,
  /** Shows while the slide has no text of its own for this box. */
  default: v.exactOptional(template),
  rows: v.picklist(['one', 'many']),
});

const textStyleSchema = jsonObject({
  font: nonBlankText,
  weight: v.pipe(
    range(THEME_FILE_LIMITS.weight.min, THEME_FILE_LIMITS.weight.max),
    v.integer(),
  ),
  size: range(THEME_FILE_LIMITS.fontSize.min, THEME_FILE_LIMITS.fontSize.max),
  color: hexColor,
  lineHeight: range(
    THEME_FILE_LIMITS.lineHeight.min,
    THEME_FILE_LIMITS.lineHeight.max,
  ),
  tracking: range(
    THEME_FILE_LIMITS.tracking.min,
    THEME_FILE_LIMITS.tracking.max,
  ),
  /** Tracking for a short text, up to this many letters. */
  short: v.exactOptional(
    jsonObject({
      letters: positiveInteger,
      tracking: range(
        THEME_FILE_LIMITS.tracking.min,
        THEME_FILE_LIMITS.tracking.max,
      ),
      texts: v.exactOptional(v.record(v.string(), finiteNumber)),
    }),
  ),
  align: v.picklist(['left', 'center', 'right']),
  vAlign: v.picklist(['top', 'middle', 'bottom']),
  bullets: v.exactOptional(v.boolean()),
  shadow: v.exactOptional(textShadowSchema),
  outline: v.exactOptional(textOutlineSchema),
});

const fitSchema = jsonObject({
  /** The sizes tried before shrinking, largest first. */
  sizes: v.exactOptional(
    v.pipe(v.array(positiveNumber), v.minLength(1), v.maxLength(8)),
  ),
  /** The most rows the text takes. */
  rows: v.exactOptional(
    v.pipe(positiveInteger, v.maxValue(THEME_FILE_LIMITS.rows)),
  ),
  /** The smallest size; a longer text then runs out of its frame. */
  min: v.exactOptional(positiveNumber),
  /** Keeps the rows as typed while the size stays at or above `min`. */
  keepRows: v.exactOptional(v.boolean()),
  /** Every slide of the item with this theme has the same size and height. */
  together: v.exactOptional(v.boolean()),
});

const elementBase = {
  id: themeElementIdSchema,
  frame: frameSchema,
};

const colorStop = jsonObject({
  color: hexColor,
  opacity: percent,
  position: percent,
});
const fillSchema = v.union([
  jsonObject({color: hexColor, opacity: percent}),
  jsonObject({
    angle: finiteNumber,
    stops: v.pipe(
      v.array(colorStop),
      v.minLength(2),
      v.maxLength(THEME_FILE_LIMITS.gradientStops),
    ),
  }),
]);
const borderSchema = jsonObject({
  width: nonNegativeNumber,
  color: hexColor,
  opacity: percent,
});
const padding = jsonObject({
  top: finiteNumber,
  bottom: finiteNumber,
});
const elementIds = v.pipe(v.array(themeElementIdSchema), v.minLength(1));

const textElementEntries = {
  ...elementBase,
  style: textStyleSchema,
  fit: v.exactOptional(fitSchema),
  /** The least rows its height has room for. */
  rows: v.exactOptional(positiveInteger),
  /** A fixed height of its row, with the text aligned in it. */
  height: v.exactOptional(positiveNumber),
  wrap: v.exactOptional(v.picklist(['normal', 'balance'])),
};

/**
 * One element of a theme screen: a text, the text of the next slide, a
 * picture, the background, or a shape. Unknown fields stay.
 */
export const themeElementSchema = v.pipe(
  jsonObject({}),
  v.variant('kind', [
    v.looseObject({
      ...textElementEntries,
      kind: v.literal('text'),
      content: templates,
      /** Shown instead, in this color, when no template of `content` fits. */
      empty: v.exactOptional(jsonObject({content: templates, color: hexColor})),
      /** May carry the label of the slide in front of its first row. */
      label: v.exactOptional(v.boolean()),
      /** A text of more typed rows than this becomes one flowing row. */
      joinRows: v.exactOptional(positiveInteger),
    }),
    v.looseObject({
      ...textElementEntries,
      kind: v.literal('next'),
      /** Its size as a share of the text it stands under. */
      ratio: v.exactOptional(range(0.1, 1)),
      of: v.exactOptional(themeElementIdSchema),
    }),
    v.looseObject({
      ...elementBase,
      kind: v.literal('picture'),
      media: mediaIdSchema,
      fit: pictureFitSchema,
    }),
    v.looseObject({
      ...elementBase,
      kind: v.literal('background'),
      fit: pictureFitSchema,
    }),
    v.looseObject({
      ...elementBase,
      kind: v.literal('shape'),
      fill: fillSchema,
      /** The fill where the screen can not show transparent color. */
      solid: v.exactOptional(fillSchema),
      radius: v.exactOptional(nonNegativeNumber),
      border: v.exactOptional(borderSchema),
      shadow: v.exactOptional(
        jsonObject({
          blur: nonNegativeNumber,
          color: hexColor,
          opacity: percent,
        }),
      ),
      /** Reaches from the first of these texts to the last. */
      around: v.exactOptional(jsonObject({texts: elementIds, padding})),
      /** Stands this far above or below these texts. */
      beside: v.exactOptional(
        jsonObject({
          texts: elementIds,
          side: v.picklist(['above', 'below']),
          gap: finiteNumber,
        }),
      ),
    }),
  ]),
);

/** Elements on their way from one screen to another. */
export const themeClipboardSchema = jsonObject({
  format: v.literal('llp.theme-elements'),
  elements: v.pipe(
    v.array(themeElementSchema),
    v.maxLength(THEME_FILE_LIMITS.elements),
  ),
});

/** Texts placed one under another instead of at their own place. */
const stackSchema = jsonObject({
  texts: elementIds,
  anchor: v.picklist(['top', 'center', 'bottom']),
  at: finiteNumber,
  gap: finiteNumber,
  /** Measures the letters instead of the rows. */
  ink: v.exactOptional(v.boolean()),
});

/** The text of the slide over the text of the next one. */
const splitSchema = jsonObject({
  upper: elementIds,
  lower: themeElementIdSchema,
  top: finiteNumber,
  bottom: finiteNumber,
  /** Where the lower text starts unless it needs more room. */
  at: finiteNumber,
  gap: nonNegativeNumber,
  upperGap: v.exactOptional(nonNegativeNumber),
});

const ownScreenSchema = v.looseObject({
  mode: v.literal('own'),
  /** What is behind everything; none shows the screen's empty color. */
  backdrop: v.exactOptional(hexColor),
  elements: v.pipe(
    listWithUniqueIds(themeElementSchema),
    v.maxLength(THEME_FILE_LIMITS.elements),
  ),
  stacks: v.exactOptional(
    v.pipe(v.array(stackSchema), v.maxLength(THEME_FILE_LIMITS.splits)),
  ),
  splits: v.exactOptional(
    v.pipe(v.array(splitSchema), v.maxLength(THEME_FILE_LIMITS.splits)),
  ),
});

/** One of `SCREEN_KIND_ORDER`: 청중, 무대 or 방송. */
export type ScreenKind = (typeof SCREEN_KIND_ORDER)[number];

/**
 * How a theme draws one screen: with elements of its own, the same as another
 * kind of screen, or empty.
 */
export const themeScreenSchema = v.pipe(
  jsonObject({}),
  v.variant('mode', [
    ownScreenSchema,
    v.looseObject({mode: v.literal('same'), as: v.picklist(SCREEN_KIND_ORDER)}),
    v.looseObject({mode: v.literal('empty')}),
  ]),
);

const gradientStop = jsonObject({color: hexColor, position: percent});

/** What a slide, or a theme, shows behind its texts. */
export const slideBackgroundSchema = v.pipe(
  jsonObject({}),
  v.variant('kind', [
    v.looseObject({kind: v.literal('none')}),
    v.looseObject({kind: v.literal('color'), color: hexColor}),
    v.looseObject({
      kind: v.literal('gradient'),
      angle: range(0, 359),
      stops: v.pipe(
        v.array(gradientStop),
        v.minLength(2),
        v.maxLength(THEME_FILE_LIMITS.gradientStops),
      ),
    }),
    v.looseObject({
      kind: v.literal('media'),
      media: mediaIdSchema,
      loop: v.exactOptional(v.boolean()),
      fit: v.exactOptional(pictureFitSchema),
      area: v.exactOptional(pictureAreaSchema),
    }),
  ]),
);

/**
 * A theme file, `themes/<id>.json`: its name and purpose, its named text
 * boxes, its background, how it draws each kind of screen, and the screens
 * that differ from the first of their kind.
 */
export const themeFileSchema = v.pipe(
  jsonObject({
    format: v.literal('lltheme'),
    schemaVersion: positiveInteger,
    id: themeIdSchema,
    name: v.pipe(nonBlankText, v.maxLength(THEME_FILE_LIMITS.name)),
    purpose: v.picklist(slidePurposes),
    boxes: v.pipe(v.array(boxSchema), v.maxLength(THEME_FILE_LIMITS.boxes)),
    /** The box of the text that the slide before one with this theme shows. */
    next: jsonObject({
      content: templates,
    }),
    /** The theme of a slide added after one with this theme. */
    then: v.exactOptional(themeIdSchema),
    background: slideBackgroundSchema,
    screens: v.object({
      audience: themeScreenSchema,
      broadcast: themeScreenSchema,
      stage: themeScreenSchema,
    }),
    /** Screens that differ from the first one of their kind. */
    others: v.exactOptional(jsonRecord(screenIdSchema, themeScreenSchema)),
  }),
  v.check(
    theme =>
      new Set(theme.boxes.map(box => box.name)).size === theme.boxes.length,
    'Text boxes have different names',
  ),
);

/** One element of a theme screen. */
export type ThemeElement = ReadonlyKnown<
  v.InferOutput<typeof themeElementSchema>
>;
/** How a theme draws one screen. */
export type ThemeScreen = ReadonlyKnown<
  v.InferOutput<typeof themeScreenSchema>
>;
/** A theme screen with elements of its own. */
export type OwnThemeScreen = Extract<ThemeScreen, {readonly mode: 'own'}>;
/** A theme, `themes/<id>.json`. */
export type ThemeFile = ReadonlyKnown<v.InferOutput<typeof themeFileSchema>>;
/**
 * A named text box of a theme: the text a slide with the theme has room for.
 */
export type ThemeBox = ThemeFile['boxes'][number];
/** The kind of a theme element: text, next, picture, background or shape. */
export type ThemeElementKind = ThemeElement['kind'];
/** A text element of a theme screen. */
export type ThemeTextElement = Extract<ThemeElement, {readonly kind: 'text'}>;
/** An element that shows the text of the next slide. */
export type ThemeNextElement = Extract<ThemeElement, {readonly kind: 'next'}>;
/** A shape element: a filled box, which may stand around or beside texts. */
export type ThemeShape = Extract<ThemeElement, {readonly kind: 'shape'}>;
/** The fill of a shape: one color with its opacity, or a gradient. */
export type ThemeFill = ThemeShape['fill'];
/** A text or next element, which a stack or a split places. */
export type ThemeGroupedText = ThemeTextElement | ThemeNextElement;
/** Texts placed one under another. */
export type ThemeStack = NonNullable<OwnThemeScreen['stacks']>[number];
/** The text of a slide over the text of the next one. */
export type ThemeSplit = NonNullable<OwnThemeScreen['splits']>[number];
/**
 * The look of a text element: font, weight, size, color, spacing, alignment,
 * and its shadow and outline.
 */
export type ThemeTextStyle = ThemeTextElement['style'];
/** The place of an element on the canvas: `x`, `y`, `w` and `h`. */
export type ThemeFrame = ThemeElement['frame'];
/**
 * What a slide or a theme shows behind its texts: nothing, a color, a
 * gradient, or a media item.
 */
export type SlideBackground = ReadonlyKnown<
  v.InferOutput<typeof slideBackgroundSchema>
>;

const format: FileFormat<typeof themeFileSchema> = {
  format: 'lltheme',
  schema: themeFileSchema,
  migrations: [],
};

/** A theme that comes with the app; it throws when the file is wrong. */
export function themeOfFile(value: unknown): ThemeFile {
  return v.parse(themeFileSchema, value);
}

/** Reads the text of a theme file; `file` names the file in errors. */
export function parseTheme(
  text: string,
  file: string,
): Result<LoadedFile<ThemeFile>, FileError> {
  return parseFile(format, text, file);
}

/** Writes a theme as the text of its file; `file` names the file in errors. */
export function serializeTheme(
  theme: ThemeFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(format, theme, file);
}
