import {slideTransitionSchema} from './slideTransition';
import {userThemeCount} from '../themes/builtInIds';
import * as v from 'valibot';
import {
  THEME_LIMITS,
  isStandbyElement,
  themeElementProblem,
} from '../themes/elementRules';
import {
  parseFile,
  serializeFile,
  type ReadonlyKnown,
  type FileFormat,
} from './fileFormat';
import {
  themeIdSchema,
  themeElementIdSchema,
  screenIdSchema,
  mediaIdSchema,
  timerIdSchema,
} from './ids';
import {textOutlineSchema, textShadowSchema} from './textEffects';
import {
  hexColor,
  jsonObject,
  jsonRecord,
  listWithUniqueIds,
  nonBlankText,
  nonNegativeNumber,
  percent,
  positiveInteger,
} from './primitives';
import {textStyleEntries} from './textStyle';
import {themeBackgroundSchema} from './themeBackground';

const range = (min: number, max: number) =>
  v.pipe(v.number(), v.finite(), v.minValue(min), v.maxValue(max));
const maxLines = v.pipe(positiveInteger, v.maxValue(THEME_LIMITS.maxLines));
const radius = range(0, THEME_LIMITS.radius);

export const themeFrameSchema = v.pipe(
  jsonObject({
    x: v.pipe(nonNegativeNumber, v.maxValue(THEME_LIMITS.width)),
    y: v.pipe(nonNegativeNumber, v.maxValue(THEME_LIMITS.height)),
    w: range(THEME_LIMITS.minimumExtent, THEME_LIMITS.width),
    h: range(THEME_LIMITS.minimumExtent, THEME_LIMITS.height),
  }),
  v.check(
    frame =>
      frame.x + frame.w <= THEME_LIMITS.width &&
      frame.y + frame.h <= THEME_LIMITS.height,
    'Expected a frame inside the theme canvas',
  ),
);

const textEntries = {
  ...textStyleEntries,
  weight: v.pipe(
    range(THEME_LIMITS.weight.min, THEME_LIMITS.weight.max),
    v.integer(),
  ),
  size: range(THEME_LIMITS.fontSize.min, THEME_LIMITS.fontSize.max),
  lineHeight: range(THEME_LIMITS.lineHeight.min, THEME_LIMITS.lineHeight.max),
  tracking: v.exactOptional(
    range(THEME_LIMITS.tracking.min, THEME_LIMITS.tracking.max),
  ),
  shortTracking: v.exactOptional(
    jsonObject({
      maxCharacters: v.pipe(
        positiveInteger,
        v.maxValue(THEME_LIMITS.shortTextCharacters),
      ),
      tracking: range(THEME_LIMITS.tracking.min, THEME_LIMITS.tracking.max),
      overrides: v.exactOptional(
        v.pipe(
          v.array(
            jsonObject({
              text: v.pipe(
                nonBlankText,
                v.maxLength(THEME_LIMITS.name),
                v.check(text => !/\s/u.test(text), 'Expected unspaced text'),
              ),
              tracking: range(
                THEME_LIMITS.tracking.min,
                THEME_LIMITS.tracking.max,
              ),
            }),
          ),
          v.maxLength(THEME_LIMITS.trackingOverrides),
          v.check(
            overrides =>
              new Set(overrides.map(override => override.text)).size ===
              overrides.length,
            'Expected unique tracking override text',
          ),
        ),
      ),
    }),
  ),
  bullets: v.exactOptional(v.boolean()),
  bulletStyle: v.exactOptional(v.literal('disc')),
  align: v.picklist(['left', 'center', 'right']),
  outline: textOutlineSchema,
  shadow: textShadowSchema,
};
export const themeTextSchema = jsonObject(textEntries);
const lyricText = jsonObject({...textEntries, maxLines});
const boxEntries = {
  on: v.optional(v.boolean(), true),
  fill: hexColor,
  opacity: percent,
};
const textBox = v.exactOptional(
  jsonObject({...boxEntries, radius: v.exactOptional(radius)}),
);
const base = {id: themeElementIdSchema, frame: themeFrameSchema};
const fit = v.picklist(['fit', 'fill', 'stretch']);

function textElement<TKind extends string, TEntries extends v.ObjectEntries>(
  kind: TKind,
  extra: TEntries,
) {
  return v.looseObject({
    ...base,
    kind: v.literal(kind),
    text: themeTextSchema,
    fitLines: v.exactOptional(maxLines),
    stack: v.exactOptional(
      jsonObject({
        group: nonBlankText,
        center: range(0, THEME_LIMITS.height),
        ink: v.exactOptional(v.boolean()),
      }),
    ),
    box: textBox,
    ...extra,
  });
}

export const themeElementSchema = v.pipe(
  jsonObject({}),
  v.variant('kind', [
    textElement('currentText', {
      text: lyricText,
      fallbackText: v.exactOptional(v.pipe(v.string(), v.maxLength(4000))),
    }),
    textElement('reference', {
      source: v.exactOptional(v.picklist(['slide', 'item'])),
    }),
    textElement('nextText', {
      text: lyricText,
      lineLimit: v.exactOptional(maxLines),
    }),
    textElement('label', {hideWhenItemTitle: v.exactOptional(v.boolean())}),
    textElement('nextLabel', {}),
    textElement('itemName', {
      centerWhenTextEmpty: v.exactOptional(v.boolean()),
    }),
    textElement('slideName', {}),
    textElement('slideNumber', {}),
    textElement('text', {
      content: v.string(),
      stageSource: v.exactOptional(
        v.picklist(['stageItemName', 'stagePosition']),
      ),
    }),
    textElement('clock', {
      clockFormat: v.picklist(['24h', '12h']),
      seconds: v.exactOptional(v.boolean()),
    }),
    textElement('timer', {timerId: v.exactOptional(timerIdSchema)}),
    textElement('videoTimeLeft', {}),
    textElement('stageMessage', {}),
    textElement('memo', {}),
    v.looseObject({...base, kind: v.literal('media'), fit, radius}),
    v.looseObject({...base, kind: v.literal('background'), fit, radius}),
    v.looseObject({...base, kind: v.literal('overlay'), fit}),
    v.looseObject({
      ...base,
      kind: v.literal('image'),
      mediaId: mediaIdSchema,
      fit,
      radius,
    }),
    v.looseObject({
      ...base,
      kind: v.literal('box'),
      drawHeight: v.exactOptional(range(1, THEME_LIMITS.height)),
      follow: v.exactOptional(
        jsonObject({
          elements: v.pipe(v.array(themeElementIdSchema), v.minLength(1)),
          side: v.picklist(['above', 'below']),
          gap: nonNegativeNumber,
          snap: v.exactOptional(v.boolean()),
        }),
      ),
      box: jsonObject({...boxEntries, radius}),
    }),
  ]),
);

export const themeScreenLayoutSchema = jsonObject({
  stageBar: v.exactOptional(v.literal('message-row')),
  songTitle: v.exactOptional(v.picklist(['sunday', 'sunday-light'])),
  mode: v.pipe(
    jsonObject({}),
    v.variant('kind', [
      v.looseObject({kind: v.literal('own')}),
      v.looseObject({kind: v.literal('same'), screen: screenIdSchema}),
      v.looseObject({kind: v.literal('empty')}),
    ]),
  ),
  elements: v.pipe(
    listWithUniqueIds(themeElementSchema),
    v.check(
      elements => themeElementProblem(elements) === undefined,
      'Invalid theme element limits',
    ),
  ),
  // NOTE(0913vision): Absence inherits the screen's configured empty color.
  background: v.exactOptional(themeBackgroundSchema),
});

export const themeClipboardSchema = jsonObject({
  format: v.literal('llp.theme-elements'),
  version: v.literal(1),
  elements: v.pipe(
    listWithUniqueIds(themeElementSchema),
    v.maxLength(THEME_LIMITS.elements),
  ),
});

export const themeSchema = jsonObject({
  transition: v.exactOptional(slideTransitionSchema),
  edited: v.exactOptional(v.boolean()),
  id: themeIdSchema,
  name: v.pipe(nonBlankText, v.maxLength(THEME_LIMITS.name)),
  screens: v.pipe(
    jsonRecord(screenIdSchema, themeScreenLayoutSchema),
    v.check(
      screens => Object.keys(screens).length <= THEME_LIMITS.screens,
      'Too many theme screens',
    ),
  ),
});

export const themesSchema = v.pipe(
  jsonObject({
    format: v.literal('llsettings.themes'),
    schemaVersion: positiveInteger,
    standby: v.pipe(
      themeSchema,
      v.check(
        theme =>
          Object.values(theme.screens).every(layout =>
            layout.elements.every(element => isStandbyElement(element.kind)),
          ),
        'Standby only allows fixed elements',
      ),
    ),
    themes: v.pipe(
      listWithUniqueIds(themeSchema),
      v.check(
        themes => userThemeCount(themes) <= THEME_LIMITS.themes,
        'Too many user themes',
      ),
    ),
    defaults: jsonObject({
      song: v.exactOptional(themeIdSchema),
      bible: v.exactOptional(themeIdSchema),
      blank: v.exactOptional(themeIdSchema),
      ad: v.exactOptional(themeIdSchema),
      media: v.exactOptional(themeIdSchema),
    }),
  }),
  v.check(
    file => file.themes.every(theme => theme.id !== file.standby.id),
    'Standby has a separate identity',
  ),
);

export type ThemesFile = ReadonlyKnown<v.InferOutput<typeof themesSchema>>;
export type Theme = ReadonlyKnown<v.InferOutput<typeof themeSchema>>;
export type ThemeElement = ReadonlyKnown<
  v.InferOutput<typeof themeElementSchema>
>;
export type ThemeScreenLayout = ReadonlyKnown<
  v.InferOutput<typeof themeScreenLayoutSchema>
>;
export type ThemeText = ReadonlyKnown<v.InferOutput<typeof themeTextSchema>>;

const format: FileFormat<typeof themesSchema> = {
  format: 'llsettings.themes',
  schema: themesSchema,
  migrations: [],
};
export function parseThemes(text: string, file: string) {
  return parseFile(format, text, file);
}
export function serializeThemes(value: ThemesFile, file: string) {
  return serializeFile(format, value, file);
}
