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
import {translationIdSchema} from '../common/ids';
import type {MigrationStep} from '../common/migration';
import {
  jsonObject,
  listWithUniqueIds,
  nonBlankText,
  positiveInteger,
} from '../common/primitives';

// NOTE(0913vision): A translation file always lies in the bible folder, so its
// name may not name a folder, a drive, or a step up (`docs/spec/02-data.md`).
const BARE_FILE_NAME = /^(?!\.{1,2}$)[^\\/:]+$/;

const translationSchema = jsonObject({
  id: translationIdSchema,
  name: nonBlankText,
  lang: v.string(),
  file: v.pipe(
    nonBlankText,
    v.regex(BARE_FILE_NAME, 'Expected a file name without a folder'),
  ),
  default: v.boolean(),
});

const recentPassageSchema = jsonObject({
  ref: nonBlankText,
  translation: translationIdSchema,
});

/**
 * `bible.json` as its file holds it: the installed translations, and the recent
 * passages.
 */
export const bibleSchema = jsonObject({
  format: v.literal('llsettings.bible'),
  schemaVersion: positiveInteger,
  translations: listWithUniqueIds(translationSchema),
  recents: v.array(recentPassageSchema),
});

const bibleMigrations: readonly MigrationStep[] = [];

const bibleFormat: FileFormat<typeof bibleSchema> = {
  format: 'llsettings.bible',
  schema: bibleSchema,
  migrations: bibleMigrations,
};

/**
 * `bible.json`: the installed translations and the recent passages, newest
 * first. The code that adds a recent passage caps the list.
 */
export type BibleFile = ReadonlyKnown<v.InferOutput<typeof bibleSchema>>;

/**
 * One installed translation: its id, name, language, the `.llbible` file name
 * in the bible folder, and whether it is the default.
 */
export type Translation = BibleFile['translations'][number];

/** One recent passage: its reference text and the id of its translation. */
export type RecentPassage = BibleFile['recents'][number];

/** Reads the text of `bible.json`. `file` names it in errors. */
export function parseBible(
  text: string,
  file: string,
): Result<LoadedFile<BibleFile>, FileError> {
  return parseFile(bibleFormat, text, file);
}

/**
 * Writes the Bible settings as the text of `bible.json`. `file` names it in
 * errors.
 */
export function serializeBible(
  bible: BibleFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(bibleFormat, bible, file);
}
