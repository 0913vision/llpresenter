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
import {backgroundKey, plainPicture} from './powerpointBackground';
import {PowerPointParts} from './powerpointParts';
import {textColorOf} from './powerpointTextColor';

import type {
  PowerPointSlide,
  PowerPointShape,
} from '@core/songs/powerpointSlides';

/** A slide, with the picture in the file that all of its background is. */
export interface PowerPointDeckSlide extends PowerPointSlide {
  readonly picture?: string;
}

export interface PowerPointDeck {
  readonly slides: readonly PowerPointDeckSlide[];
  readonly widescreen: boolean;
  readonly width: number;
  readonly height: number;
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
function roleOf(shape: Element): PowerPointShape['role'] {
  const ph = descendants(shape, 'ph')[0];
  const type = ph?.getAttribute('type') ?? '';
  if (ph === undefined) return 'free';
  if (type === 'title' || type === 'ctrTitle') return 'title';
  return ['', 'body', 'obj'].includes(type) ? 'body' : 'free';
}

function shapes(tree: Element): PowerPointShape[] {
  return children(tree).flatMap(shape => {
    if (shape.localName === 'grpSp') return shapes(shape);
    if (shape.localName !== 'sp') return [];
    const text = lines(shape);
    return text.length === 0 ? [] : [{role: roleOf(shape), lines: text}];
  });
}

export function isPowerPointWidescreen(width: number, height: number): boolean {
  return Math.abs(width * 9 - height * 16) * 100 <= height * 16;
}

function slideSize(zip: PowerPointZip) {
  const presentation = xml(zip, 'ppt/presentation.xml');
  const size = descendants(presentation, 'sldSz')[0];
  const width = Number(size?.getAttribute('cx'));
  const height = Number(size?.getAttribute('cy'));
  if (!(width > 0 && height > 0)) {
    throw new Error('Invalid PowerPoint slide size');
  }
  return {width, height, widescreen: isPowerPointWidescreen(width, height)};
}

/** Reads only the presentation size before picture export. */
export function readPowerPointSize(bytes: Buffer) {
  return slideSize(new PowerPointZip(bytes));
}

/** Reads Office XML as data; embedded macros and non-slide content are ignored. */
export function readPowerPoint(bytes: Buffer): PowerPointDeck {
  const zip = new PowerPointZip(bytes);
  const part = 'ppt/presentation.xml';
  const presentation = xml(zip, part);
  const rels = relationships(zip, part);
  const {width, height, widescreen} = slideSize(zip);
  const ids = descendants(
    descendants(presentation, 'sldIdLst')[0] ?? presentation,
    'sldId',
  );
  if (ids.length > POWERPOINT_IMPORT_LIMITS.slides) {
    throw new Error('Too many PowerPoint slides');
  }
  let characters = 0;
  let lineCount = 0;
  const slides: PowerPointDeckSlide[] = [];
  const parts = new PowerPointParts(zip);
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
    const own = parts.slide(slidePath);
    const picture = plainPicture(own, {width, height});
    slides.push({
      number: index + 1,
      textColor: textColorOf(own),
      shapes: slideShapes,
      background: backgroundKey(own),
      ...(picture === undefined ? {} : {picture}),
    });
  }
  return {slides, widescreen, width, height};
}
