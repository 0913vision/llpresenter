import * as v from 'valibot';
import {BIBLE_LOOKUP_LIMITS} from './bibleLookup';
import {
  parseFile,
  serializeFile,
  type FileFormat,
  type ReadonlyKnown,
} from './fileFormat';
import {translationIdSchema} from './ids';
import {jsonObject, jsonRecord, positiveInteger, timestamp} from './primitives';

export const BIBLE_CUTS_LIMITS = {
  translations: 200,
  entries: 40_000,
  cuts: 1_295,
} as const;

const cutSchema = v.pipe(
  positiveInteger,
  v.maxValue(BIBLE_LOOKUP_LIMITS.verseText),
);
export const bibleCutEntrySchema = jsonObject({
  hash: v.pipe(v.string(), v.regex(/^[0-9a-f]{8}$/)),
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

const verseKeySchema = v.pipe(
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

export type BibleCutEntry = ReadonlyKnown<
  v.InferOutput<typeof bibleCutEntrySchema>
>;
export type BibleCutsFile = ReadonlyKnown<
  v.InferOutput<typeof bibleCutsSchema>
>;
const format: FileFormat<typeof bibleCutsSchema> = {
  format: 'llsettings.bibleCuts',
  schema: bibleCutsSchema,
  migrations: [],
};

export function parseBibleCuts(text: string, file: string) {
  return parseFile(format, text, file);
}

export function serializeBibleCuts(data: BibleCutsFile, file: string) {
  return serializeFile(format, data, file);
}
