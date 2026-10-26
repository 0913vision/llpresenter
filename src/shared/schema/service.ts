import * as v from 'valibot';
import type {Result} from '../result';
import {isRecord} from '../guards';
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
  mediaIdSchema,
  noticeSetIdSchema,
  serviceIdSchema,
  serviceItemIdSchema,
  songIdSchema,
  templateIdSchema,
} from './ids';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  listWithUniqueIds,
  localDateTime,
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

/** The kinds of item a 빈 자리 accepts. */
export const slotKinds = ['song', 'bible', 'slides'] as const;

export type SlotKind = (typeof slotKinds)[number];

const itemFields = {id: serviceItemIdSchema};

const startFields = {
  macro: v.exactOptional(v.string()),
  memo: v.exactOptional(v.string()),
};

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

/**
 * A 예배 순서 as its file holds it. A value from another process goes through
 * `checkPart`, which handles keys the way a file read does.
 */
export const serviceSchema = jsonObject({
  format: v.literal(SERVICE_FORMAT),
  schemaVersion: positiveInteger,
  id: serviceIdSchema,
  name: v.string(),
  date: localDateTime,
  order: orderSchema,
});

/** A 틀 as its file holds it, checked like {@link serviceSchema}. */
export const templateSchema = jsonObject({
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

/**
 * The items of a kind, such as `ServiceItemOf<'song'>`, or of any kind in a
 * union, such as `ServiceItemOf<'song' | 'header'>`.
 */
export type ServiceItemOf<TKind extends ServiceItemKind> =
  TKind extends ServiceItemKind
    ? Extract<ServiceItem, Readonly<Record<TKind, unknown>>>
    : never;

/** Whether an item is of a kind, so its fields can be read with their types. */
export function isItemOfKind<TKind extends ServiceItemKind>(
  item: ServiceItem,
  kind: TKind,
): item is ServiceItemOf<TKind> {
  return serviceItemKind(item) === kind;
}

/** The kind of an item, or `unknown` for a kind this version doesn't know. */
export function serviceItemKind(
  item: ServiceItem,
): ServiceItemKind | 'unknown' {
  return kindKeysOf(item)[0] ?? 'unknown';
}

// NOTE(0913vision): The declared return type keeps TypeScript from folding the
// item schemas into the unknown item schema, which has fewer fields, when it
// infers the type from the return statements.
function itemSchemaFor(
  input: unknown,
):
  | (typeof itemSchemas)[ServiceItemKind]
  | typeof unknownItemSchema
  | typeof mixedItemSchema {
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
