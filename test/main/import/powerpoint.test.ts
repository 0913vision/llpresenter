import {deflateRawSync} from 'node:zlib';
import {describe, expect, it} from 'vitest';
import {PowerPointZip} from '@main/import/powerpointZip';
import {powerpointSlides} from '@core/songs/powerpointSlides';

function crc(bytes: Buffer): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) {
      value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}
function zip(name: string, data: Buffer): Buffer {
  const fileName = Buffer.from(name);
  const packed = deflateRawSync(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc(data), 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(fileName.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50);
  directory.writeUInt16LE(8, 10);
  directory.writeUInt32LE(crc(data), 16);
  directory.writeUInt32LE(packed.length, 20);
  directory.writeUInt32LE(data.length, 24);
  directory.writeUInt16LE(fileName.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directory.length + fileName.length, 12);
  end.writeUInt32LE(local.length + fileName.length + packed.length, 16);
  return Buffer.concat([local, fileName, packed, directory, fileName, end]);
}
describe('PowerPoint ZIP', () => {
  it('reads a compressed entry and detects corruption', () => {
    const bytes = zip('ppt/a.xml', Buffer.from('<a/>'));
    expect(new PowerPointZip(bytes).read('ppt/a.xml')?.toString()).toBe('<a/>');
    bytes[30 + 'ppt/a.xml'.length] = (bytes[30 + 'ppt/a.xml'.length] ?? 0) ^ 1;
    expect(() => new PowerPointZip(bytes).read('ppt/a.xml')).toThrow();
  });
  it('refuses oversized XML before inflating it', () => {
    const bytes = zip('ppt/a.xml', Buffer.alloc(16 * 1024 * 1024 + 1));
    expect(() => new PowerPointZip(bytes)).toThrow();
  });
  it('stops inflation when the directory understates the output size', () => {
    const bytes = zip('ppt/a.xml', Buffer.alloc(4096, 65));
    const directory = bytes.readUInt32LE(bytes.length - 6);
    bytes.writeUInt32LE(8, directory + 24);
    expect(() => new PowerPointZip(bytes).read('ppt/a.xml')).toThrow();
  });
});
describe('PowerPoint range conversion', () => {
  it('keeps blanks, body text and closing titles', () => {
    const shape = (body: boolean, ...lines: string[]) => ({body, lines});
    const slides = [
      {
        number: 1,
        background: null,
        shapes: [shape(false, 'Title'), shape(false, 'Subtitle')],
      },
      {
        number: 2,
        background: null,
        shapes: [shape(false, 'Decoration'), shape(true, 'Lyric')],
      },
      {number: 3, background: null, shapes: []},
      {
        number: 4,
        background: null,
        shapes: [shape(false, 'Title'), shape(false, 'Subtitle')],
      },
    ];
    expect(powerpointSlides(slides)).toEqual([
      {titleSlide: true, lines: ['Title', 'Subtitle']},
      {lines: ['Lyric']},
      {lines: []},
      {titleSlide: true, lines: ['Title', 'Subtitle']},
    ]);
  });
});
