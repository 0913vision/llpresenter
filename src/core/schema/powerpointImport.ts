import * as v from 'valibot';
import {checkPart} from './fileFormat';
import {payloadObject, plainObject} from './payload';
import {nonNegativeInteger} from './primitives';
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
const backgroundRequest = payloadObject({index: nonNegativeInteger});
const backgroundResult = v.nullable(v.string());
const releaseRequest = payloadObject({
  path: v.pipe(v.string(), v.minLength(1)),
});
export type PowerPointReadResult = v.InferOutput<typeof result>;
export type PowerPointSource = v.InferOutput<typeof source>;
export type PowerPointBackgroundRequest = v.InferOutput<
  typeof backgroundRequest
>;
export type PowerPointReleaseRequest = v.InferOutput<typeof releaseRequest>;
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
