import {
  POWERPOINT_IMPORT_LIMITS,
  TEXT_IMPORT_LIMITS,
} from '@core/songs/textImportLimits';
import {PowerPointZip} from './powerpointZip';
import {
  children,
  named,
  descendants,
  xml,
  relationships,
} from './powerpointXml';
import {PowerPointLayerReader} from './powerpointLayers';
import type {PowerPointScene} from '@core/songs/powerpointLayers';

import type {
  PowerPointSlide,
  PowerPointShape,
} from '@core/songs/powerpointSlides';
export interface PowerPointDeck {
  readonly slides: readonly PowerPointSlide[];
  readonly widescreen: boolean;
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
function shapes(
  tree: Element,
  format: (shape: Element) => PowerPointShape['lyricFormat'],
): PowerPointShape[] {
  return children(tree).flatMap(shape => {
    if (shape.localName === 'grpSp') return shapes(shape, format);
    if (shape.localName !== 'sp') return [];
    const text = lines(shape);
    if (text.length === 0) return [];
    const ph = descendants(shape, 'ph')[0];
    const type = ph?.getAttribute('type') ?? '';
    const lyricFormat = format(shape);
    return [
      {
        ...(lyricFormat === undefined ? {} : {lyricFormat}),
        body:
          ph !== undefined &&
          (type === '' || type === 'body' || type === 'obj'),
        lines: text,
      },
    ];
  });
}
export function isPowerPointWidescreen(width: number, height: number): boolean {
  return Math.abs(width * 9 - height * 16) * 100 <= height * 16;
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
  const widescreen = isPowerPointWidescreen(width, height);
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
  const layers = new PowerPointLayerReader(zip);
  for (const [index, id] of ids.entries()) {
    const slidePath = rels.get(id.getAttribute('r:id') ?? '')?.target;
    if (!slidePath) throw new Error('Missing PowerPoint slide');
    const slide = xml(zip, slidePath);
    if (slide.documentElement.getAttribute('show') === '0') continue;
    const tree = descendants(slide, 'spTree')[0];
    const slideShapes = tree
      ? shapes(tree, shape => layers.lyricFormat(slidePath, shape, width))
      : [];
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
    const drawing = widescreen ? layers.read(slidePath, {width, height}) : null;
    slides.push({
      number: index + 1,
      lyricColor: layers.lyricColor(slidePath),
      shapes: slideShapes,
      background: drawing && drawing.layers.length > 0 ? drawing.key : null,
    });
  }
  return {slides, widescreen};
}

/** Reads a selected original slide number into an on-demand canvas scene. */
export function readPowerPointScene(
  bytes: Buffer,
  number: number,
): PowerPointScene {
  const zip = new PowerPointZip(bytes);
  const part = 'ppt/presentation.xml';
  const presentation = xml(zip, part);
  const size = descendants(presentation, 'sldSz')[0];
  const width = Number(size?.getAttribute('cx'));
  const height = Number(size?.getAttribute('cy'));
  if (!(width > 0 && height > 0)) {
    throw new Error('Invalid PowerPoint slide size');
  }
  const id = descendants(presentation, 'sldId')[number - 1];
  const path =
    id && relationships(zip, part).get(id.getAttribute('r:id') ?? '')?.target;
  if (!path) throw new Error('PowerPoint slide is unavailable');
  return new PowerPointLayerReader(zip).scene(path, {width, height});
}
