import {describe, expect, it} from 'vitest';
import {pictureTransform} from './pictureCorrection';

const FULL_HD = {width: 1920, height: 1080, pixelRatio: 1};
const UHD = {width: 3840, height: 2160};
const STILL = {x: 0, y: 0};

describe('pictureTransform', () => {
  it('shrinks the picture by the edge margin on each side', () => {
    expect(
      pictureTransform({edgeMargin: 10, offset: STILL}, UHD, FULL_HD),
    ).toBe('translate(0px, 0px) scale(0.8)');
  });

  it('moves the picture in the screen pixels, scaled to the surface', () => {
    const correction = {edgeMargin: 0, offset: {x: 20, y: -8}};
    expect(pictureTransform(correction, UHD, FULL_HD)).toBe(
      'translate(10px, -4px) scale(1)',
    );
    expect(
      pictureTransform(correction, UHD, {
        width: 480,
        height: 270,
        pixelRatio: 1,
      }),
    ).toBe('translate(2.5px, -1px) scale(1)');
    expect(
      pictureTransform(correction, UHD, {
        width: 960,
        height: 720,
        pixelRatio: 1,
      }),
    ).toBe('translate(5px, -2.6666666666666665px) scale(1)');
  });

  it('counts device pixels when the screen has no pixel size', () => {
    expect(
      pictureTransform({edgeMargin: 0, offset: {x: 30, y: 15}}, undefined, {
        width: 1280,
        height: 720,
        pixelRatio: 1.5,
      }),
    ).toBe('translate(20px, 10px) scale(1)');
  });

  it('draws nothing at half or more, and leaves an uncorrected picture alone', () => {
    expect(
      pictureTransform({edgeMargin: 60, offset: STILL}, UHD, FULL_HD),
    ).toBe('translate(0px, 0px) scale(0)');
    expect(
      pictureTransform({edgeMargin: 0, offset: STILL}, UHD, FULL_HD),
    ).toBeNull();
  });
});
