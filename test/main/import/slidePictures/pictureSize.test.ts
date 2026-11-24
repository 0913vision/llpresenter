import {describe, expect, it} from 'vitest';
import {pictureSizeOf} from '@main/import/slidePictures/pictureSize';

const FULL_HD = {width: 1920, height: 1080};

function png(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.write('IHDR', 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

describe('PowerPoint encoded image bounds', () => {
  it('reads PNG and JPEG dimensions without decoding their pixels', () => {
    expect(pictureSizeOf(png(1920, 1080))).toEqual(FULL_HD);
    const jpeg = Buffer.from([255, 216, 255, 192, 0, 7, 8, 4, 56, 7, 128]);
    expect(pictureSizeOf(jpeg)).toEqual(FULL_HD);
  });
  it('rejects oversized, empty, truncated and unsupported image headers', () => {
    expect(pictureSizeOf(png(16385, 1))).toBeNull();
    expect(pictureSizeOf(png(16384, 16384))).toBeNull();
    expect(pictureSizeOf(png(0, 1080))).toBeNull();
    expect(pictureSizeOf(Buffer.from([255, 216, 255]))).toBeNull();
    expect(pictureSizeOf(Buffer.from('GIF89a'))).toBeNull();
  });
});
