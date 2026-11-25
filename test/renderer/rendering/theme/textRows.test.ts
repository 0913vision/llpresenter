import {afterEach, describe, expect, it} from 'vitest';
import {CONT_MARKER, contSizeOf} from '@core/bible';
import type {ThemeTextStyle} from '@core/schema/screens/theme';
import {
  sizeRows,
  wrappedRows,
  writeRows,
  type RowsText,
} from '@renderer/rendering/theme/textRows';

const STYLE: ThemeTextStyle = {
  font: 'Invented Sans',
  weight: 700,
  size: 80,
  color: '#ffffff',
  lineHeight: 1.2,
  tracking: 2,
  align: 'center',
  vAlign: 'middle',
};

function rows(more: Partial<RowsText> = {}): RowsText {
  return {
    text: '',
    style: STYLE,
    width: 1600,
    wrap: 'normal',
    continued: false,
    ...more,
  };
}

function written(more: Partial<RowsText>): HTMLElement {
  const block = document.createElement('div');
  writeRows(block, rows(more));
  return block;
}

function texts(block: HTMLElement): Array<string | null> {
  return [...block.children].map(row => row.textContent);
}

describe('writeRows', () => {
  it('writes one row for each paragraph, and keeps an empty one as a row', () => {
    const block = written({text: '주 하나님\r\n\n지으신 모든 세계'});
    expect(texts(block)).toEqual(['주 하나님', ' ', '지으신 모든 세계']);
    expect(block.style.lineHeight).toBe('1.2');
    expect(block.style.fontWeight).toBe('700');
    expect(block.style.letterSpacing).toBe('2px');
    expect(block.dataset['wrap']).toBe('normal');
  });

  it('marks a text that goes on on the next slide after its last row, leaving that row empty', () => {
    const block = written({text: '태초에\n', continued: true});
    const last = block.lastElementChild;
    expect(texts(block)).toEqual(['태초에', CONT_MARKER]);
    expect(last?.querySelector('[data-continuation]')?.textContent).toBe(
      CONT_MARKER,
    );
  });

  it('sets the bullet of a bulleted text, and takes it away again', () => {
    const block = written({text: '광고\n', style: {...STYLE, bullets: true}});
    expect(block.style.getPropertyValue('--bullet-indent')).not.toBe('');
    writeRows(block, rows({text: '광고'}));
    expect(block.style.getPropertyValue('--bullet-indent')).toBe('');
  });

  it('spaces a short text by its own tracking, indented by the difference when centered', () => {
    const short = {...STYLE, short: {letters: 4, tracking: 10}};
    const amen = written({text: '아 멘', style: short});
    expect(amen.style.letterSpacing).toBe('10px');
    expect(amen.style.textIndent).toBe('8px');

    const left = written({text: '아멘', style: {...short, align: 'left'}});
    expect(left.style.textIndent).toBe('0px');

    const long = written({text: '할렐루야 아멘', style: short});
    expect(long.style.letterSpacing).toBe('2px');

    const named = written({
      text: '할렐루야',
      style: {
        ...STYLE,
        short: {letters: 2, tracking: 10, texts: {할렐루야: 5}},
      },
    });
    expect(named.style.letterSpacing).toBe('5px');
    expect(named.style.textIndent).toBe('0px');
  });
});

describe('sizeRows', () => {
  it('sizes the text and its continuation mark, and says whether rows may wrap', () => {
    const block = written({text: '태초에', continued: true});
    sizeRows(block, 72, true);
    expect(block.style.fontSize).toBe('72px');
    expect(block.dataset['keepRows']).toBe('true');
    const marker = block.querySelector<HTMLElement>('[data-continuation]');
    expect(marker?.style.fontSize).toBe(`${contSizeOf({size: 72})}px`);
  });
});

describe('wrappedRows', () => {
  const original = Object.getOwnPropertyDescriptor(
    Range.prototype,
    'getClientRects',
  );
  afterEach(() => {
    if (original === undefined) {
      Reflect.deleteProperty(Range.prototype, 'getClientRects');
    } else Object.defineProperty(Range.prototype, 'getClientRects', original);
  });

  /** Lays letters out `perRow` to a row, 100 px apart; spaces take no room at a row's end. */
  function layOut(perRow: number): void {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value(this: Range) {
        const at = this.startOffset;
        const top = Math.floor(at / perRow) * 100;
        return [{top, bottom: top + 90, width: 40, height: 90}];
      },
    });
  }

  it('reads the rows a paragraph wrapped into, without the spaces at their ends', () => {
    layOut(5);
    const block = written({text: '만복의 근원 하나님\n찬송'});
    expect(wrappedRows(block)).toEqual(['만복의 근', '원 하나님', '찬송']);
  });
});
