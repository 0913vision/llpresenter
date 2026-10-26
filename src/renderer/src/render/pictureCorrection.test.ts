import {describe, expect, it} from 'vitest';
import {scaleFor} from './lyricStyle';
import {pictureTransform} from './pictureCorrection';

const STILL = {x: 0, y: 0};

describe('pictureTransform', () => {
  it('shrinks the picture by the edge margin on each side', () => {
    expect(pictureTransform({edgeMargin: 10, offset: STILL}, 1)).toBe(
      'translate(0px, 0px) scale(0.8)',
    );
  });

  it('moves the picture in reference px, scaled like lyric sizes', () => {
    const correction = {edgeMargin: 0, offset: {x: 40, y: -8}};
    expect(pictureTransform(correction, scaleFor(1920, 1080))).toBe(
      'translate(40px, -8px) scale(1)',
    );
    expect(pictureTransform(correction, scaleFor(480, 270))).toBe(
      'translate(10px, -2px) scale(1)',
    );
  });

  it('draws nothing at half or more, and leaves an uncorrected picture alone', () => {
    expect(pictureTransform({edgeMargin: 60, offset: STILL}, 1)).toBe(
      'translate(0px, 0px) scale(0)',
    );
    expect(pictureTransform({edgeMargin: 0, offset: STILL}, 1)).toBeNull();
  });
});
