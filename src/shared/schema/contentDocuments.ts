import * as v from 'valibot';
import type {Result} from '../result';
import {checkPart, type ReadonlyKnown} from './fileFormat';
import {serviceIdSchema, songIdSchema, templateIdSchema} from './ids';
import {payloadObject, type PayloadError} from './payload';
import {localDateTime, nonNegativeInteger, positiveInteger} from './primitives';
import {serviceSchema, templateSchema} from './service';
import {songSchema} from './song';

/**
 * A document's revision in the main process: 1 when it is read at launch, and
 * one more with every change the main process applies to it. It isn't stored
 * in the file.
 */
export const revisionSchema = v.pipe(positiveInteger, v.flavor('Revision'));

export type Revision = v.InferOutput<typeof revisionSchema>;

export const accessSchema = v.picklist(['editable', 'readOnly']);

const songDocumentSchema = payloadObject({
  song: songSchema,
  revision: revisionSchema,
  access: accessSchema,
});

const serviceDocumentSchema = payloadObject({
  service: serviceSchema,
  revision: revisionSchema,
  access: accessSchema,
});

const templateDocumentSchema = payloadObject({
  template: templateSchema,
  revision: revisionSchema,
  access: accessSchema,
});

const librarySongSchema = payloadObject({
  id: songIdSchema,
  title: v.string(),
  slideCount: nonNegativeInteger,
  access: accessSchema,
  usedBy: v.array(payloadObject({id: serviceIdSchema, name: v.string()})),
});

const serviceEntrySchema = payloadObject({
  id: serviceIdSchema,
  name: v.string(),
  date: localDateTime,
  access: accessSchema,
});

const templateEntrySchema = payloadObject({
  id: templateIdSchema,
  name: v.string(),
  access: accessSchema,
});

const SAME_ID = 'The document has another id than the change names';

const songChangeSchema = v.pipe(
  payloadObject({
    songId: songIdSchema,
    document: v.nullable(songDocumentSchema),
  }),
  v.forward(
    v.check(
      ({songId, document}) => document === null || document.song.id === songId,
      SAME_ID,
    ),
    ['document'],
  ),
);

const serviceChangeSchema = v.pipe(
  payloadObject({
    serviceId: serviceIdSchema,
    document: v.nullable(serviceDocumentSchema),
  }),
  v.forward(
    v.check(
      ({serviceId, document}) =>
        document === null || document.service.id === serviceId,
      SAME_ID,
    ),
    ['document'],
  ),
);

const templateChangeSchema = v.pipe(
  payloadObject({
    templateId: templateIdSchema,
    document: v.nullable(templateDocumentSchema),
  }),
  v.forward(
    v.check(
      ({templateId, document}) =>
        document === null || document.template.id === templateId,
      SAME_ID,
    ),
    ['document'],
  ),
);

/**
 * A song as a window edits it: the file's content, its revision, and whether
 * a newer app version wrote it, which makes it read-only.
 */
export type SongDocument = ReadonlyKnown<
  v.InferOutput<typeof songDocumentSchema>
>;

export type ServiceDocument = ReadonlyKnown<
  v.InferOutput<typeof serviceDocumentSchema>
>;

export type TemplateDocument = ReadonlyKnown<
  v.InferOutput<typeof templateDocumentSchema>
>;

/**
 * One row of the 라이브러리: what the list shows, and the 예배 순서 that use
 * the song (the "예배 순서 2곳" tag and its tooltip).
 */
export type LibrarySong = ReadonlyKnown<
  v.InferOutput<typeof librarySongSchema>
>;

/** One 예배 순서 of the list that switches the open one. */
export type ServiceEntry = ReadonlyKnown<
  v.InferOutput<typeof serviceEntrySchema>
>;

export type TemplateEntry = ReadonlyKnown<
  v.InferOutput<typeof templateEntrySchema>
>;

/**
 * A song that changed, with its new revision, or `null` when it was deleted.
 * The window that sent the edit recognizes its own change by the revision in
 * the edit's answer.
 */
export type SongChange = ReadonlyKnown<v.InferOutput<typeof songChangeSchema>>;

export type ServiceChange = ReadonlyKnown<
  v.InferOutput<typeof serviceChangeSchema>
>;

export type TemplateChange = ReadonlyKnown<
  v.InferOutput<typeof templateChangeSchema>
>;

function checker<TSchema extends v.GenericSchema>(schema: TSchema) {
  return (value: unknown): Result<v.InferOutput<TSchema>, PayloadError> =>
    checkPart(schema, value);
}

function listChecker<TSchema extends v.GenericSchema>(schema: TSchema) {
  const list = v.array(schema);
  return (
    value: unknown,
  ): Result<ReadonlyArray<v.InferOutput<TSchema>>, PayloadError> =>
    checkPart(list, value);
}

function nullableChecker<TSchema extends v.GenericSchema>(schema: TSchema) {
  const check = checker(schema);
  return (
    value: unknown,
  ): Result<v.InferOutput<TSchema> | null, PayloadError> =>
    value === null ? {ok: true, value: null} : check(value);
}

/** Checks a `songs:document:get` answer: the song, or `null` for none. */
export const parseSongDocument = nullableChecker(songDocumentSchema);

/** Checks a `services:document:get` answer. */
export const parseServiceDocument = nullableChecker(serviceDocumentSchema);

/** Checks a `templates:document:get` answer. */
export const parseTemplateDocument = nullableChecker(templateDocumentSchema);

/** Checks a `songs:list` answer or a `songs:list:changed` push. */
export const parseLibrarySongs = listChecker(librarySongSchema);

/** Checks a `services:list` answer or a `services:list:changed` push. */
export const parseServiceEntries = listChecker(serviceEntrySchema);

/** Checks a `templates:list` answer or a `templates:list:changed` push. */
export const parseTemplateEntries = listChecker(templateEntrySchema);

/** Checks a `songs:document:changed` push. */
export const parseSongChange = checker(songChangeSchema);

/** Checks a `services:document:changed` push. */
export const parseServiceChange = checker(serviceChangeSchema);

/** Checks a `templates:document:changed` push. */
export const parseTemplateChange = checker(templateChangeSchema);
