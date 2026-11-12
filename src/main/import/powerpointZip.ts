import {inflateRawSync} from 'node:zlib';
import {POWERPOINT_IMPORT_LIMITS as LIMITS} from '@core/songs/textImportLimits';

interface Entry {
  readonly flags: number;
  readonly method: number;
  readonly compressed: number;
  readonly inflated: number;
  readonly offset: number;
  readonly crc: number;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A bounded, read-only ZIP directory for the XML and images in an Office file. */
export class PowerPointZip {
  private readonly entries = new Map<string, Entry>();
  private readonly total: number = 0;

  constructor(private readonly bytes: Buffer) {
    if (bytes.length > LIMITS.bytes || bytes.length < 22) {
      throw new Error('Invalid PowerPoint archive');
    }
    let end = bytes.length - 22;
    const minimum = Math.max(0, bytes.length - 22 - 65535);
    while (end >= minimum && bytes.readUInt32LE(end) !== 0x06054b50) end--;
    if (
      end < minimum ||
      end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length
    ) {
      throw new Error('Invalid PowerPoint archive');
    }
    const count = bytes.readUInt16LE(end + 10);
    const size = bytes.readUInt32LE(end + 12);
    let position = bytes.readUInt32LE(end + 16);
    if (
      bytes.readUInt16LE(end + 4) !== 0 ||
      bytes.readUInt16LE(end + 6) !== 0 ||
      bytes.readUInt16LE(end + 8) !== count ||
      count > LIMITS.entries ||
      position + size !== end
    ) {
      throw new Error('Invalid PowerPoint directory');
    }
    for (let index = 0; index < count; index++) {
      if (position + 46 > end || bytes.readUInt32LE(position) !== 0x02014b50) {
        throw new Error('Invalid PowerPoint directory');
      }
      const flags = bytes.readUInt16LE(position + 8);
      const method = bytes.readUInt16LE(position + 10);
      const compressed = bytes.readUInt32LE(position + 20);
      const inflated = bytes.readUInt32LE(position + 24);
      const nameLength = bytes.readUInt16LE(position + 28);
      const next =
        position +
        46 +
        nameLength +
        bytes.readUInt16LE(position + 30) +
        bytes.readUInt16LE(position + 32);
      if (
        next > end ||
        (flags & 0x41) !== 0 ||
        (method !== 0 && method !== 8)
      ) {
        throw new Error('Unsupported PowerPoint archive');
      }
      const name = bytes.toString(
        'utf8',
        position + 46,
        position + 46 + nameLength,
      );
      if (this.entries.has(name)) {
        throw new Error('Duplicate PowerPoint archive entry');
      }
      this.total += inflated;
      if (
        this.total > LIMITS.inflatedBytes ||
        (/\.(xml|rels)$/i.test(name) && inflated > LIMITS.xmlBytes)
      ) {
        throw new Error('PowerPoint archive exceeds its size limit');
      }
      this.entries.set(name, {
        flags,
        method,
        compressed,
        inflated,
        crc: bytes.readUInt32LE(position + 16),
        offset: bytes.readUInt32LE(position + 42),
      });
      position = next;
    }
    if (position !== end) throw new Error('Invalid PowerPoint directory');
  }

  read(name: string, maximum = LIMITS.inflatedBytes): Buffer | undefined {
    const entry = this.entries.get(name);
    if (entry === undefined) return undefined;
    if (entry.inflated > maximum) return undefined;
    const {offset} = entry;
    if (
      offset + 30 > this.bytes.length ||
      this.bytes.readUInt32LE(offset) !== 0x04034b50 ||
      this.bytes.readUInt16LE(offset + 6) !== entry.flags ||
      this.bytes.readUInt16LE(offset + 8) !== entry.method
    ) {
      throw new Error('Invalid PowerPoint entry');
    }
    const start =
      offset +
      30 +
      this.bytes.readUInt16LE(offset + 26) +
      this.bytes.readUInt16LE(offset + 28);
    if (start + entry.compressed > this.bytes.length) {
      throw new Error('Invalid PowerPoint entry');
    }
    const compressed = this.bytes.subarray(start, start + entry.compressed);
    const result =
      entry.method === 0
        ? compressed
        : inflateRawSync(compressed, {
            maxOutputLength: Math.max(1, entry.inflated),
          });
    if (result.length !== entry.inflated || crc32(result) !== entry.crc) {
      throw new Error('Invalid PowerPoint entry size');
    }
    return result;
  }
}
