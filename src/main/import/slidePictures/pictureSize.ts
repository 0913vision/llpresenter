import {POWERPOINT_PICTURE_LIMITS as LIMITS} from '@core/schema/songs/powerpointImport';

/** The width and height of a picture, in pixels. */
export interface PictureSize {
  readonly width: number;
  readonly height: number;
}

function allowed(width: number, height: number): PictureSize | null {
  return width > 0 &&
    height > 0 &&
    width <= LIMITS.side &&
    height <= LIMITS.side &&
    width * height <= LIMITS.pixels
    ? {width, height}
    : null;
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const JPEG_START = 0xffd8;
/** JPEG markers: the start of the image data and the end of the image. */
const JPEG_SCAN = 0xda;
const JPEG_END = 0xd9;

/** The size a picture says it has, unless Chromium could not decode it. */
export function pictureSizeOf(bytes: Buffer): PictureSize | null {
  if (bytes.length > LIMITS.bytes) return null;
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return pngSize(bytes);
  }
  if (bytes.length >= 4 && bytes.readUInt16BE(0) === JPEG_START) {
    return jpegSize(bytes);
  }
  return null;
}

/** The size in the header chunk that a PNG starts with. */
function pngSize(bytes: Buffer): PictureSize | null {
  return bytes.toString('ascii', 12, 16) === 'IHDR'
    ? allowed(bytes.readUInt32BE(16), bytes.readUInt32BE(20))
    : null;
}

/**
 * The size in a JPEG's frame header, found by walking its segments before the
 * image data starts.
 */
function jpegSize(bytes: Buffer): PictureSize | null {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === JPEG_SCAN || marker === JPEG_END) {
      return null;
    }
    if (standsAlone(marker)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if (isFrameHeader(marker)) {
      return length >= 7
        ? allowed(
            bytes.readUInt16BE(offset + 5),
            bytes.readUInt16BE(offset + 3),
          )
        : null;
    }
    offset += length;
  }
  return null;
}

/** A JPEG marker with no length after it: TEM and the restart markers. */
function standsAlone(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

/**
 * A JPEG start-of-frame marker, which holds the size: C0 to CF but for the
 * Huffman table (C4), the JPG extension (C8) and arithmetic coding (CC).
 */
function isFrameHeader(marker: number): boolean {
  return (
    marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
  );
}
