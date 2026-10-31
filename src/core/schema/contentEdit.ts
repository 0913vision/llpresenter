import * as v from 'valibot';
import type {Result} from '../common/result';
import {revisionSchema} from './contentDocuments';
import {checkPart, type ReadonlyKnown} from './fileFormat';
import {
  serviceIdSchema,
  serviceItemIdSchema,
  songIdSchema,
  templateIdSchema,
} from './ids';
import {payloadObject, plainObject, type PayloadError} from './payload';
import {localDateTime} from './primitives';
import {serviceSchema, templateSchema} from './service';
import {arrangementNameSchema} from './song';
import {groupedSongSchema} from './groupedSong';
import {songImportDraftSchema, songImportTargetSchema} from './songImport';

/** Why an edit wasn't applied. */
export const editRefusalReasons = [
  'stale',
  'not-found',
  'read-only',
  'duplicate-title',
  'invalid',
  'saves-full',
] as const;

export type EditRefusalReason = (typeof editRefusalReasons)[number];

const importSourceSchema = v.variant('kind', [
  v.object({kind: v.literal('service'), id: serviceIdSchema}),
  v.object({kind: v.literal('template'), id: templateIdSchema}),
]);

const songEditSchemas = [
  v.object({
    type: v.literal('song.import'),
    draft: songImportDraftSchema,
    target: songImportTargetSchema,
  }),
  v.object({type: v.literal('song.create')}),
  v.object({
    type: v.literal('song.update'),
    song: groupedSongSchema,
    baseRevision: revisionSchema,
  }),
  v.object({type: v.literal('song.delete'), songId: songIdSchema}),
  v.object({
    type: v.literal('song.arrangement.rename'),
    songId: songIdSchema,
    from: arrangementNameSchema,
    to: arrangementNameSchema,
  }),
  v.object({
    type: v.literal('song.arrangement.delete'),
    songId: songIdSchema,
    name: arrangementNameSchema,
  }),
] as const;

const serviceEditSchemas = [
  v.object({
    type: v.literal('service.create'),
    name: v.string(),
    date: localDateTime,
    templateId: v.nullable(templateIdSchema),
  }),
  v.object({
    type: v.literal('service.update'),
    service: serviceSchema,
    baseRevision: revisionSchema,
  }),
  v.object({type: v.literal('service.delete'), serviceId: serviceIdSchema}),
  v.object({
    type: v.literal('service.importItems'),
    serviceId: serviceIdSchema,
    from: importSourceSchema,
    itemIds: v.pipe(v.array(serviceItemIdSchema), v.minLength(1)),
  }),
  v.object({
    type: v.literal('service.saveAsTemplate'),
    serviceId: serviceIdSchema,
    name: v.string(),
  }),
  v.object({
    type: v.literal('template.update'),
    template: templateSchema,
    baseRevision: revisionSchema,
  }),
  v.object({type: v.literal('template.delete'), templateId: templateIdSchema}),
] as const;

const contentEditSchema = v.pipe(
  plainObject,
  v.variant('type', [
    ...songEditSchemas,
    ...serviceEditSchemas,
    v.object({type: v.literal('saves.retry')}),
  ]),
);

export const editSuccessSchema = payloadObject({
  id: v.pipe(v.string(), v.nonEmpty()),
  revision: v.nullable(revisionSchema),
});

export const editFailureSchema = v.variant('reason', [
  v.object({reason: v.picklist(editRefusalReasons), message: v.string()}),
  v.object({
    reason: v.literal('write-failed'),
    message: v.string(),
    applied: editSuccessSchema,
    unchangedFiles: v.pipe(v.array(v.string()), v.minLength(1)),
  }),
]);

const editResultSchema = v.pipe(
  plainObject,
  v.variant('ok', [
    v.object({ok: v.literal(true), value: editSuccessSchema}),
    v.object({ok: v.literal(false), error: editFailureSchema}),
  ]),
);

/**
 * An edit of a song, a 예배 순서, or a 템플릿 that a window asks the main process
 * to apply over `content:edit`. `service.importItems` appends copies of the
 * items, in their source order and with new ids, to the end of the 예배 순서
 * (`docs/spec/05-prep.md`, "Importing from another service"). `*.update` carries the whole document and the
 * revision it was edited from; the other edits change what they name, and the
 * main process rewrites every file they touch, such as the 예배 순서 items that
 * pick a renamed 구성.
 */
export type ContentEdit = ReadonlyKnown<
  v.InferOutput<typeof contentEditSchema>
>;

export type ContentEditType = ContentEdit['type'];

/**
 * The answer to an edit. `id` names the document it created or changed, and
 * `revision` is that document's new revision, or `null` when it was deleted.
 */
export type EditSuccess = v.InferOutput<typeof editSuccessSchema>;

/**
 * Why an edit failed. A refusal changed nothing; `stale` means the document
 * changed since `baseRevision`, so the window reads it again. `saves-full`
 * means too many files wait to be saved for this edit to write another one;
 * the edit was refused before it changed anything. `write-failed`
 * means the edit was applied and kept in memory, with its result in
 * `applied`, but the files in `unchangedFiles` couldn't be written; the main
 * process saves them again later and reports "저장할 수 없음"
 * (`docs/spec/02-data.md`, "Save failures").
 */
export type EditFailure = v.InferOutput<typeof editFailureSchema>;

export type EditResult = Result<EditSuccess, EditFailure>;

/**
 * Checks a `content:edit` request in the main process, with the same key
 * handling as a file read, so a song or 예배 순서 in it keeps its unknown
 * fields safely. Never throws.
 */
export function parseContentEdit(
  value: unknown,
): Result<ContentEdit, PayloadError> {
  return checkPart(contentEditSchema, value);
}

/** Checks a `content:edit` answer in the preload. Never throws. */
export function parseEditResult(
  value: unknown,
): Result<EditResult, PayloadError> {
  return checkPart(editResultSchema, value);
}

/** The answer to an edit that fails its check: refused, never applied. */
export function refuseInvalidEdit({field, message}: PayloadError): EditResult {
  const detail = field === '' ? message : `${field}: ${message}`;
  return {ok: false, error: {reason: 'invalid', message: detail}};
}
