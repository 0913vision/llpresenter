import type {Measure, SplitLayout} from '@core/bible/split/layout';

export const mockMeasure: Measure = (text, spec) => {
  const pieces = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(word => {
      const characters = Array.from(word);
      const parts: Array<{text: string; width: number}> = [];
      for (let i = 0; i < characters.length; i += spec.width) {
        const chunk = characters.slice(i, i + spec.width).join('');
        parts.push({text: chunk, width: Array.from(chunk).length});
      }
      return parts;
    });
  if (spec.marker) {
    pieces.push({
      text: spec.marker.trim(),
      width:
        (Array.from(spec.marker.trim()).length * spec.markerSize) / spec.size,
    });
  }
  const lines: string[] = [];
  const lineWidths: number[] = [];
  let line = '';
  let width = 0;
  for (const piece of pieces) {
    if (line && width + 1 + piece.width > spec.width) {
      lines.push(line);
      lineWidths.push(width);
      line = '';
      width = 0;
    }
    width += (line ? 1 : 0) + piece.width;
    line += (line ? ' ' : '') + piece.text;
  }
  if (line) {
    lines.push(line);
    lineWidths.push(width);
  }
  return {
    lines,
    lineWidths,
    maxWidth: spec.width,
    nLines: lines.length,
    fits:
      lines.length <= spec.maxLines &&
      lineWidths.every(value => value <= spec.width),
  };
};

export function mockSplitLayout(width = 18, maxLines = 2): SplitLayout {
  return {
    spec: {
      font: 'Mock font',
      size: 36,
      tracking: 0,
      markerTracking: 0,
      width,
      maxLines,
    },
    measure: mockMeasure,
  };
}

export const MOCK_LONG_VERSE =
  '작은 새가 노래하며 아침 해가 떠오르니 마을 사람들이 길을 열었다. 푸른 나무가 자라고 맑은 바람이 불어오니 아이들이 함께 웃었다.';
