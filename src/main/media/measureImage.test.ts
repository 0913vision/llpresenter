import {beforeEach, describe, expect, it, vi} from 'vitest';
import {THUMBNAIL_JPEG_QUALITY, measureImage} from './measureImage';

const electron = vi.hoisted(() => ({
  size: {width: 400, height: 300},
  empty: false,
  crop: vi.fn(),
  resize: vi.fn(),
  toJPEG: vi.fn<(quality: number) => Buffer>(() => Buffer.from([1, 2, 3])),
}));

vi.mock('electron', () => {
  const image = {
    isEmpty: () => electron.empty,
    getSize: () => electron.size,
    crop: (rect: unknown) => {
      electron.crop(rect);
      return image;
    },
    resize: (options: unknown) => {
      electron.resize(options);
      return image;
    },
    toJPEG: electron.toJPEG,
  };
  return {nativeImage: {createFromPath: () => image}};
});

beforeEach(() => {
  electron.empty = false;
  electron.crop.mockReset();
  electron.resize.mockReset();
});

describe('image measuring in main', () => {
  it('measures an image and draws the middle of it at the thumbnail size', () => {
    expect(measureImage('a.png', {width: 320, height: 180})).toEqual({
      width: 400,
      height: 300,
      thumbnail: Buffer.from([1, 2, 3]),
    });
    expect(electron.crop).toHaveBeenCalledWith({
      x: 0,
      y: 38,
      width: 400,
      height: 225,
    });
    expect(electron.resize).toHaveBeenCalledWith({
      width: 320,
      height: 180,
      quality: 'good',
    });
    expect(electron.toJPEG).toHaveBeenCalledWith(THUMBNAIL_JPEG_QUALITY);
  });

  it('only measures when no thumbnail is asked for', () => {
    expect(measureImage('a.png', null)).toEqual({width: 400, height: 300});
    expect(electron.crop).not.toHaveBeenCalled();
  });

  it('answers null for an image nativeImage cannot read', () => {
    electron.empty = true;
    expect(measureImage('a.webp', null)).toBeNull();
  });
});
