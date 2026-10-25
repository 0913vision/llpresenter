import * as v from 'valibot';
import type {Result} from '../result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {translationIdSchema} from './ids';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  listWithUniqueIds,
  nonBlankText,
  positiveInteger,
} from './primitives';

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

export type Translation = BibleFile['translations'][number];

export type RecentPassage = BibleFile['recents'][number];

export function parseBible(
  text: string,
  file: string,
): Result<LoadedFile<BibleFile>, FileError> {
  return parseFile(bibleFormat, text, file);
}

export function serializeBible(
  bible: BibleFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(bibleFormat, bible, file);
}
