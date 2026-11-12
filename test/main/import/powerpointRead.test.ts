import {describe, expect, it} from 'vitest';
import {
  isPowerPointWidescreen,
  readPowerPoint,
} from '@main/import/powerpointRead';
import {powerpointSlides} from '@core/songs/powerpointSlides';

function crc(bytes: Buffer): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}
function archive(parts: Record<string, string>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, value] of Object.entries(parts)) {
    const filename = Buffer.from(name);
    const data = Buffer.from(value);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50);
    head.writeUInt32LE(crc(data), 14);
    head.writeUInt32LE(data.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(filename.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50);
    dir.writeUInt32LE(crc(data), 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(filename.length, 28);
    dir.writeUInt32LE(offset, 42);
    local.push(head, filename, data);
    central.push(dir, filename);
    offset += head.length + filename.length + data.length;
  }
  const end = Buffer.alloc(22);
  const count = Object.keys(parts).length;
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(Buffer.concat(central).length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
const ns = 'xmlns:p="urn:p" xmlns:a="urn:a" xmlns:r="urn:r"';
const rels = (items: string) => `<Relationships>${items}</Relationships>`;
const rel = (id: string, target: string, type = 'image') =>
  `<Relationship Id="${id}" Target="${target}" Type="urn:rel/${type}"/>`;
const shape = (text: string, ph = '') =>
  `<p:sp><p:nvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
const slide = (content: string, extra = '', attrs = '') =>
  `<p:sld ${ns} ${attrs}><p:cSld>${extra}<p:spTree>${content}</p:spTree></p:cSld></p:sld>`;

describe('PowerPoint XML reader', () => {
  it('reads titles, grouped body, breaks, blanks, hidden slides and inherited backgrounds', () => {
    const title = shape('Title') + shape('Subtitle');
    const body = `<p:grpSp><p:sp><p:nvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>First &amp; line</a:t></a:r><a:br/><a:r><a:t>Second  </a:t></a:r></a:p></p:txBody></p:sp></p:grpSp>`;
    const ids = [1, 2, 3, 4, 5].map(n => `<p:sldId r:id="r${n}"/>`).join('');
    const parts: Record<string, string> = {
      'ppt/presentation.xml': `<p:presentation ${ns}><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="1600" cy="900"/></p:presentation>`,
      'ppt/_rels/presentation.xml.rels': rels(
        [1, 2, 3, 4, 5]
          .map(n => rel(`r${n}`, `slides/slide${n}.xml`, 'slide'))
          .join(''),
      ),
      'ppt/slides/slide1.xml': slide(
        title,
        '<p:bg><p:bgPr><a:blipFill><a:blip r:embed="bg"/></a:blipFill></p:bgPr></p:bg>',
      ),
      'ppt/slides/_rels/slide1.xml.rels': rels(rel('bg', '../media/bg.png')),
      'ppt/slides/slide2.xml': slide(shape('Decoration') + body),
      'ppt/slides/_rels/slide2.xml.rels': rels(
        rel('layout', '../slideLayouts/layout1.xml', 'slideLayout'),
      ),
      'ppt/slideLayouts/layout1.xml': `<p:sldLayout ${ns}><p:cSld><p:spTree><p:pic><p:blipFill><a:blip r:embed="pic"/></p:blipFill><p:spPr><a:xfrm><a:ext cx="100" cy="100"/></a:xfrm></p:spPr></p:pic></p:spTree></p:cSld></p:sldLayout>`,
      'ppt/slideLayouts/_rels/layout1.xml.rels': rels(
        rel('pic', '../media/layout.jpg'),
      ),
      'ppt/slides/slide3.xml': slide(''),
      'ppt/slides/slide4.xml': slide(title),
      'ppt/slides/slide5.xml': slide(shape('Hidden'), '', 'show="0"'),
    };
    const deck = readPowerPoint(archive(parts));
    expect(deck.slides.map(s => s.number)).toEqual([1, 2, 3, 4]);
    expect(deck.slides.map(s => s.background)).toEqual([
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      null,
      null,
    ]);
    expect(powerpointSlides(deck.slides)).toEqual([
      {titleSlide: true, lines: ['Title', 'Subtitle']},
      {lines: ['First & line', 'Second']},
      {lines: []},
      {titleSlide: true, lines: ['Title', 'Subtitle']},
    ]);
  });
});

it.each([
  [1600, 900, true],
  [4, 3, false],
  [16, 10, false],
  [12192000, 6858000, true],
  [1617, 900, false],
])('checks slide ratio %i by %i', (width, height, expected) => {
  expect(isPowerPointWidescreen(width, height)).toBe(expected);
});
