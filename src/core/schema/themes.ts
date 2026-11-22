import * as v from 'valibot';
import {
  parseFile,
  serializeFile,
  type FileFormat,
  type ReadonlyKnown,
} from './fileFormat';
import {themeIdSchema} from './ids';
import {
  jsonObject,
  listWithUniqueIds,
  nonBlankText,
  positiveInteger,
} from './primitives';
import {slideBackgroundSchema, slidePurposes, themeFileSchema} from './theme';

export const THEMES_LIMITS = {themes: 200, titles: 200, title: 128} as const;

/** A 타이틀 the operator keeps for inserting. */
const savedTitleSchema = jsonObject({
  id: v.pipe(v.string(), v.uuid()),
  name: v.pipe(nonBlankText, v.maxLength(THEMES_LIMITS.title)),
  english: v.pipe(v.string(), v.maxLength(THEMES_LIMITS.title)),
  background: v.exactOptional(slideBackgroundSchema),
});

const defaultsSchema = jsonObject(
  v.entriesFromList(slidePurposes, v.exactOptional(themeIdSchema)),
);

const listEntries = {
  format: v.literal('llsettings.themes'),
  schemaVersion: positiveInteger,
  /** The theme a new slide of a purpose gets; the app's own when absent. */
  defaults: defaultsSchema,
  titles: v.pipe(
    listWithUniqueIds(savedTitleSchema),
    v.maxLength(THEMES_LIMITS.titles),
  ),
};

/** `themes.json`: the order of the themes, which have a file each. */
export const themeListSchema = jsonObject({
  ...listEntries,
  order: v.pipe(v.array(themeIdSchema), v.maxLength(THEMES_LIMITS.themes * 2)),
});

/** Every theme, the app's own and the operator's, in order. */
export const themesSchema = jsonObject({
  ...listEntries,
  themes: v.pipe(
    listWithUniqueIds(themeFileSchema),
    v.maxLength(THEMES_LIMITS.themes * 2),
  ),
});

export type SavedTitle = ReadonlyKnown<v.InferOutput<typeof savedTitleSchema>>;
export type ThemeListFile = ReadonlyKnown<
  v.InferOutput<typeof themeListSchema>
>;
export type Themes = ReadonlyKnown<v.InferOutput<typeof themesSchema>>;

const listFormat: FileFormat<typeof themeListSchema> = {
  format: 'llsettings.themes',
  schema: themeListSchema,
  migrations: [],
};

export function parseThemeList(text: string, file: string) {
  return parseFile(listFormat, text, file);
}

export function serializeThemeList(value: ThemeListFile, file: string) {
  return serializeFile(listFormat, value, file);
}
