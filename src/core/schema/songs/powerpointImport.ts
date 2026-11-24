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
/**
 * The slides of the PowerPoint file read last, by position, whose backgrounds
 * main saves as picture files; at most 200.
 */
export type PowerPointBackgroundsRequest = v.InferOutput<
  typeof backgroundsRequest
>;
/**
 * The picture file of each background asked for, or `null` when they could not
 * be made.
 */
export type PowerPointBackgroundsResult = v.InferOutput<
  typeof backgroundsResult
>;
/** Checks a request for slide backgrounds. */
export const parsePowerPointBackgroundsRequest = (value: unknown) =>
  checkPart(backgroundsRequest, value);
/** Checks the answer to a request for slide backgrounds. */
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
/**
 * The temporary picture files to move into the media store. A `title` marks
 * them as backgrounds of the song of that name; without it they become slides
 * of their own.
 */
export type PowerPointOwnedImagesRequest = v.InferOutput<
  typeof ownedImagesRequest
>;
/**
 * The media ids of the stored pictures in the order of the request, or why they
 * were not stored.
 */
export type PowerPointOwnedImagesResult = v.InferOutput<
  typeof ownedImagesResult
>;
/** Checks a request to store picture files. */
export const parsePowerPointOwnedImagesRequest = (value: unknown) =>
  checkPart(ownedImagesRequest, value);
/** Checks the answer to a request to store picture files. */
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

/**
 * The slides drawn as pictures, with the PowerPoint file's name and one picture
 * file and slide number per slide, or `null` when it was cancelled; or why it
 * failed.
 */
export type PowerPointImageExportResult = v.InferOutput<
  typeof imageExportResult
>;
/**
 * How far drawing the slides as pictures has come: `done` of `total`, with the
 * background just exported when there is one.
 */
export type PowerPointImageExportProgress = v.InferOutput<
  typeof imageExportProgress
>;
/** Checks the answer of drawing the slides as pictures. */
export const parsePowerPointImageExportResult = (value: unknown) =>
  checkPart(imageExportResult, value);
/** Checks a progress report of drawing the slides as pictures. */
export const parsePowerPointImageExportProgress = (value: unknown) =>
  checkPart(imageExportProgress, value);
const reading = payloadObject({
  fileName: v.pipe(v.string(), v.maxLength(260)),
});
/** The file name of the PowerPoint file that was chosen and is being read. */
export type PowerPointReading = v.InferOutput<typeof reading>;
/** Checks a notice that a PowerPoint file is being read. */
export const parsePowerPointReading = (value: unknown) =>
  checkPart(reading, value);
/**
 * A picture file as encoded bytes (JPEG or PNG) for a preview, or `null` when
 * it is gone.
 */
export type PowerPointPreviewImage = v.InferOutput<typeof encodedImage> | null;
/** Checks a preview picture. */
export const parsePowerPointPreviewImage = (value: unknown) =>
  checkPart(v.nullable(encodedImage), value);
/**
 * The text and backgrounds of a PowerPoint file that was read, `null` when the
 * file dialog was cancelled, or why reading failed.
 */
export type PowerPointReadResult = v.InferOutput<typeof result>;
/**
 * A PowerPoint file read: its name, whether it is widescreen, and the texts of
 * its slides by shape.
 */
export type PowerPointSource = v.InferOutput<typeof source>;
/**
 * A temporary picture file, by its path, that a window names to read or to give
 * up.
 */
export type PowerPointReleaseRequest = v.InferOutput<typeof releaseRequest>;
/** Checks the answer of reading a PowerPoint file. */
export const parsePowerPointReadResult = (value: unknown) =>
  checkPart(result, value);
/** Checks a request that names a temporary picture file. */
export const parsePowerPointReleaseRequest = (value: unknown) =>
  checkPart(releaseRequest, value);
/**
 * Checks a yes or no answer about a PowerPoint call, such as whether a picture
 * file was released.
 */
export const parsePowerPointReleaseResult = (value: unknown) =>
  checkPart(v.boolean(), value);
