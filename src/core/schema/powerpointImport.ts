import * as v from 'valibot';
import {checkPart} from './fileFormat';
import {payloadObject, plainObject} from './payload';
import {finiteNumber, nonNegativeInteger} from './primitives';
import {POWERPOINT_BACKGROUND_LIMITS as BACKGROUND_LIMITS} from '../songs/powerpointLayers';
import {mediaIdSchema} from './ids';
import {
  POWERPOINT_IMPORT_LIMITS,
  TEXT_IMPORT_LIMITS,
} from '../songs/textImportLimits';

const shape = payloadObject({
  body: v.boolean(),
  lines: v.pipe(
    v.array(v.pipe(v.string(), v.maxLength(TEXT_IMPORT_LIMITS.characters))),
    v.maxLength(TEXT_IMPORT_LIMITS.lines),
  ),
});
const slide = payloadObject({
  number: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.maxValue(POWERPOINT_IMPORT_LIMITS.slides),
  ),
  shapes: v.pipe(v.array(shape), v.maxLength(TEXT_IMPORT_LIMITS.lines)),
  background: v.nullable(v.string()),
});
const source = v.pipe(
  payloadObject({
    fileName: v.string(),
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
const fraction = v.pipe(finiteNumber, v.minValue(0), v.maxValue(1));
const signedFraction = v.pipe(finiteNumber, v.minValue(-1), v.maxValue(1));
const color = payloadObject({
  r: fraction,
  g: fraction,
  b: fraction,
  alpha: fraction,
});
const insets = payloadObject({
  left: finiteNumber,
  top: finiteNumber,
  right: finiteNumber,
  bottom: finiteNumber,
});
const matrix = payloadObject({
  a: finiteNumber,
  b: finiteNumber,
  c: finiteNumber,
  d: finiteNumber,
  e: finiteNumber,
  f: finiteNumber,
});
const fill = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({kind: v.literal('solid'), color}),
    v.object({
      kind: v.literal('gradient'),
      angle: finiteNumber,
      scaled: v.boolean(),
      radial: v.boolean(),
      focus: insets,
      stops: v.pipe(
        v.array(v.object({position: fraction, color})),
        v.minLength(1),
        v.maxLength(BACKGROUND_LIMITS.stops),
        v.check(stops =>
          stops.every(
            (stop, index) =>
              index === 0 || stop.position >= (stops[index - 1]?.position ?? 0),
          ),
        ),
      ),
    }),
  ]),
);
const layer = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({
      kind: v.literal('picture'),
      id: v.string(),
      matrix,
      part: v.string(),
      crop: insets,
      stretch: insets,
      alpha: fraction,
      brightness: signedFraction,
      contrast: signedFraction,
      grayscale: v.boolean(),
    }),
    v.object({
      kind: v.literal('shape'),
      id: v.string(),
      matrix,
      geometry: v.picklist(['rect', 'roundRect', 'ellipse']),
      radius: v.pipe(fraction, v.maxValue(0.5)),
      fill: v.nullable(fill),
      outline: v.nullable(
        v.object({width: v.pipe(finiteNumber, v.minValue(0)), fill}),
      ),
    }),
  ]),
);
const imageBytes = v.custom<Uint8Array>(
  value =>
    value instanceof Uint8Array &&
    value.byteLength > 0 &&
    value.byteLength <= BACKGROUND_LIMITS.imageBytes,
);
const encodedImage = payloadObject({
  mime: v.picklist(['image/jpeg', 'image/png']),
  bytes: imageBytes,
});
const scene = v.pipe(
  payloadObject({
    key: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
    layers: v.pipe(v.array(layer), v.maxLength(BACKGROUND_LIMITS.layers)),
    skipped: nonNegativeInteger,
    pictures: v.pipe(
      v.array(
        payloadObject({
          part: v.string(),
          mime: v.picklist(['image/jpeg', 'image/png']),
          bytes: imageBytes,
        }),
      ),
      v.maxLength(BACKGROUND_LIMITS.layers),
    ),
  }),
  v.check(value => {
    const parts = new Set(value.pictures.map(picture => picture.part));
    return (
      parts.size === value.pictures.length &&
      value.pictures.reduce(
        (total, picture) => total + picture.bytes.byteLength,
        0,
      ) <= BACKGROUND_LIMITS.totalImageBytes &&
      value.layers.every(
        item => item.kind !== 'picture' || parts.has(item.part),
      )
    );
  }),
);
const backgroundRequest = payloadObject({
  index: nonNegativeInteger,
  image: v.exactOptional(encodedImage),
});
const layersRequest = payloadObject({index: nonNegativeInteger});
const backgroundResult = v.nullable(v.string());
const releaseRequest = payloadObject({
  path: v.pipe(v.string(), v.minLength(1)),
});
const matchResult = v.nullable(mediaIdSchema);
export type PowerPointReadResult = v.InferOutput<typeof result>;
export type PowerPointSource = v.InferOutput<typeof source>;
export type PowerPointBackgroundRequest = v.InferOutput<
  typeof backgroundRequest
>;
export type PowerPointReleaseRequest = v.InferOutput<typeof releaseRequest>;
export type PowerPointLayersRequest = v.InferOutput<typeof layersRequest>;
export type PowerPointSceneResult = v.InferOutput<typeof scene> | null;
export const parsePowerPointScene = (value: unknown) => checkPart(scene, value);
export const parsePowerPointLayersResult = (value: unknown) =>
  checkPart(v.nullable(scene), value);
export const parsePowerPointLayersRequest = (value: unknown) =>
  checkPart(layersRequest, value);
export const parsePowerPointReadResult = (value: unknown) =>
  checkPart(result, value);
export const parsePowerPointBackgroundRequest = (value: unknown) =>
  checkPart(backgroundRequest, value);
export const parsePowerPointBackgroundResult = (value: unknown) =>
  checkPart(backgroundResult, value);
export const parsePowerPointReleaseRequest = (value: unknown) =>
  checkPart(releaseRequest, value);
export const parsePowerPointReleaseResult = (value: unknown) =>
  checkPart(v.boolean(), value);
export const parsePowerPointMatchResult = (value: unknown) =>
  checkPart(matchResult, value);
