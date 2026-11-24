import {
  CONT_MARKER,
  type Measure,
  type SplitLayout,
  type SplitSpec,
} from '@core/bible';
import type {ThemeFile, ThemeTextElement} from '@core/schema/screens/theme';
import {templateTokens} from '@core/theme';
import {fontFamilyFor} from '../fontFamily';

type TextWidth = (text: string, size: number) => number;

/** Measures the width of a text in a font, as a canvas does. */
export interface FontMeasure {
  font: string;
  measureText(text: string): {readonly width: number};
}

/** A canvas that measures texts; null where the page has no 2D canvas. */
export function createFontMeasure(): FontMeasure | null {
  return document.createElement('canvas').getContext('2d');
}

/** Text widths already measured, by font and text; a loaded font clears them. */
const widths = new Map<string, number>();
const WIDTHS_KEPT = 20_000;
let followingFonts = false;

function rememberWidth(key: string, width: number): void {
  if (!followingFonts && typeof document.fonts !== 'undefined') {
    followingFonts = true;
    document.fonts.addEventListener('loadingdone', () => widths.clear());
  }
  if (widths.size >= WIDTHS_KEPT) widths.clear();
  widths.set(key, width);
}

/** Wraps shaped text with the output's keep-all rule, counting the smaller marker. */
export function measureSplitLines(
  text: string,
  spec: Parameters<Measure>[1],
  widthOf: TextWidth,
) {
  const lines: string[] = [];
  const lineWidths: number[] = [];
  let line = '';
  const width = (value: string): number =>
    widthOf(value, spec.size) +
    Math.max(0, Array.from(value).length - 1) * spec.tracking;
  const flush = (): void => {
    if (line !== '') {
      lines.push(line);
      lineWidths.push(width(line));
      line = '';
    }
  };
  const add = (word: string): void => {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (width(candidate) <= spec.width) {
      line = candidate;
      return;
    }
    flush();
    if (width(word) <= spec.width) {
      line = word;
      return;
    }
    for (const character of word) {
      if (line !== '' && width(line + character) > spec.width) flush();
      line += character;
    }
  };
  for (const typed of text.trim().split('\n')) {
    flush();
    for (const word of typed.split(/\s+/).filter(Boolean)) add(word);
  }
  const marker = spec.marker.trimStart();
  if (marker !== '') {
    const markerWidth =
      widthOf(marker, spec.markerSize) +
      Math.max(0, Array.from(marker).length - 1) * spec.markerTracking;
    const gap =
      line === ''
        ? 0
        : spec.tracking + widthOf(' ', spec.markerSize) + spec.markerTracking;
    if (line !== '' && width(line) + gap + markerWidth > spec.width) flush();
    const total = (line === '' ? 0 : width(line) + gap) + markerWidth;
    lines.push(line === '' ? marker : line + CONT_MARKER);
    lineWidths.push(total);
    line = '';
  }
  flush();
  return {
    lines,
    lineWidths,
    maxWidth: spec.width,
    nLines: lines.length,
    fits:
      lines.length <= spec.maxLines &&
      lineWidths.every(value => value <= spec.width + 1e-6),
  };
}

/** The element of 청중 that shows a box of a theme. */
export function elementOfBox(
  theme: ThemeFile,
  box: string,
): ThemeTextElement | undefined {
  const {audience} = theme.screens;
  return audience.mode !== 'own'
    ? undefined
    : audience.elements.find(
        (element): element is ThemeTextElement =>
          element.kind === 'text' && templateTokens(element.content).has(box),
      );
}

/** How much text the box of a theme holds at its own size. */
export function splitLayoutOf(
  {frame, style}: ThemeTextElement,
  context: FontMeasure,
): SplitLayout {
  const spec: SplitSpec = {
    font: style.font,
    size: style.size,
    tracking: style.tracking,
    markerTracking: style.tracking,
    width: frame.w,
    maxLines: Math.floor((frame.h + 1) / (style.size * style.lineHeight)),
  };
  const family = fontFamilyFor(style.font);
  const widthOf: TextWidth = (value, size) => {
    const font = `${style.weight} ${size}px ${family}`;
    const key = `${font}|${value}`;
    const known = widths.get(key);
    if (known !== undefined) return known;
    // NOTE(0913vision): Setting the font costs as much as measuring, and the
    // wrap tries the same lines again and again, so each is measured once.
    if (context.font !== font) context.font = font;
    const width = context.measureText(value).width;
    rememberWidth(key, width);
    return width;
  };
  return {
    spec,
    measure: (value, options) => measureSplitLines(value, options, widthOf),
  };
}
