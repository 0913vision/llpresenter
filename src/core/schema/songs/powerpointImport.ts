import * as v from 'valibot';
import {checkPart} from '../common/fileFormat';
import {payloadObject, plainObject} from '../common/payload';
import {nonNegativeInteger} from '../common/primitives';
import {mediaIdSchema} from '../common/ids';
import {POWERPOINT_IMPORT_LIMITS, TEXT_IMPORT_LIMITS} from './textImportLimits';

/** Limits of the pictures of slides: how many, and how large one is. */
export const POWERPOINT_PICTURE_LIMITS = {
  count: 200,
  bytes: 32 * 1024 * 1024,
  pixels: 64 * 1024 * 1024,
  side: 16384,
} as const;

const shape = payloadObject({
  role: v.picklist(['title', 'body', 'free']),
  lines: v.pipe(
    v.array(v.pipe(v.string(), v.maxLength(TEXT_IMPORT_LIMITS.characters))),
    v.maxLength(TEXT_IMPORT_LIMITS.lines),
  ),
  main: v.exactOptional(nonNegativeInteger),
});
const slide = payloadObject({
  number: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.maxValue(POWERPOINT_IMPORT_LIMITS.slides),
  ),
  shapes: v.pipe(v.array(shape), v.maxLength(TEXT_IMPORT_LIMITS.lines)),
  background: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
  textColor: v.nullable(v.pipe(nonNegativeInteger, v.maxValue(0xffffff))),
});
const source = v.pipe(
  payloadObject({
    fileName: v.string(),
    widescreen: v.boolean(),
    slides: v.pipe(
      v.array(slide),
      v.maxLength(POWERPOINT_IMPORT_LIMITS.slides),
    ),
  }),
  v.check(value => {
    let lines = 0;
    let characters = 0;
    for (const item of value.slides) {
      for (const itemShape of item.shapes) {
        lines += itemShape.lines.length;
        for (const line of itemShape.lines) characters += line.length;
      }
    }
    return (
      lines <= TEXT_IMPORT_LIMITS.lines &&
      characters <= TEXT_IMPORT_LIMITS.characters
    );
  }, 'PowerPoint text exceeds its limits'),
);
const result = v.pipe(
  plainObject,
  v.variant('ok', [
    v.object({ok: v.literal(true), value: v.nullable(source)}),
    v.object({ok: v.literal(false), message: v.string()}),
  ]),
);
const imageBytes = v.custom<Uint8Array>(
  value =>
    value instanceof Uint8Array &&
    value.byteLength > 0 &&
    value.byteLength <= POWERPOINT_PICTURE_LIMITS.bytes,
);
const encodedImage = payloadObject({
  mime: v.picklist(['image/jpeg', 'image/png']),
  bytes: imageBytes,
});
const backgroundsRequest = payloadObject({
  indices: v.pipe(
    v.array(nonNegativeInteger),
    v.minLength(1),
    v.maxLength(POWERPOINT_PICTURE_LIMITS.count),
    v.check(indices => new Set(indices).size === indices.length),
  ),
});
const backgroundsResult = v.nullable(
  v.pipe(
    v.array(
      payloadObject({
        index: nonNegativeInteger,
        path: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    v.minLength(1),
    v.maxLength(POWERPOINT_PICTURE_LIMITS.count),
  ),
);
export type PowerPointBackgroundsRequest = v.InferOutput<
  typeof backgroundsRequest
>;
export type PowerPointBackgroundsResult = v.InferOutput<
  typeof backgroundsResult
>;
export const parsePowerPointBackgroundsRequest = (value: unknown) =>
  checkPart(backgroundsRequest, value);
export const parsePowerPointBackgroundsResult = (value: unknown) =>
  checkPart(backgroundsResult, value);
const releaseRequest = payloadObject({
  path: v.pipe(v.string(), v.minLength(1)),
});
const imageExportProgress = payloadObject({
  done: nonNegativeInteger,
  total: nonNegativeInteger,
  /** The background of a slide that was just exported. */
  picture: v.exactOptional(
    payloadObject({
      index: nonNegativeInteger,
      path: v.pipe(v.string(), v.minLength(1)),
    }),
  ),
});
const ownedImagesRequest = payloadObject({
  paths: v.pipe(
    v.array(v.string()),
    v.minLength(1),
    v.maxLength(POWERPOINT_PICTURE_LIMITS.count),
  ),
  /** The song the pictures are backgrounds of, or slides of their own. */
  title: v.exactOptional(v.pipe(v.string(), v.maxLength(1000))),
});
const ownedImagesResult = v.variant('ok', [
  v.object({
    ok: v.literal(true),
    value: v.pipe(
      v.array(mediaIdSchema),
      v.minLength(1),
      v.maxLength(POWERPOINT_PICTURE_LIMITS.count),
    ),
  }),
  v.object({ok: v.literal(false), message: v.string()}),
]);
export type PowerPointOwnedImagesRequest = v.InferOutput<
  typeof ownedImagesRequest
>;
export type PowerPointOwnedImagesResult = v.InferOutput<
  typeof ownedImagesResult
>;
export const parsePowerPointOwnedImagesRequest = (value: unknown) =>
  checkPart(ownedImagesRequest, value);
export const parsePowerPointOwnedImagesResult = (value: unknown) =>
  checkPart(ownedImagesResult, value);
const imageExportResult = v.variant('ok', [
  v.object({
    ok: v.literal(true),
    value: v.nullable(
      payloadObject({
        fileName: v.string(),
        slides: v.pipe(
          v.array(
            payloadObject({path: v.string(), number: positiveSlideNumber()}),
          ),
          v.maxLength(POWERPOINT_PICTURE_LIMITS.count),
        ),
      }),
    ),
  }),
  v.object({ok: v.literal(false), message: v.string()}),
]);

function positiveSlideNumber() {
  return v.pipe(v.number(), v.integer(), v.minValue(1));
}

export type PowerPointImageExportResult = v.InferOutput<
  typeof imageExportResult
>;
export type PowerPointImageExportProgress = v.InferOutput<
  typeof imageExportProgress
>;
export const parsePowerPointImageExportResult = (value: unknown) =>
  checkPart(imageExportResult, value);
export const parsePowerPointImageExportProgress = (value: unknown) =>
  checkPart(imageExportProgress, value);
const reading = payloadObject({
  fileName: v.pipe(v.string(), v.maxLength(260)),
});
export type PowerPointReading = v.InferOutput<typeof reading>;
export const parsePowerPointReading = (value: unknown) =>
  checkPart(reading, value);
export type PowerPointPreviewImage = v.InferOutput<typeof encodedImage> | null;
export const parsePowerPointPreviewImage = (value: unknown) =>
  checkPart(v.nullable(encodedImage), value);
export type PowerPointReadResult = v.InferOutput<typeof result>;
export type PowerPointSource = v.InferOutput<typeof source>;
export type PowerPointReleaseRequest = v.InferOutput<typeof releaseRequest>;
export const parsePowerPointReadResult = (value: unknown) =>
  checkPart(result, value);
export const parsePowerPointReleaseRequest = (value: unknown) =>
  checkPart(releaseRequest, value);
export const parsePowerPointReleaseResult = (value: unknown) =>
  checkPart(v.boolean(), value);
