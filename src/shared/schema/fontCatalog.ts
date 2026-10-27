import * as v from 'valibot';
import type {Result} from '../result';
import {parsePayload, payloadObject, type PayloadError} from './payload';
import {nonBlankText} from './primitives';

export const FONT_CATALOG_LIMITS = {
  families: 2048,
  aliases: 16,
  weights: 64,
  name: 200,
} as const;
const CONTROL_CHARACTER_LIMIT = 32;
const DELETE_CHARACTER_CODE = 127;

function hasNoControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < CONTROL_CHARACTER_LIMIT || code === DELETE_CHARACTER_CODE) {
      return false;
    }
  }
  return true;
}

const name = v.pipe(
  nonBlankText,
  v.maxLength(FONT_CATALOG_LIMITS.name),
  v.check(hasNoControlCharacters, 'Invalid font name'),
);
const family = payloadObject({
  family: name,
  label: name,
  aliases: v.pipe(v.array(name), v.maxLength(FONT_CATALOG_LIMITS.aliases)),
  weights: v.pipe(
    v.array(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1000))),
    v.minLength(1),
    v.maxLength(FONT_CATALOG_LIMITS.weights),
  ),
});
const catalog = v.pipe(
  v.array(family),
  v.maxLength(FONT_CATALOG_LIMITS.families),
);

/** Installed family names, localized labels, aliases, and OpenType weights. */
export type FontFamily = Readonly<v.InferOutput<typeof family>>;
export type FontCatalog = readonly FontFamily[];

/** Validates native font metadata and the fonts:get reply, dropping unknown fields. */
export function parseFontCatalog(
  value: unknown,
): Result<FontCatalog, PayloadError> {
  return parsePayload(catalog, value);
}
