import * as v from 'valibot';
import type {Result} from '../result';
import {
  editFailureSchema,
  editSuccessSchema,
  type EditFailure,
  type EditSuccess,
} from './contentEdit';
import {revisionSchema} from './contentDocuments';
import {checkPart, type ReadonlyKnown} from './fileFormat';
import {
  audioPlaylistIdSchema,
  mediaIdSchema,
  mediaPlaylistIdSchema,
} from './ids';
import {
  audioPlaylistSchema,
  mediaListSchema,
  mediaPropsSchema,
  playlistSchema,
} from './mediaList';
import {payloadObject, plainObject} from './payload';
import {nonBlankText, percent} from './primitives';
import {settingsDocumentSchema} from './settingsDocuments';

const playlistRefSchema = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({kind: v.literal('media'), id: mediaPlaylistIdSchema}),
    v.object({kind: v.literal('audio'), id: audioPlaylistIdSchema}),
  ]),
);

const playlistValueSchema = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({kind: v.literal('media'), value: playlistSchema}),
    v.object({kind: v.literal('audio'), value: audioPlaylistSchema}),
  ]),
);

const propertiesChangeSchema = v.pipe(
  payloadObject({
    name: v.exactOptional(v.string()),
    props: v.exactOptional(mediaPropsSchema),
  }),
  v.check(
    ({name, props}) => name !== undefined || props !== undefined,
    'Expected a name, playback properties, or both',
  ),
);

const mediaEditSchema = v.pipe(
  plainObject,
  v.variant('type', [
    v.object({
      type: v.literal('media.playlist.create'),
      kind: v.picklist(['media', 'audio']),
    }),
    v.object({
      type: v.literal('media.playlist.update'),
      playlist: playlistValueSchema,
      baseRevision: revisionSchema,
    }),
    v.object({
      type: v.literal('media.playlist.delete'),
      playlist: playlistRefSchema,
    }),
    v.object({
      type: v.literal('media.properties.update'),
      mediaId: mediaIdSchema,
      changes: propertiesChangeSchema,
      baseRevision: revisionSchema,
    }),
    v.object({type: v.literal('media.relink'), mediaId: mediaIdSchema}),
    v.object({type: v.literal('media.delete'), mediaId: mediaIdSchema}),
    v.object({type: v.literal('media.import.cancel'), mediaId: mediaIdSchema}),
  ]),
);

const importRequestSchema = payloadObject({
  source: v.pipe(
    plainObject,
    v.variant('kind', [
      v.object({kind: v.literal('dialog')}),
      v.object({
        kind: v.literal('files'),
        paths: v.pipe(v.array(nonBlankText), v.minLength(1)),
      }),
    ]),
  ),
  playlist: v.nullable(playlistRefSchema),
});

const jobFields = {mediaId: mediaIdSchema, fileName: nonBlankText};
const importProgressSchema = v.pipe(
  plainObject,
  v.variant('phase', [
    v.object({...jobFields, phase: v.literal('queued'), percent: v.literal(0)}),
    v.object({...jobFields, phase: v.literal('copying'), percent}),
    v.object({...jobFields, phase: v.literal('analysing'), percent}),
    v.object({
      ...jobFields,
      phase: v.literal('complete'),
      percent: v.literal(100),
    }),
    v.object({
      ...jobFields,
      phase: v.literal('failed'),
      percent,
      message: nonBlankText,
    }),
    v.object({...jobFields, phase: v.literal('cancelled'), percent}),
  ]),
);

const mediaDocument = v.pipe(
  plainObject,
  settingsDocumentSchema('media', mediaListSchema),
);

function replySchema<TValue extends v.GenericSchema>(value: TValue) {
  return v.pipe(
    plainObject,
    v.variant('ok', [
      v.object({ok: v.literal(true), value}),
      v.object({ok: v.literal(false), error: editFailureSchema}),
    ]),
  );
}

const mediaEditResultSchema = replySchema(v.nullable(editSuccessSchema));
const mediaImportResultSchema = replySchema(
  v.pipe(
    v.array(importProgressSchema),
    v.check(
      jobs => new Set(jobs.map(({mediaId}) => mediaId)).size === jobs.length,
      'Another import job already has this media id',
    ),
  ),
);

export type MediaDocument = ReadonlyKnown<v.InferOutput<typeof mediaDocument>>;
export type MediaEdit = ReadonlyKnown<v.InferOutput<typeof mediaEditSchema>>;
export type MediaImportRequest = ReadonlyKnown<
  v.InferOutput<typeof importRequestSchema>
>;

/** The reserved media id identifies a copy job before it joins the library. */
export type MediaImportProgress = ReadonlyKnown<
  v.InferOutput<typeof importProgressSchema>
>;

/**
 * The success id names the affected entity; revision belongs to the whole
 * media list. Null success cancels a relink dialog or a copy job.
 */
export type MediaEditResult = Result<EditSuccess | null, EditFailure>;

/** An empty success means the import dialog was cancelled. */
export type MediaImportResult = Result<
  readonly MediaImportProgress[],
  EditFailure
>;

export function parseMediaDocument(value: unknown) {
  return checkPart(mediaDocument, value);
}

export function parseMediaEdit(value: unknown) {
  return checkPart(mediaEditSchema, value);
}

export function parseMediaImportRequest(value: unknown) {
  return checkPart(importRequestSchema, value);
}

export function parseMediaImportProgress(value: unknown) {
  return checkPart(importProgressSchema, value);
}

export function parseMediaEditResult(value: unknown) {
  return checkPart(mediaEditResultSchema, value);
}

export function parseMediaImportResult(value: unknown) {
  return checkPart(mediaImportResultSchema, value);
}
