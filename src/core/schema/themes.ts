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
import {lyricOutlineSchema, lyricShadowSchema} from './looks';
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
  align: v.picklist(['left', 'center', 'right']),
  outline: lyricOutlineSchema,
  shadow: lyricShadowSchema,
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
    box: textBox,
    ...extra,
  });
}

export const themeElementSchema = v.pipe(
  jsonObject({}),
  v.variant('kind', [
    textElement('currentText', {text: lyricText}),
    textElement('reference', {}),
    textElement('nextText', {text: lyricText}),
    textElement('label', {}),
    textElement('nextLabel', {}),
    textElement('itemName', {}),
    textElement('text', {content: v.string()}),
    textElement('clock', {clockFormat: v.picklist(['24h', '12h'])}),
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
      box: jsonObject({...boxEntries, radius}),
    }),
  ]),
);

export const themeScreenLayoutSchema = jsonObject({
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
  background: v.exactOptional(hexColor),
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
      v.maxLength(THEME_LIMITS.themes),
    ),
    defaults: jsonObject({
      song: v.exactOptional(themeIdSchema),
      bible: v.exactOptional(themeIdSchema),
      notice: v.exactOptional(themeIdSchema),
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
