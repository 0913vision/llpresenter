import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {ThemeTextStyle} from '@core/schema/screens/theme';
import type {RowsText} from '@renderer/rendering/theme/textRows';

const STYLE: ThemeTextStyle = {
  font: 'Invented Sans',
  weight: 700,
  size: 50,
  color: '#ffffff',
  lineHeight: 1.2,
  tracking: 0,
  align: 'center',
  vAlign: 'middle',
};
/** One row of 50 px text at line height 1.2. */
const ROW = 60;

function text(value: string, width = 1600): RowsText {
  return {text: value, style: STYLE, width, wrap: 'normal', continued: false};
}

let layouts = 0;
const saved = {
  height: Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetHeight',
  ),
  width: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth'),
  context: Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    'getContext',
  ),
};

beforeEach(() => {
  vi.resetModules();
  layouts = 0;
  // NOTE(0913vision): jsdom lays nothing out: a text here takes one row for
  // every ten letters, ten pixels wide each.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      layouts++;
      return Math.ceil(this.textContent.length / 10) * ROW;
    },
  });
  Object.defineProperty(Element.prototype, 'scrollWidth', {
    configurable: true,
    get(this: Element) {
      return Math.min(10, this.textContent.length) * 10;
    },
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({
      font: '',
      measureText: () => ({
        actualBoundingBoxAscent: 40,
        actualBoundingBoxDescent: 10,
        fontBoundingBoxAscent: 45,
        fontBoundingBoxDescent: 15,
      }),
    }),
  });
});

afterEach(() => {
  for (const [target, name, descriptor] of [
    [HTMLElement.prototype, 'offsetHeight', saved.height],
    [Element.prototype, 'scrollWidth', saved.width],
    [HTMLCanvasElement.prototype, 'getContext', saved.context],
  ] as const) {
    if (descriptor === undefined) Reflect.deleteProperty(target, name);
    else Object.defineProperty(target, name, descriptor);
  }
});

async function measure() {
  return (await import('@renderer/rendering/theme/measureRows')).measuredText;
}

it('measures the rows a text takes at a size, and keeps the measure', async () => {
  const measuredText = await measure();
  const lyric = measuredText(text('만복의 근원 하나님 온 백성 찬송 드리고'));
  expect(lyric.at(50, false)).toEqual({rows: 3, height: 3 * ROW, width: 100});
  const before = layouts;
  lyric.at(50, false);
  expect(layouts).toBe(before);
  lyric.at(50, true);
  expect(layouts).toBe(before + 1);
});

it('measures again once the fonts of the window have loaded', async () => {
  const measuredText = await measure();
  const lyric = measuredText(text('주 하나님'));
  lyric.at(50, false);
  const before = layouts;
  document.fonts.dispatchEvent(new Event('loadingdone'));
  lyric.at(50, false);
  expect(layouts).toBe(before + 1);
});

it('sizes texts together by the tallest and the widest of them', async () => {
  const measuredText = await measure();
  const together = measuredText(text('짧은 줄'), [
    text('짧은 줄'),
    text('이 줄은 스무 글자보다 조금 더 긴 줄입니다'),
  ]).together;
  expect(together?.(50, false)).toEqual({height: 3 * ROW, width: 100});
  expect(measuredText(text('혼자')).together).toBeUndefined();
});

it('finds where the letters start above the first row and end below the last', async () => {
  const measuredText = await measure();
  // NOTE(0913vision): The baseline sits where the font's own box is centred in
  // a 60 px row: (60 - (45 + 15)) / 2 + 45 = 45.
  expect(measuredText(text('주 하나님')).ink?.(50)).toEqual({
    top: 45 - 40,
    bottom: 45 + 10,
  });
  expect(measuredText(text('주 하나님\n지으신')).ink?.(50)).toEqual({
    top: 5,
    bottom: ROW + 45 + 10,
  });
});

it('reads the rows a text wraps into at a size', async () => {
  const measuredText = await measure();
  expect(measuredText(text('1절\n주 하나님')).wrapped(50)).toEqual([
    '1절',
    '주 하나님',
  ]);
});
