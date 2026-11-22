import {describe, expect, it} from 'vitest';
import {powerPointImageSize} from '@main/import/powerpointImage';

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
    expect(powerPointImageSize(png(1920, 1080))).toEqual(FULL_HD);
    const jpeg = Buffer.from([255, 216, 255, 192, 0, 7, 8, 4, 56, 7, 128]);
    expect(powerPointImageSize(jpeg)).toEqual(FULL_HD);
  });
  it('rejects oversized, empty, truncated and unsupported image headers', () => {
    expect(powerPointImageSize(png(16385, 1))).toBeNull();
    expect(powerPointImageSize(png(16384, 16384))).toBeNull();
    expect(powerPointImageSize(png(0, 1080))).toBeNull();
    expect(powerPointImageSize(Buffer.from([255, 216, 255]))).toBeNull();
    expect(powerPointImageSize(Buffer.from('GIF89a'))).toBeNull();
  });
});
