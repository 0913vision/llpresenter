import {describe, expect, it} from 'vitest';
import {pictureBucket, pictureSize} from '@core/media/pictureSize';

describe('preview pixels', () => {
  it.each([1, 1.25, 1.5, 2])('rounds up at pixel ratio %s', ratio => {
    expect(pictureBucket(440, ratio)).toBeGreaterThanOrEqual(440 * ratio);
    expect(pictureBucket(440, ratio)).toBeLessThan(440 * ratio + 32);
  });

  it('keeps enough panorama pixels for cover and preserves fit aspect', () => {
    const source = {width: 3840, height: 1200};
    expect(
      pictureSize(source, {width: 448, height: 256, fit: 'cover'}),
    ).toEqual({width: 820, height: 256});
    expect(
      pictureSize(source, {width: 448, height: 256, fit: 'contain'}),
    ).toEqual({width: 448, height: 140});
  });

  it('never upscales a small source', () => {
    expect(
      pictureSize(
        {width: 100, height: 50},
        {width: 448, height: 256, fit: 'cover'},
      ),
    ).toEqual({width: 100, height: 50});
  });
});
