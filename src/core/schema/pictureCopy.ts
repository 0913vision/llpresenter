import * as v from 'valibot';
import {parsePayload} from './payload';

const source = v.pipe(
  v.string(),
  v.maxLength(2048),
  v.regex(/^llp-media:\/\/(media|thumbnail)\//),
);
const edge = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8192));
const id = v.pipe(v.number(), v.integer(), v.minValue(0));
const requestSchema = v.object({
  id,
  source,
  width: edge,
  height: edge,
  fit: v.picklist(['cover', 'contain', 'fill', 'none', 'scale-down']),
  thumbnail: v.optional(v.boolean(), false),
});
const replySchema = v.object({
  id,
  picture: v.nullable(
    v.object({blob: v.instance(Blob), width: edge, height: edge}),
  ),
});

export function parsePictureRequest(value: unknown) {
  return parsePayload(requestSchema, value);
}

export function parsePictureReply(value: unknown) {
  return parsePayload(replySchema, value);
}
