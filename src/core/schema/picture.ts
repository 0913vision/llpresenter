import * as v from 'valibot';
import {layerSchemas} from './liveState';
import {screenIdSchema, themeIdSchema} from './ids';
import {liveThemeItemSchema} from './liveTheme';
import {themeScreenLayoutSchema} from './themes';
import {parsePayload, payloadObject} from './payload';
import {pixelSize} from './primitives';
import {stageLyricLabelPositionSchema} from './preferences';
import type {ReadonlyKnown} from './fileFormat';

/** Bounds the serialized request before it is queued for the painter. */
export const MAX_PICTURE_REQUEST_BYTES = 1_000_000;

const number = v.pipe(v.number(), v.finite());
const text = v.pipe(v.string(), v.maxLength(4096));
const pictureScreenSchema = payloadObject({
  id: screenIdSchema,
  name: v.exactOptional(text),
  kind: v.picklist(['audience', 'broadcast', 'stage']),
  messageStyleId: v.exactOptional(text),
  songCaption: v.exactOptional(v.picklist(['band', 'text'])),
  method: v.exactOptional(
    v.picklist(['fullscreen', 'window', 'capture', 'ndi']),
  ),
  emptyColor: v.exactOptional(text),
  pictureSize: v.exactOptional(pixelSize),
  correction: v.exactOptional(
    payloadObject({
      edgeMargin: number,
      offset: payloadObject({x: number, y: number}),
    }),
  ),
});

const pictureThemeSchema = payloadObject({
  themeId: themeIdSchema,
  revision: v.pipe(v.number(), v.integer(), v.minValue(0)),
  missing: v.pipe(v.array(text), v.maxLength(2)),
  item: v.nullable(liveThemeItemSchema),
  sourceScreenId: screenIdSchema,
  layout: themeScreenLayoutSchema,
  emptyColor: text,
});

const pictureSpecSchema = payloadObject({
  layers: payloadObject({
    media: v.nullable(layerSchemas.media),
    slide: v.nullable(layerSchemas.slide),
    prop: v.nullable(layerSchemas.prop),
    audio: v.nullable(layerSchemas.audio),
    message: v.nullable(layerSchemas.message),
  }),
  appearance: payloadObject({
    screen: pictureScreenSchema,
    theme: pictureThemeSchema,
    audience: v.exactOptional(
      payloadObject({screen: pictureScreenSchema, theme: pictureThemeSchema}),
    ),
    background: text,
    stageLyricLabelPosition: v.exactOptional(stageLyricLabelPositionSchema),
    biblePreview: v.exactOptional(
      payloadObject({
        elementId: text,
        maxLines: v.pipe(
          v.number(),
          v.integer(),
          v.minValue(0),
          v.maxValue(1000),
        ),
      }),
    ),
    checker: v.boolean(),
  }),
});

/** A checked picture request, shared by the preload and main process. */
export const pictureRequestSchema = v.pipe(
  payloadObject({
    spec: pictureSpecSchema,
    inputs: v.pipe(v.string(), v.maxLength(100_000)),
    repaint: v.exactOptional(v.literal(true)),
  }),
  v.check(
    value =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      MAX_PICTURE_REQUEST_BYTES,
    'Picture request is too large',
  ),
);

export type PictureRequest = ReadonlyKnown<
  v.InferOutput<typeof pictureRequestSchema>
>;

/** Checks a painter request. */
export function parsePictureRequest(value: unknown) {
  return parsePayload(pictureRequestSchema, value);
}

const pictureImageSchema = v.pipe(
  v.instance(Uint8Array),
  v.minLength(4),
  v.maxLength(20_000_000),
);

/** Checks a bounded encoded image returned by the painter. */
export function parsePictureImage(value: unknown) {
  return parsePayload(pictureImageSchema, value);
}

/** Checks a cache lookup that may not have a stored image. */
export function parseOptionalPictureImage(value: unknown) {
  return parsePayload(v.nullable(pictureImageSchema), value);
}

const pictureUploadSchema = payloadObject({
  picture: pictureRequestSchema,
  image: pictureImageSchema,
});

export interface PictureUpload {
  readonly picture: PictureRequest;
  readonly image: Uint8Array;
}

/** Checks a still already drawn in the editor. */
export function parsePictureUpload(value: unknown) {
  return parsePayload(pictureUploadSchema, value);
}
