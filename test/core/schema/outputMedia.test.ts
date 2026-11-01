import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {
  outputMediaProperties,
  outputMediaPropertiesSchema,
} from '@core/schema/outputMedia';
import {createMediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';

function item(props: MediaItem['props']): MediaItem {
  return {
    id: createMediaId('00000000-0000-4000-8000-000000000002'),
    name: 'Fixture',
    kind: 'audio',
    file: 'fixture.wav',
    size: 0,
    ...(props === undefined ? {} : {props}),
  };
}

describe('outputMediaProperties', () => {
  it('bounds the speed without changing the stored value', () => {
    const fast = item({speed: 100});
    expect(outputMediaProperties(fast).speed).toBe(4);
    expect(fast.props?.speed).toBe(100);
    expect(outputMediaProperties(item({speed: 0.1})).speed).toBe(0.25);
  });

  it('uses the defaults for absent properties', () => {
    expect(outputMediaProperties(item(undefined))).toEqual({
      speed: 1,
      fit: 'fill',
      volume: 100,
      audio: true,
    });
  });

  it.each([
    {speed: 0},
    {speed: Infinity},
    {fit: 'bad'},
    {volume: 101},
    {audio: 'yes'},
  ])('rejects an invalid output snapshot %j', change => {
    expect(
      v.safeParse(outputMediaPropertiesSchema, {
        speed: 1,
        fit: 'fill',
        volume: 100,
        audio: true,
        ...change,
      }).success,
    ).toBe(false);
  });
});
