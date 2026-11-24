import * as v from 'valibot';
import type {MediaItem} from './mediaList';
import {payloadObject} from './payload';
import {pictureAreaSchema, pictureFitSchema} from './picturePlace';
import {percent, seconds} from './primitives';

export const outputMediaPropertiesSchema = payloadObject({
  in: v.exactOptional(seconds),
  out: v.exactOptional(seconds),
  speed: v.pipe(v.number(), v.minValue(0.25), v.maxValue(4)),
  fit: pictureFitSchema,
  area: v.exactOptional(pictureAreaSchema),
  volume: percent,
  audio: v.boolean(),
});

export type OutputMediaProperties = Readonly<
  v.InferOutput<typeof outputMediaPropertiesSchema>
>;

/** Applies playback bounds without rewriting future values in the media list. */
export function outputMediaProperties(item: MediaItem): OutputMediaProperties {
  return {
    ...(item.props?.in === undefined ? {} : {in: item.props.in}),
    ...(item.props?.out === undefined ? {} : {out: item.props.out}),
    speed: Math.min(4, Math.max(0.25, item.props?.speed ?? 1)),
    fit: item.props?.fit ?? 'fill',
    ...(item.props?.area === undefined ? {} : {area: item.props.area}),
    volume: item.props?.volume ?? 100,
    audio:
      item.kind === 'audio' || (item.props?.audio ?? item.kind !== 'video'),
  };
}
