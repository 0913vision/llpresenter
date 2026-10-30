import {describe, expect, it} from 'vitest';
import {coverCrop} from './coverCrop';

const TILE = {width: 320, height: 180};

describe('coverCrop', () => {
  it('keeps a picture of the same aspect ratio whole', () => {
    expect(coverCrop({width: 1920, height: 1080}, TILE)).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
  });

  it('crops the middle of a tall or a wide picture', () => {
    expect(coverCrop({width: 1080, height: 1920}, TILE)).toEqual({
      x: 0,
      y: 656.25,
      width: 1080,
      height: 607.5,
    });
    expect(coverCrop({width: 3000, height: 1000}, TILE)).toEqual({
      x: 611.1111111111111,
      y: 0,
      width: 1777.7777777777778,
      height: 1000,
    });
  });
});
