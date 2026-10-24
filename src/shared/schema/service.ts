import * as v from 'valibot';
import type {Result} from '../result';
import {isRecord} from '../guards';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {
  mediaIdSchema,
  noticeSetIdSchema,
  serviceIdSchema,
  serviceItemIdSchema,
  songIdSchema,
  templateIdSchema,
  translationIdSchema,
} from './ids';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  listWithUniqueIds,
  localDateTime,
  nonBlankText,
  positiveInteger,
  timeOfDay,
} from './primitives';

const SERVICE_FORMAT = 'llservice';

/** The kind keys of 예배 순서 items. An item has exactly one of them. */
export const serviceItemKinds = [
  'header',
  'song',
  'slot',
  'bible',
  'media',
  'notice',
] as const;

export type ServiceItemKind = (typeof serviceItemKinds)[number];

const slotKinds = ['song', 'bible', 'slides'] as const;

const itemFields = {id: serviceItemIdSchema};

const startFields = {
  macro: v.exactOptional(v.string()),
  memo: v.exactOptional(v.string()),
};

const biblePassageSchema = jsonObject({
  translation: translationIdSchema,
  ref: nonBlankText,
  split: v.picklist(['verse', 'two', 'fit']),
  reference: v.picklist(['every', 'first', 'none']),
  verseNumbers: v.boolean(),
  translationName: v.boolean(),
});

const itemSchemas = {
  header: jsonObject({...itemFields, header: v.string()}),
  song: jsonObject({
    ...itemFields,
    song: songIdSchema,
    arrangement: v.exactOptional(v.string()),
    background: v.exactOptional(mediaIdSchema),
    ...startFields,
  }),
  slot: jsonObject({
    ...itemFields,
    slot: v.picklist(slotKinds),
    title: v.string(),
  }),
  bible: jsonObject({
    ...itemFields,
    bible: biblePassageSchema,
    ...startFields,
  }),
  media: jsonObject({...itemFields, media: mediaIdSchema, ...startFields}),
  notice: jsonObject({
    ...itemFields,
    notice: noticeSetIdSchema,
    ...startFields,
  }),
};

const unknownItemSchema = jsonObject(itemFields);

const mixedItemSchema = v.never('An item has more than one kind key');

const serviceItemSchema = v.lazy(itemSchemaFor);

const orderSchema = listWithUniqueIds(serviceItemSchema);

const serviceSchema = jsonObject({
  format: v.literal(SERVICE_FORMAT),
  schemaVersion: positiveInteger,
  id: serviceIdSchema,
  name: v.string(),
  date: localDateTime,
  order: orderSchema,
});

const templateSchema = jsonObject({
  format: v.literal(SERVICE_FORMAT),
  schemaVersion: positiveInteger,
  id: templateIdSchema,
  name: v.string(),
  time: v.exactOptional(timeOfDay),
  order: orderSchema,
});

const serviceMigrations: readonly MigrationStep[] = [];

const serviceFormat: FileFormat<typeof serviceSchema> = {
  format: SERVICE_FORMAT,
  schema: serviceSchema,
  migrations: serviceMigrations,
};

const templateFormat: FileFormat<typeof templateSchema> = {
  format: SERVICE_FORMAT,
  schema: templateSchema,
  migrations: serviceMigrations,
};

/** A 예배 순서 file (`.llservice`). See `docs/spec/02-data.md`. */
export type Service = ReadonlyKnown<v.InferOutput<typeof serviceSchema>>;

/**
 * A 틀: the service file format with no `date` and an optional default `time`.
 * It lives in the 틀 folder.
 */
export type Template = ReadonlyKnown<v.InferOutput<typeof templateSchema>>;

/**
 * One row of a 예배 순서. An item whose kind key this version doesn't know is
 * kept with only its `id` typed. Use {@link serviceItemKind} to tell kinds
 * apart.
 */
export type ServiceItem = Service['order'][number];

export type BiblePassage = ReadonlyKnown<
  v.InferOutput<typeof biblePassageSchema>
>;

export function parseService(
  text: string,
  file: string,
): Result<LoadedFile<Service>, FileError> {
  return parseFile(serviceFormat, text, file);
}

export function serializeService(
  service: Service,
  file: string,
): Result<string, FileError> {
  return serializeFile(serviceFormat, service, file);
}

export function parseTemplate(
  text: string,
  file: string,
): Result<LoadedFile<Template>, FileError> {
  return parseFile(templateFormat, text, file);
}

export function serializeTemplate(
  template: Template,
  file: string,
): Result<string, FileError> {
  return serializeFile(templateFormat, template, file);
}

/** The kind of an item, or `unknown` for a kind this version doesn't know. */
export function serviceItemKind(
  item: ServiceItem,
): ServiceItemKind | 'unknown' {
  return kindKeysOf(item)[0] ?? 'unknown';
}

function itemSchemaFor(input: unknown) {
  const [kind, ...others] = kindKeysOf(input);
  if (others.length > 0) {
    return mixedItemSchema;
  }
  return kind === undefined ? unknownItemSchema : itemSchemas[kind];
}

function kindKeysOf(input: unknown): readonly ServiceItemKind[] {
  if (!isRecord(input)) {
    return [];
  }
  return serviceItemKinds.filter(kind => Object.hasOwn(input, kind));
}
