import {
  CONT_MARKER,
  type Measure,
  type SplitLayout,
  type SplitSpec,
} from '@core/bible/split/layout';
import type {ThemeElement} from '@core/schema/themes';
import {fontFamilyFor} from './slideLayer';

export type BibleTextElement = Extract<ThemeElement, {kind: 'currentText'}>;
type TextWidth = (text: string, size: number) => number;
export interface BibleFontMeasure {
  font: string;
  measureText(text: string): {readonly width: number};
}

export function createBibleMeasureContext(): BibleFontMeasure | null {
  return document.createElement('canvas').getContext('2d');
}

/** Wraps shaped text with the output's keep-all rule, counting the smaller marker. */
export function measureBibleLines(
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
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (width(candidate) <= spec.width) {
      line = candidate;
      continue;
    }
    flush();
    if (width(word) <= spec.width) {
      line = word;
      continue;
    }
    for (const character of word) {
      if (line !== '' && width(line + character) > spec.width) flush();
      line += character;
    }
  }
  const marker = spec.marker.trimStart();
  if (marker !== '') {
    const markerWidth =
      widthOf(marker, spec.markerSize) +
      Math.max(0, Array.from(marker).length - 1) * spec.markerTracking;
    const gap =
      line === '' ? 0 : widthOf(' ', spec.markerSize) + spec.markerTracking;
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

/** Uses the currentText element's actual CSS font and fixed line-height budget. */
export function bibleMeasure(
  element: BibleTextElement,
  context: BibleFontMeasure,
): SplitLayout {
  const {text, frame} = element;
  const spec: SplitSpec = {
    font: text.font,
    size: text.size,
    tracking: text.tracking ?? 0,
    markerTracking: text.tracking ?? 0,
    width: frame.w,
    maxLines: Math.min(
      text.maxLines,
      Math.floor((frame.h + 1) / (text.size * text.lineHeight)),
    ),
  };
  const widthOf: TextWidth = (value, size) => {
    context.font = `${text.weight} ${size}px ${fontFamilyFor(text.font)}`;
    return context.measureText(value).width;
  };
  return {
    spec,
    measure: (value, options) => measureBibleLines(value, options, widthOf),
  };
}
