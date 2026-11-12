import {describe, expect, it} from 'vitest';
import {boundedPowerPointImage} from '@main/import/powerpointImage';

function png(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.write('IHDR', 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}
describe('PowerPoint encoded image bounds', () => {
  it('accepts PNG and JPEG dimensions without decoding their pixels', () => {
    expect(boundedPowerPointImage(png(1920, 1080))).toBe(true);
    const jpeg = Buffer.from([255, 216, 255, 192, 0, 7, 8, 4, 56, 7, 128]);
    expect(boundedPowerPointImage(jpeg)).toBe(true);
  });
  it('rejects oversized, empty, truncated and unsupported image headers', () => {
    expect(boundedPowerPointImage(png(16385, 1))).toBe(false);
    expect(boundedPowerPointImage(png(16384, 16384))).toBe(false);
    expect(boundedPowerPointImage(png(0, 1080))).toBe(false);
    expect(boundedPowerPointImage(Buffer.from([255, 216, 255]))).toBe(false);
    expect(boundedPowerPointImage(Buffer.from('GIF89a'))).toBe(false);
  });
});
