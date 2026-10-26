import * as v from 'valibot';
import type {Result} from '../result';
import {checkPart, type ReadonlyKnown} from './fileFormat';
import {payloadObject, plainObject} from './payload';
import {
  textImportEncodingSchema,
  textImportFirstLineSchema,
  textImportLabelsSchema,
  textImportSplitSchema,
} from './preferences';
import {nonBlankText, positiveInteger} from './primitives';
import {slideSchema} from './song';

const readRequestSchema = payloadObject({
  source: v.picklist(['file', 'clipboard']),
  encoding: textImportEncodingSchema,
});

const textImportSourceSchema = v.pipe(
  plainObject,
  v.variant('source', [
    v.object({
      source: v.literal('file'),
      fileName: nonBlankText,
      text: v.string(),
    }),
    v.object({
      source: v.literal('clipboard'),
      fileName: v.null(),
      text: v.string(),
    }),
  ]),
);

const textImportOptionsSchema = v.pipe(
  payloadObject({
    split: textImportSplitSchema,
    symbol: v.exactOptional(nonBlankText),
    unitsPerSlide: positiveInteger,
    labels: textImportLabelsSchema,
    firstLine: textImportFirstLineSchema,
  }),
  v.forward(
    v.check(
      ({split, symbol}) => split !== 'symbol' || symbol !== undefined,
      'A symbol split needs a nonblank symbol',
    ),
    ['symbol'],
  ),
);

const previewRequestSchema = payloadObject({
  source: textImportSourceSchema,
  options: textImportOptionsSchema,
});

const draftSchema = payloadObject({
  title: v.string(),
  slides: v.pipe(v.array(slideSchema), v.minLength(1)),
});

const failureSchema = payloadObject({
  reason: v.picklist(['read-failed', 'decode-failed', 'empty', 'invalid']),
  message: v.string(),
});

function resultSchema<TValue extends v.GenericSchema>(value: TValue) {
  return v.pipe(
    plainObject,
    v.variant('ok', [
      v.object({ok: v.literal(true), value}),
      v.object({ok: v.literal(false), error: failureSchema}),
    ]),
  );
}

const readResultSchema = resultSchema(v.nullable(textImportSourceSchema));
const previewResultSchema = resultSchema(draftSchema);

/** Main opens one file dialog or reads the clipboard; no renderer file path. */
export type TextImportReadRequest = Readonly<
  v.InferOutput<typeof readRequestSchema>
>;

/** Decoded input is retained by the dialog while split options change. */
export type TextImportSource = Readonly<
  v.InferOutput<typeof textImportSourceSchema>
>;
export type TextImportOptions = Readonly<
  v.InferOutput<typeof textImportOptionsSchema>
>;
export type TextImportPreviewRequest = ReadonlyKnown<
  v.InferOutput<typeof previewRequestSchema>
>;

/** An unsaved draft has no song id, and its title may still be empty. */
export type TextImportDraft = ReadonlyKnown<v.InferOutput<typeof draftSchema>>;
export type TextImportFailure = Readonly<v.InferOutput<typeof failureSchema>>;

/** A null success is a cancelled file dialog, not a failure or an empty draft. */
export type TextImportReadResult = Result<
  TextImportSource | null,
  TextImportFailure
>;
export type TextImportPreviewResult = Result<
  TextImportDraft,
  TextImportFailure
>;

export function parseTextImportReadRequest(value: unknown) {
  return checkPart(readRequestSchema, value);
}

export function parseTextImportClipboardAvailable(value: unknown) {
  return checkPart(v.boolean(), value);
}

export function parseTextImportPreviewRequest(value: unknown) {
  return checkPart(previewRequestSchema, value);
}

export function parseTextImportReadResult(value: unknown) {
  return checkPart(readResultSchema, value);
}

export function parseTextImportPreviewResult(value: unknown) {
  return checkPart(previewResultSchema, value);
}
