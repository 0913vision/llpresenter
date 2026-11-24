import * as v from 'valibot';
import type {Result} from '@core/common/result';
import {isRecord} from '@core/common/guards';
import {biblePassageSchema} from '../bible/biblePassage';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from '../common/fileFormat';
import {
  macroIdSchema,
  propIdSchema,
  quickItemIdSchema,
  songIdSchema,
  timerIdSchema,
} from '../common/ids';
import {isKnownKind, kindsWithUnknown} from '../common/kinds';
import type {MigrationStep} from '../common/migration';
import {
  jsonObject,
  listWithUniqueIds,
  positiveInteger,
} from '../common/primitives';

/** The most items `quick.json` holds. */
export const MAX_QUICK_ITEMS = 500;

/** The 빠른 실행 item kinds. */
export const quickItemKinds = [
  'song',
  'bible',
  'prop',
  'timer',
  'macro',
] as const;

/** One of the item kinds in `quickItemKinds`. */
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
};

/** `quick.json` as its file holds it: the 빠른 실행 items in display order. */
export const quickSchema = jsonObject({
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
  prune: skipUnknownItems,
};

/** `quick.json`: the 빠른 실행 items in display order. */
export type QuickFile = ReadonlyKnown<v.InferOutput<typeof quickSchema>>;

/**
 * One 빠른 실행 item. An item of a kind this version doesn't know is kept with
 * only `id`, `name`, and `kind` typed; {@link isKnownQuickItem} tells them
 * apart.
 */
export type QuickItem = QuickFile['items'][number];

/** An item of a kind this version knows. */
export type KnownQuickItem = ReadonlyKnown<
  v.InferOutput<(typeof itemSchemas)[QuickItemKind]>
>;

/** Whether this version knows the kind of the item, so it can run it. */
export function isKnownQuickItem(item: QuickItem): item is KnownQuickItem {
  return isKnownKind(quickItemKinds, item.kind);
}

/** Reads the text of `quick.json`. `file` names it in errors. */
export function parseQuick(
  text: string,
  file: string,
): Result<LoadedFile<QuickFile>, FileError> {
  return parseFile(quickFormat, text, file);
}

/**
 * Writes the items as the text of `quick.json`, leaving out items of kinds this
 * version does not know. `file` names it in errors.
 */
export function serializeQuick(
  quick: QuickFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(quickFormat, skipUnknownItems(quick).content, file);
}

/** Unknown quick kinds have no action in this version and are omitted on save. */
function skipUnknownItems(content: Readonly<Record<string, unknown>>) {
  const items = content['items'];
  if (!Array.isArray(items)) return {content, dropped: []};
  return {
    content: {
      ...content,
      items: items.filter(item => {
        if (!isRecord(item)) return true;
        const kind = item['kind'];
        return (
          typeof kind !== 'string' ||
          kind.trim() === '' ||
          isKnownKind(quickItemKinds, kind)
        );
      }),
    },
    dropped: [],
  };
}
