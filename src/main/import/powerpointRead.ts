import {posix} from 'node:path';
import {DOMParser} from '@xmldom/xmldom';
import {
  POWERPOINT_IMPORT_LIMITS,
  TEXT_IMPORT_LIMITS,
} from '@core/songs/textImportLimits';
import {PowerPointZip} from './powerpointZip';

import type {
  PowerPointSlide,
  PowerPointShape,
} from '@core/songs/powerpointSlides';
export interface PowerPointDeck {
  readonly slides: readonly PowerPointSlide[];
}

function children(node: Node): Element[] {
  return Array.from(node.childNodes).filter(
    (child): child is Element => child.nodeType === 1,
  );
}
function named(node: Node, name: string): Element[] {
  return children(node).filter(child => child.localName === name);
}
function descendants(node: Node, name: string): Element[] {
  return children(node).flatMap(child => [
    ...(child.localName === name ? [child] : []),
    ...descendants(child, name),
  ]);
}
function xml(zip: PowerPointZip, name: string): Document {
  const bytes = zip.read(name);
  if (bytes === undefined || bytes.length > POWERPOINT_IMPORT_LIMITS.xmlBytes) {
    throw new Error('Missing or oversized PowerPoint XML');
  }
  const content = bytes.toString('utf8');
  if (/<!DOCTYPE/i.test(content)) throw new Error('Invalid PowerPoint XML');
  const parser = new DOMParser({
    errorHandler: () => {
      throw new Error('Invalid PowerPoint XML');
    },
  });
  const doc = parser.parseFromString(content, 'application/xml');
  return doc;
}
function relationships(
  zip: PowerPointZip,
  part: string,
): Map<string, {target: string; type: string}> {
  const name = posix.join(
    posix.dirname(part),
    '_rels',
    `${posix.basename(part)}.rels`,
  );
  if (zip.read(name) === undefined) return new Map();
  return new Map(
    descendants(xml(zip, name), 'Relationship')
      .filter(e => e.getAttribute('TargetMode') !== 'External')
      .map(e => {
        const target = e.getAttribute('Target') ?? '';
        return [
          e.getAttribute('Id') ?? '',
          {
            target: posix.normalize(
              target.startsWith('/')
                ? target.slice(1)
                : posix.join(posix.dirname(part), target),
            ),
            type: e.getAttribute('Type') ?? '',
          },
        ];
      }),
  );
}
function lines(shape: Element): string[] {
  const tx = named(shape, 'txBody')[0];
  if (!tx) return [];
  const result: string[] = [];
  for (const paragraph of named(tx, 'p')) {
    let text = '';
    for (const part of children(paragraph)) {
      if (part.localName === 'br') text += '\n';
      else if (part.localName === 'r' || part.localName === 'fld') {
        text += named(part, 't')
          .map(t => t.textContent)
          .join('');
      }
    }
    result.push(
      ...text
        .split('\n')
        .map(line => line.trimEnd())
        .filter(line => line.length > 0),
    );
  }
  return result;
}
function shapes(tree: Element): PowerPointShape[] {
  return children(tree).flatMap(shape => {
    if (shape.localName === 'grpSp') return shapes(shape);
    if (shape.localName !== 'sp') return [];
    const text = lines(shape);
    if (text.length === 0) return [];
    const ph = descendants(shape, 'ph')[0];
    const type = ph?.getAttribute('type') ?? '';
    return [
      {
        body:
          ph !== undefined &&
          (type === '' || type === 'body' || type === 'obj'),
        lines: text,
      },
    ];
  });
}
function imageFromPart(
  zip: PowerPointZip,
  part: string,
  size: {readonly width: number; readonly height: number},
): string | null {
  const doc = xml(zip, part);
  const rels = relationships(zip, part);
  const resolve = (blip: Element | undefined): string | null => {
    const target = blip
      ? rels.get(blip.getAttribute('r:embed') ?? '')?.target
      : undefined;
    return target && /\.(png|jpe?g)$/i.test(target) ? target : null;
  };
  const bg = descendants(doc, 'bg')[0];
  const image = bg ? resolve(descendants(bg, 'blip')[0]) : null;
  if (image) return image;
  for (const pic of descendants(doc, 'pic')) {
    const xfrm = descendants(pic, 'xfrm')[0];
    const ext = xfrm ? named(xfrm, 'ext')[0] : undefined;
    const off = xfrm ? named(xfrm, 'off')[0] : undefined;
    const x = Number(off?.getAttribute('x') ?? 0);
    const y = Number(off?.getAttribute('y') ?? 0);
    const width = Number(ext?.getAttribute('cx') ?? 0);
    const height = Number(ext?.getAttribute('cy') ?? 0);
    const coveredWidth = Math.max(
      0,
      Math.min(size.width, x + width) - Math.max(0, x),
    );
    const coveredHeight = Math.max(
      0,
      Math.min(size.height, y + height) - Math.max(0, y),
    );
    if (ext && coveredWidth * coveredHeight >= size.width * size.height * 0.9) {
      const found = resolve(descendants(pic, 'blip')[0]);
      if (found) return found;
    }
  }
  return null;
}
function background(
  zip: PowerPointZip,
  part: string,
  size: {readonly width: number; readonly height: number},
): string | null {
  let current: string | undefined = part;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const found = imageFromPart(zip, current, size);
    if (found) return found;
    const next: {target: string; type: string} | undefined = [
      ...relationships(zip, current).values(),
    ].find(rel => /\/(slideLayout|slideMaster)$/.test(rel.type));
    current = next?.target;
  }
  return null;
}
/** Reads Office XML as data; embedded macros and non-slide content are ignored. */
export function readPowerPoint(bytes: Buffer): PowerPointDeck {
  const zip = new PowerPointZip(bytes);
  const part = 'ppt/presentation.xml';
  const presentation = xml(zip, part);
  const rels = relationships(zip, part);
  const size = descendants(presentation, 'sldSz')[0];
  const width = Number(size?.getAttribute('cx'));
  const height = Number(size?.getAttribute('cy'));
  if (!(width > 0 && height > 0)) {
    throw new Error('Invalid PowerPoint slide size');
  }
  const ids = descendants(
    descendants(presentation, 'sldIdLst')[0] ?? presentation,
    'sldId',
  );
  if (ids.length > POWERPOINT_IMPORT_LIMITS.slides) {
    throw new Error('Too many PowerPoint slides');
  }
  let characters = 0;
  let lineCount = 0;
  const slides: PowerPointSlide[] = [];
  for (const [index, id] of ids.entries()) {
    const slidePath = rels.get(id.getAttribute('r:id') ?? '')?.target;
    if (!slidePath) throw new Error('Missing PowerPoint slide');
    const slide = xml(zip, slidePath);
    if (slide.documentElement.getAttribute('show') === '0') continue;
    const tree = descendants(slide, 'spTree')[0];
    const slideShapes = tree ? shapes(tree) : [];
    for (const shape of slideShapes) {
      for (const line of shape.lines) {
        characters += line.length;
        lineCount++;
      }
    }
    if (
      characters > TEXT_IMPORT_LIMITS.characters ||
      lineCount > TEXT_IMPORT_LIMITS.lines
    ) {
      throw new Error('PowerPoint text exceeds its limit');
    }
    slides.push({
      number: index + 1,
      shapes: slideShapes,
      background: background(zip, slidePath, {width, height}),
    });
  }
  return {slides};
}
