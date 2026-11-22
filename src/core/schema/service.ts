import * as v from 'valibot';
import type {Result} from '../common/result';
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
  serviceIdSchema,
  serviceItemIdSchema,
  songIdSchema,
  templateIdSchema,
} from './ids';
import {itemOverlaysSchema} from './itemOverlays';
import {isKnownKind, kindsWithUnknown} from './kinds';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  listWithUniqueIds,
  localDateTime,
  positiveInteger,
  timeOfDay,
} from './primitives';
import {slidesSchema} from './slide';

const SERVICE_FORMAT = 'llservice';

/** Accepted kinds of a 예배 순서 item. */
export const serviceItemKinds = [
  'header',
  'song',
  'bible',
  'sermon',
  'liturgy',
  'notice',
  'blank',
  'media',
] as const;

export type ServiceItemKind = (typeof serviceItemKinds)[number];

const itemFields = {id: serviceItemIdSchema, name: v.string()};

const slidesFields = {
  ...itemFields,
  slides: slidesSchema,
  overlays: v.exactOptional(itemOverlaysSchema),
  macro: v.exactOptional(v.string()),
  memo: v.exactOptional(v.string()),
};

const itemSchemas = {
  header: jsonObject({...itemFields, kind: v.literal('header')}),
  song: jsonObject({
    ...slidesFields,
    kind: v.literal('song'),
    song: songIdSchema,
  }),
  bible: jsonObject({
    ...slidesFields,
    kind: v.literal('bible'),
    passage: biblePassageSchema,
  }),
  sermon: jsonObject({
    ...slidesFields,
    kind: v.literal('sermon'),
    passage: biblePassageSchema,
  }),
  liturgy: jsonObject({
    ...slidesFields,
    kind: v.literal('liturgy'),
    liturgy: v.picklist(['creed', 'prayer']),
    translation: v.picklist(['new', 'old']),
  }),
  notice: jsonObject({...slidesFields, kind: v.literal('notice')}),
  blank: jsonObject({...slidesFields, kind: v.literal('blank')}),
  media: jsonObject({
    ...slidesFields,
    kind: v.literal('media'),
    media: mediaIdSchema,
  }),
};

const serviceItemSchema = kindsWithUnknown(
  serviceItemKinds,
  itemSchemas,
  itemFields,
);

/** Bounds for one 예배 순서 or 템플릿. */
export const SERVICE_LIMITS = {
  /** A long service is about 60 items; this leaves room for a very long one. */
  items: 1000,
} as const;

const orderSchema = v.pipe(
  listWithUniqueIds(serviceItemSchema),
  v.maxLength(SERVICE_LIMITS.items),
);

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

/** A 템플릿 as its file holds it, checked like {@link serviceSchema}. */
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
 * A 템플릿: the service file format with no `date` and an optional legacy `time`.
 * It lives in the 템플릿 folder.
 */
export type Template = ReadonlyKnown<v.InferOutput<typeof templateSchema>>;

/**
 * One row of a 예배 순서. An item of a kind this version doesn't know is kept
 * with only its shared fields typed; {@link isItemOfKind} tells kinds apart.
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

type KnownItem = ReadonlyKnown<
  v.InferOutput<(typeof itemSchemas)[ServiceItemKind]>
>;

/** The items of a kind, such as `ServiceItemOf<'song'>`, or of several. */
export type ServiceItemOf<TKind extends ServiceItemKind> = Extract<
  KnownItem,
  {readonly kind: TKind}
>;

/** An item with slides. */
export type SlidesItem = Exclude<KnownItem, {readonly kind: 'header'}>;

/** Whether an item is of a kind, so its fields can be read with their types. */
export function isItemOfKind<TKind extends ServiceItemKind>(
  item: ServiceItem,
  kind: TKind,
): item is ServiceItemOf<TKind> {
  return item.kind === kind;
}

/** Whether an item has slides. */
export function hasSlides(item: ServiceItem): item is SlidesItem {
  return item.kind !== 'header' && isKnownKind(serviceItemKinds, item.kind);
}

/** The kind of an item, or `unknown` for a kind this version doesn't know. */
export function serviceItemKind(
  item: ServiceItem,
): ServiceItemKind | 'unknown' {
  return serviceItemKinds.find(kind => kind === item.kind) ?? 'unknown';
}
