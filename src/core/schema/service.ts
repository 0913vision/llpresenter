import * as v from 'valibot';
import type {Result} from '../common/result';
import {isRecord} from '../common/guards';
import {biblePassageSchema} from './biblePassage';
import {BIBLE_LOOKUP_LIMITS} from './bibleLookup';
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
  slideIdSchema,
  songGroupIdSchema,
  songIdSchema,
  templateIdSchema,
  themeIdSchema,
  translationIdSchema,
} from './ids';
import {SONG_GROUP_LIMITS} from './groupedSong';
import {itemOverlaysSchema} from './itemOverlays';
import {LIVE_STATE_LIMITS} from './liveLimits';
import {SONG_NAME_MAX_LENGTH} from './song';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  listWithUniqueIds,
  localDateTime,
  positiveInteger,
  positiveSeconds,
  timeOfDay,
} from './primitives';

const SERVICE_FORMAT = 'llservice';

/** Accepted kind keys of a 예배 순서 item. */
export const serviceItemKinds = [
  'header',
  'song',
  'bible',
  'slides',
  'media',
] as const;

export type ServiceItemKind = (typeof serviceItemKinds)[number];

export const SLIDES_LIMITS = {
  slides: 200,
  text: LIVE_STATE_LIMITS.textCharacters,
  name: SONG_NAME_MAX_LENGTH,
} as const;

const slideNameSchema = v.pipe(v.string(), v.maxLength(SLIDES_LIMITS.name));
const slideTextSchema = v.pipe(v.string(), v.maxLength(SLIDES_LIMITS.text));

export const verseSlideSchema = jsonObject({
  id: slideIdSchema,
  verse: jsonObject({
    translation: v.pipe(
      translationIdSchema,
      v.maxLength(BIBLE_LOOKUP_LIMITS.translationId),
    ),
    book: v.pipe(positiveInteger, v.maxValue(BIBLE_LOOKUP_LIMITS.books)),
    chapter: v.pipe(positiveInteger, v.maxValue(BIBLE_LOOKUP_LIMITS.chapters)),
    verse: v.pipe(positiveInteger, v.maxValue(BIBLE_LOOKUP_LIMITS.verses)),
  }),
});

export type VerseSlide = ReadonlyKnown<v.InferOutput<typeof verseSlideSchema>>;

export const slideSchema = v.pipe(
  v.lazy(input =>
    isRecord(input) && Object.hasOwn(input, 'verse')
      ? verseSlideSchema
      : v.union([
          jsonObject({
            id: slideIdSchema,
            text: slideTextSchema,
            name: v.exactOptional(slideNameSchema),
          }),
          jsonObject({id: slideIdSchema, media: mediaIdSchema}),
        ]),
  ),
  v.check(
    slide =>
      Object.hasOwn(slide, 'verse')
        ? !['media', 'name', 'text', 'continued'].some(key =>
            Object.hasOwn(slide, key),
          )
        : !Object.hasOwn(slide, 'media') ||
          (!Object.hasOwn(slide, 'text') && !Object.hasOwn(slide, 'name')),
    'A slide contains text, media, or a verse without mixed fields',
  ),
);

const slidesSchema = v.pipe(
  jsonObject({
    form: v.picklist(['blank', 'ad']),
    name: slideNameSchema,
    slides: v.pipe(
      listWithUniqueIds(slideSchema),
      v.maxLength(SLIDES_LIMITS.slides),
    ),
    advance: v.exactOptional(positiveSeconds),
    loop: v.exactOptional(v.boolean()),
  }),
  v.check(
    item =>
      item.form !== 'blank' ||
      item.slides.every(slide => !Object.hasOwn(slide, 'name')),
    'Blank slides do not have names',
  ),
  v.check(
    item =>
      item.form === 'blank' ||
      item.slides.every(slide => !Object.hasOwn(slide, 'verse')),
    'Only blank items can contain verse slides',
  ),
);

export type Slide = ReadonlyKnown<v.InferOutput<typeof slideSchema>>;

const itemFields = {
  id: serviceItemIdSchema,
  theme: v.exactOptional(themeIdSchema),
  overlays: v.exactOptional(itemOverlaysSchema),
};

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
    customOrder: v.exactOptional(
      v.pipe(
        v.array(songGroupIdSchema),
        v.maxLength(SONG_GROUP_LIMITS.occurrences),
      ),
    ),
    background: v.exactOptional(mediaIdSchema),
    ...startFields,
  }),
  bible: jsonObject({
    ...itemFields,
    bible: biblePassageSchema,
    ...startFields,
  }),
  slides: jsonObject({
    ...itemFields,
    slides: slidesSchema,
    background: v.exactOptional(mediaIdSchema),
    ...startFields,
  }),
  media: jsonObject({...itemFields, media: mediaIdSchema, ...startFields}),
};

const unknownItemSchema = jsonObject(itemFields);

const mixedItemSchema = v.never('An item has more than one kind key');

const serviceItemSchema = v.lazy(itemSchemaFor);

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
 * A 템플릿: the service file format with no `date` and an optional default `time`.
 * It lives in the 템플릿 folder.
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
