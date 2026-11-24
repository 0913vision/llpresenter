import * as v from 'valibot';
import {labelColorSchema} from './labelColor';
import {payloadObject, parsePayload} from '../common/payload';
import {nonBlankText} from '../common/primitives';

const previewSchema = payloadObject({
  name: nonBlankText,
  color: labelColorSchema,
});
const requestSchema = payloadObject({
  name: nonBlankText,
  color: v.nullable(labelColorSchema),
});

/**
 * A color that one window tries out on the 이름표 of this name, shown in every
 * window before it is saved.
 */
export type LabelColorPreview = v.InferOutput<typeof previewSchema>;
/**
 * A window's request to try out `color` on a 이름표, or to take its try-out back
 * with `null`.
 */
export type LabelColorPreviewRequest = v.InferOutput<typeof requestSchema>;

/** Checks a shown color, or `null` when it was taken back. */
export function parseLabelColorPreview(value: unknown) {
  return parsePayload(v.nullable(previewSchema), value);
}
/** Checks a request to try out a 이름표 color. */
export function parseLabelColorPreviewRequest(value: unknown) {
  return parsePayload(requestSchema, value);
}
/**
 * Checks the answer to a request to try out a 이름표 color: whether it was
 * accepted.
 */
export function parseLabelColorPreviewReply(value: unknown) {
  return parsePayload(v.boolean(), value);
}
