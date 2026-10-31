import * as v from 'valibot';
import {parsePayload, payloadObject} from './payload';
import {seconds} from './primitives';

const mediaProgressSchema = v.nullable(
  v.pipe(
    payloadObject({
      mediaId: v.pipe(v.string(), v.nonEmpty()),
      startedAt: v.pipe(v.number(), v.finite()),
      positionSeconds: seconds,
      durationSeconds: v.nullable(
        v.pipe(seconds, v.minValue(Number.MIN_VALUE)),
      ),
    }),
    v.check(
      value =>
        value.durationSeconds === null ||
        value.positionSeconds <= value.durationSeconds,
      'Expected position within the video duration',
    ),
  ),
);

export type MediaProgress = Readonly<
  NonNullable<v.InferOutput<typeof mediaProgressSchema>>
>;
export const parseMediaProgress = (value: unknown) =>
  parsePayload(mediaProgressSchema, value);
