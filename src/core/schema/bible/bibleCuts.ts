import * as v from 'valibot';
import {BIBLE_LOOKUP_LIMITS} from './bibleLookup';
import {
  parseFile,
  serializeFile,
  type FileFormat,
  type ReadonlyKnown,
} from '../common/fileFormat';
import {translationIdSchema} from '../common/ids';
import {
  jsonObject,
  jsonRecord,
  positiveInteger,
  timestamp,
} from '../common/primitives';

/**
 * Bounds of `bibleCuts.json`: the most translations, the most entries in all,
 * and the most cuts of one entry.
 */
export const BIBLE_CUTS_LIMITS = {
  translations: 200,
  entries: 40_000,
  cuts: 1_296,
} as const;

const cutSchema = v.pipe(
  positiveInteger,
  v.maxValue(BIBLE_LOOKUP_LIMITS.verseText),
);
/**
 * The confirmed cut of one verse: the `hash` of its text when it was confirmed,
 * the `cuts` (sorted and unique), the `unit` of the cuts, and when it was
 * confirmed.
 */
export const bibleCutEntrySchema = jsonObject({
  hash: v.pipe(v.string(), v.regex(/^[0-9a-f]{8}$/)),
  unit: v.exactOptional(v.literal('character')),
  cuts: v.pipe(
    v.array(cutSchema),
    v.maxLength(BIBLE_CUTS_LIMITS.cuts),
    v.check(
      cuts => cuts.every((cut, i) => i === 0 || cut > (cuts[i - 1] ?? 0)),
      'Expected sorted unique cut indices',
    ),
  ),
  confirmedAt: timestamp,
});

/** A `book:chapter:verse` key such as `43:3:16`, within the lookup limits. */
export const verseKeySchema = v.pipe(
  v.string(),
  v.check(key => {
    if (!/^[1-9]\d*:[1-9]\d*:[1-9]\d*$/.test(key)) return false;
    const [book = 0, chapter = 0, verse = 0] = key.split(':').map(Number);
    return (
      book <= BIBLE_LOOKUP_LIMITS.books &&
      chapter <= BIBLE_LOOKUP_LIMITS.chapters &&
      verse <= BIBLE_LOOKUP_LIMITS.verses
    );
  }, 'Expected a book:chapter:verse key'),
);

/**
 * `bibleCuts.json` as its file holds it: the entries by translation id, then by
 * verse key.
 */
export const bibleCutsSchema = jsonObject({
  format: v.literal('llsettings.bibleCuts'),
  schemaVersion: positiveInteger,
  entries: v.pipe(
    jsonRecord(
      v.pipe(
        translationIdSchema,
        v.maxLength(BIBLE_LOOKUP_LIMITS.translationId),
      ),
      v.pipe(
        jsonRecord(verseKeySchema, bibleCutEntrySchema),
        v.maxEntries(BIBLE_CUTS_LIMITS.entries),
      ),
    ),
    v.maxEntries(BIBLE_CUTS_LIMITS.translations),
    v.check(
      entries =>
        Object.values(entries).reduce(
          (sum, translation) => sum + Object.keys(translation).length,
          0,
        ) <= BIBLE_CUTS_LIMITS.entries,
      'Too many saved Bible cuts',
    ),
  ),
});

/**
 * The confirmed cut of one verse, as {@link bibleCutEntrySchema} defines it.
 */
export type BibleCutEntry = ReadonlyKnown<
  v.InferOutput<typeof bibleCutEntrySchema>
>;
/** The `cuts` and their `unit` of an entry, without its hash and time. */
export type BibleCutSelection = Pick<BibleCutEntry, 'cuts' | 'unit'>;
/**
 * `bibleCuts.json`: the confirmed verse cuts (`docs/spec/02-data.md`,
 * "Confirmed Bible cuts").
 */
export type BibleCutsFile = ReadonlyKnown<
  v.InferOutput<typeof bibleCutsSchema>
>;
const format: FileFormat<typeof bibleCutsSchema> = {
  format: 'llsettings.bibleCuts',
  schema: bibleCutsSchema,
  migrations: [],
};

/** Reads the text of `bibleCuts.json`. `file` names it in errors. */
export function parseBibleCuts(text: string, file: string) {
  return parseFile(format, text, file);
}

/**
 * Writes the confirmed cuts as the text of `bibleCuts.json`. `file` names it in
 * errors.
 */
export function serializeBibleCuts(data: BibleCutsFile, file: string) {
  return serializeFile(format, data, file);
}
