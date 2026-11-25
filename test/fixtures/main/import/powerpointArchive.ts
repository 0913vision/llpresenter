/** Builds small PowerPoint files in memory for the readers' tests. */

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
/** A ZIP archive of `parts`, stored without compression. */
export function archive(parts: Record<string, string>): Buffer {
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
/** The XML namespaces a slide part declares. */
export const ns = 'xmlns:p="urn:p" xmlns:a="urn:a" xmlns:r="urn:r"';
/** A relationships part with `items`. */
export function rels(items: string) {
  return `<Relationships>${items}</Relationships>`;
}
/** One relationship of a part. */
export function rel(id: string, target: string, type = 'image') {
  return `<Relationship Id="${id}" Target="${target}" Type="urn:rel/${type}"/>`;
}
/** A text shape, a placeholder when `ph` is given. */
export function shape(text: string, ph = '') {
  return `<p:sp><p:nvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
}
/** A slide part with its shapes, and what comes before them. */
export function slide(content: string, extra = '', attrs = '') {
  return `<p:sld ${ns} ${attrs}><p:cSld>${extra}<p:spTree>${content}</p:spTree></p:cSld></p:sld>`;
}
