import * as v from 'valibot';
import type {Result} from '../result';
import {biblePassageSchema} from './biblePassage';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {
  macroIdSchema,
  propIdSchema,
  quickItemIdSchema,
  songIdSchema,
  timerIdSchema,
} from './ids';
import {isKnownKind, kindsWithUnknown} from './kinds';
import type {MigrationStep} from './migration';
import {jsonObject, listWithUniqueIds, positiveInteger} from './primitives';

/** The 퀵 실행 item kinds. `black` outputs a black screen and has no `ref`. */
export const quickItemKinds = [
  'song',
  'bible',
  'prop',
  'timer',
  'macro',
  'black',
] as const;

export type QuickItemKind = (typeof quickItemKinds)[number];

const itemFields = {id: quickItemIdSchema, name: v.string()};

const itemSchemas = {
  song: jsonObject({
    ...itemFields,
    kind: v.literal('song'),
    ref: songIdSchema,
  }),
  bible: jsonObject({
    ...itemFields,
    kind: v.literal('bible'),
    ref: biblePassageSchema,
  }),
  prop: jsonObject({
    ...itemFields,
    kind: v.literal('prop'),
    ref: propIdSchema,
  }),
  timer: jsonObject({
    ...itemFields,
    kind: v.literal('timer'),
    ref: timerIdSchema,
  }),
  macro: jsonObject({
    ...itemFields,
    kind: v.literal('macro'),
    ref: macroIdSchema,
  }),
  black: jsonObject({...itemFields, kind: v.literal('black')}),
};

const quickSchema = jsonObject({
  format: v.literal('llsettings.quick'),
  schemaVersion: positiveInteger,
  items: listWithUniqueIds(
    kindsWithUnknown(quickItemKinds, itemSchemas, itemFields),
  ),
});

const quickMigrations: readonly MigrationStep[] = [];

const quickFormat: FileFormat<typeof quickSchema> = {
  format: 'llsettings.quick',
  schema: quickSchema,
  migrations: quickMigrations,
};

/** `quick.json`: the 퀵 실행 items in display order. */
export type QuickFile = ReadonlyKnown<v.InferOutput<typeof quickSchema>>;

/**
 * One 퀵 실행 item. An item of a kind this version doesn't know is kept with
 * only `id`, `name`, and `kind` typed; {@link isKnownQuickItem} tells them
 * apart.
 */
export type QuickItem = QuickFile['items'][number];

export type KnownQuickItem = ReadonlyKnown<
  v.InferOutput<(typeof itemSchemas)[QuickItemKind]>
>;

export function isKnownQuickItem(item: QuickItem): item is KnownQuickItem {
  return isKnownKind(quickItemKinds, item.kind);
}

export function parseQuick(
  text: string,
  file: string,
): Result<LoadedFile<QuickFile>, FileError> {
  return parseFile(quickFormat, text, file);
}

export function serializeQuick(
  quick: QuickFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(quickFormat, quick, file);
}
