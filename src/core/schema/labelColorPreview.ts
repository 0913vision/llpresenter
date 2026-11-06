import * as v from 'valibot';
import {labelColorSchema} from './labelColor';
import {payloadObject, parsePayload} from './payload';
import {nonBlankText} from './primitives';

const previewSchema = payloadObject({
  name: nonBlankText,
  color: labelColorSchema,
});
const requestSchema = payloadObject({
  name: nonBlankText,
  color: v.nullable(labelColorSchema),
});

export type LabelColorPreview = v.InferOutput<typeof previewSchema>;
export type LabelColorPreviewRequest = v.InferOutput<typeof requestSchema>;

export const parseLabelColorPreview = (value: unknown) =>
  parsePayload(v.nullable(previewSchema), value);
export const parseLabelColorPreviewRequest = (value: unknown) =>
  parsePayload(requestSchema, value);
export const parseLabelColorPreviewReply = (value: unknown) =>
  parsePayload(v.boolean(), value);
