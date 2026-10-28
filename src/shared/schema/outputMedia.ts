import * as v from 'valibot';
import type {MediaItem} from './mediaList';
import {payloadObject} from './payload';
import {percent} from './primitives';

export const outputMediaPropertiesSchema = payloadObject({
  speed: v.pipe(v.number(), v.minValue(0.25), v.maxValue(4)),
  fit: v.picklist(['fit', 'fill', 'stretch']),
  volume: percent,
  audio: v.boolean(),
});

export type OutputMediaProperties = Readonly<
  v.InferOutput<typeof outputMediaPropertiesSchema>
>;

/** Applies playback bounds without rewriting future values in the media list. */
export function outputMediaProperties(item: MediaItem): OutputMediaProperties {
  return {
    speed: Math.min(4, Math.max(0.25, item.props?.speed ?? 1)),
    fit: item.props?.fit ?? 'fill',
    volume: item.props?.volume ?? 100,
    audio: item.props?.audio ?? item.kind !== 'video',
  };
}
