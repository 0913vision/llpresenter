import {POWERPOINT_BACKGROUND_LIMITS as LIMITS} from '@core/songs/powerpointLayers';

function allowed(width: number, height: number): boolean {
  return (
    width > 0 &&
    height > 0 &&
    width <= LIMITS.imageSide &&
    height <= LIMITS.imageSide &&
    width * height <= LIMITS.imagePixels
  );
}
/** Checks encoded image dimensions before Chromium allocates a bitmap. */
export function boundedPowerPointImage(bytes: Buffer): boolean {
  if (bytes.length > LIMITS.imageBytes) return false;
  if (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return (
      bytes.toString('ascii', 12, 16) === 'IHDR' &&
      allowed(bytes.readUInt32BE(16), bytes.readUInt32BE(20))
    );
  }
  if (bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8) return false;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xda || marker === 0xd9) {
      return false;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return false;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return false;
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      return (
        length >= 7 &&
        allowed(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3))
      );
    }
    offset += length;
  }
  return false;
}
