import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {SlideLayer} from '@core/live/state';
import {classes} from '@renderer/rendering/classes';
import {DEFAULT_TEXT_STYLE, scaleFor} from '@core/themes/textStyle';
import {
  SlideLayerView,
  fontFamilyFor,
  unshiftTextBounds,
} from '@renderer/rendering/slideLayer';
import {SLIDE_DISSOLVE_MS} from '@renderer/rendering/slideLayer';
import bulletStyles from '@renderer/rendering/bulletText.module.css';

const VERSE: SlideLayer = {
  itemId: 'hymn-1',
  position: 0,
  label: '1절',
  lines: ['만복의 근원 하나님', '온 백성 찬송 드리고'],
};

function setUp() {
  const parent = document.createElement('div');
  const view = new SlideLayerView(parent, DEFAULT_TEXT_STYLE);
  const pages = (): HTMLElement[] => [
    ...parent.querySelectorAll<HTMLElement>(`.${classes.page}`),
  ];
  const shownPage = (): HTMLElement | undefined =>
    pages().find(page => page.classList.contains(classes.shown));
  const shownLines = (): string[] =>
    [...(shownPage()?.querySelectorAll(`.${classes.block} > div`) ?? [])].map(
      row => row.textContent,
    );
  return {parent, view, pages, shownPage, shownLines};
}

afterEach(() => vi.restoreAllMocks());

describe('SlideLayerView', () => {
  it('enforces and rescales the configured minimum text size when content overflows', () => {
    const width = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(200);
    const height = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockReturnValue(100);
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(1000);
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(1000);
    try {
      const {view, shownPage} = setUp();
      view.setMinimumSize(48);
      view.show(VERSE, false);
      expect(
        shownPage()?.querySelector<HTMLElement>(`.${classes.block}`)?.style
          .fontSize,
      ).toBe('48px');
      view.rescale(2);
      expect(
        shownPage()?.querySelector<HTMLElement>(`.${classes.block}`)?.style
          .fontSize,
      ).toBe('96px');
      view.dispose();
    } finally {
      width.mockRestore();
      height.mockRestore();
      scrollWidth.mockRestore();
      scrollHeight.mockRestore();
    }
  });
  it('keeps song source lines whole until the readable minimum requires wrapping', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500);
    const width = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return (Number.parseFloat(this.style.fontSize) || 0) * 2.5;
      });
    const height = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(100);
    try {
      const {view, shownPage} = setUp();
      view.setLineMode('song');
      view.show(VERSE, false);
      const block = shownPage()?.querySelector<HTMLElement>(
        `.${classes.block}`,
      );
      expect(block?.style.whiteSpace).toBe('pre');
      expect(Number.parseFloat(block?.style.fontSize ?? '')).toBe(80);
      width.mockImplementation(function (this: HTMLElement) {
        return (Number.parseFloat(this.style.fontSize) || 0) * 10;
      });
      view.show(
        {...VERSE, itemId: 'long-line', lines: ['A much longer line']},
        false,
      );
      expect(
        shownPage()?.querySelector<HTMLElement>(`.${classes.block}`)?.style,
      ).toMatchObject({fontSize: '72px', whiteSpace: ''});
      view.setLineMode('bar');
      expect(
        shownPage()?.querySelector<HTMLElement>(`.${classes.block}`)?.style,
      ).toMatchObject({fontSize: '20px', whiteSpace: 'pre'});
      view.dispose();
    } finally {
      height.mockRestore();
    }
  });

  it('fits the church lyric uniformly before allowing Korean word-boundary wrapping', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1656);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(411);
    const width = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return (Number.parseFloat(this.style.fontSize) || 0) * 17;
      });
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(274);
    const parent = document.createElement('div');
    const view = new SlideLayerView(parent, {...DEFAULT_TEXT_STYLE, size: 108});
    view.setLineMode('lyrics');
    view.show(
      {
        ...VERSE,
        lines: [
          '\uadf8\ub9ac\uc2a4\ub3c4 \uc548\uc5d0\uc11c \uc740\ud61c\uc758 \ud48d\uc131\ud558\uc2ec\uc744 \ub530\ub77c',
          '\uadf8 \ubd84\uc758 \ud53c\ub85c \uc8c4\uc0ac\ud568 \uc5bb\uc2b5\ub2c8\ub2e4',
        ],
      },
      false,
    );
    const shown = () =>
      parent.querySelector<HTMLElement>(`.${classes.shown} .${classes.block}`);
    expect(shown()?.style.whiteSpace).toBe('pre');
    expect(shown()?.style.fontSize).toBe('97px');
    expect(shown()?.children).toHaveLength(2);
    width.mockImplementation(function (this: HTMLElement) {
      return (Number.parseFloat(this.style.fontSize) || 0) * 30;
    });
    view.show(
      {
        ...VERSE,
        itemId: 'longer',
        lines: ['\uadf8 \ubd84\uc758 \ud558\ub098 \ub098 \ub2e4\ub978 \ub9d0'],
      },
      false,
    );
    expect(shown()?.style).toMatchObject({
      fontSize: '76px',
      wordBreak: 'keep-all',
      overflowWrap: 'normal',
    });
    expect(shown()?.textContent).toContain('\uadf8\u00a0\ubd84\uc758');
    expect(shown()?.textContent).toContain('\ud558\ub098\u00a0\ub098');
    view.setLineMode('normal');
    expect(shown()?.style.overflowWrap).toBe('');
    expect(shown()?.textContent).toBe(
      '\uadf8 \ubd84\uc758 \ud558\ub098 \ub098 \ub2e4\ub978 \ub9d0',
    );
    view.dispose();
  });

  it('maps the imported Korean NanumSquare family to the installed family', () => {
    expect(fontFamilyFor('\ub098\ub214\uc2a4\ud018\uc5b4 ExtraBold')).toContain(
      '"NanumSquare"',
    );
    expect(fontFamilyFor('\ub098\ub214\uc2a4\ud018\uc5b4 Bold')).toContain(
      '"NanumSquare"',
    );
  });

  it('renders imported run typography and drops it when the authored text changes', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1656);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(411);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100);
    const {view, shownPage} = setUp();
    view.setLineMode('lyrics');
    const lyricFormat = {
      lines: [
        {
          boxWidth: 1500,
          paragraphGap: 20,
          spacing: {kind: 'pixels' as const, value: 130},
          runs: [
            {text: 'One ', size: 72, tracking: -3, font: 'Arial'},
            {text: 'two', size: 90, tracking: 1},
          ],
        },
      ],
    };
    view.show({...VERSE, lines: ['One two'], lyricFormat}, false);
    const block = () =>
      shownPage()?.querySelector<HTMLElement>(`.${classes.block}`);
    const row = block()?.firstElementChild;
    const runs = row?.querySelectorAll<HTMLElement>('span');
    expect(runs?.[0]?.style).toMatchObject({
      fontSize: '72px',
      letterSpacing: '-3px',
    });
    expect(runs?.[1]?.style).toMatchObject({
      fontSize: '90px',
      letterSpacing: '1px',
    });
    if (!(row instanceof HTMLElement)) throw Error('Missing row');
    expect(row.style.lineHeight).toBe('130px');
    expect(row.style.marginTop).toBe('20px');
    view.show(
      {
        ...VERSE,
        position: 3,
        lines: ['First', 'Second'],
        lyricFormat: {
          lines: [
            {
              boxWidth: 1920,
              spacing: {kind: 'ratio', value: 1.08},
              runs: [{text: 'First', size: 108}],
            },
            {
              boxWidth: 1920,
              spacing: {kind: 'ratio', value: 1.08},
              paragraphGap: 20,
              runs: [{text: 'Second', size: 108}],
            },
          ],
        },
      },
      false,
    );
    const rowsWithGap = block()?.children;
    const firstRow = rowsWithGap?.[0];
    const secondRow = rowsWithGap?.[1];
    if (
      !(firstRow instanceof HTMLElement) ||
      !(secondRow instanceof HTMLElement)
    ) {
      throw Error('Missing formatted rows');
    }
    expect(firstRow.style.lineHeight).toBe('1.08');
    expect(firstRow.style.fontSize).toBe('108px');
    expect(secondRow.style.marginTop).toBe('20px');
    view.show({...VERSE, position: 1, lines: ['Edited'], lyricFormat}, false);
    expect(block()?.textContent).toBe('Edited');
    expect(block()?.querySelector('span')).toBeNull();
    const firstLine = lyricFormat.lines[0];
    if (firstLine === undefined) throw Error('Missing formatting');
    const mixed = {
      lines: [firstLine, {boxWidth: 1500, runs: [{text: 'Keep', size: 77}]}],
    };
    view.show(
      {...VERSE, position: 2, lines: ['Edited', 'Keep'], lyricFormat: mixed},
      false,
    );
    const rows = block()?.children;
    expect(rows?.[0]?.querySelector('span')).toBeNull();
    expect(rows?.[1]?.querySelector<HTMLElement>('span')?.style.fontSize).toBe(
      '77px',
    );
    view.dispose();
  });

  it('uses the same fitted size for both next preview lines', () => {
    const {view, shownPage} = setUp();
    view.show({...VERSE, lines: ['A long section name', 'Short']}, false);
    const block = shownPage()?.querySelector<HTMLElement>(`.${classes.block}`);
    const rows = block?.querySelectorAll<HTMLElement>(':scope > div');
    expect(rows).toHaveLength(2);
    expect([...(rows ?? [])].every(row => row.style.fontSize === '')).toBe(
      true,
    );
    expect(block?.style.fontSize).not.toBe('');
    view.dispose();
  });

  it('fits toward a changing target above and below the saved text size', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
      1000,
    );
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100);
    const {view, shownPage} = setUp();
    view.show(VERSE, false);
    const block = shownPage()?.querySelector<HTMLElement>(`.${classes.block}`);
    view.setTargetSize(120);
    expect(block?.style.fontSize).toBe('120px');
    view.setTargetSize(60);
    expect(block?.style.fontSize).toBe('60px');
    view.setMinimumSize(48);
    view.setTargetSize(30);
    expect(block?.style.fontSize).toBe('48px');
    view.dispose();
  });

  it('changes a retained bulleted page to discs and restores the existing glyph layout', () => {
    const {view, shownPage} = setUp();
    const style = {...DEFAULT_TEXT_STYLE, bullets: true};
    view.setStyle(style);
    view.show(VERSE, false);
    const page = shownPage();
    const block = page?.querySelector<HTMLElement>(`.${classes.block}`);
    view.setStyle({...style, bulletStyle: 'disc'});
    expect(shownPage()).toBe(page);
    expect(block?.style.getPropertyValue('--bullet-indent')).toBe(
      `${107 / 86}em`,
    );
    expect(block?.style.getPropertyValue('--bullet-gap')).toBe('0em');
    expect(block?.style.getPropertyValue('--bullet-disc-content')).toBe('""');
    expect(block?.style.getPropertyValue('--bullet-wrap')).toBe('normal');
    view.setStyle(style);
    expect(block?.style.getPropertyValue('--bullet-indent')).toBe(
      `${90 / 86}em`,
    );
    expect(block?.style.getPropertyValue('--bullet-disc-content')).toBe('none');
    expect(block?.style.getPropertyValue('--bullet-visibility')).toBe(
      'visible',
    );
    view.dispose();
  });
  it('keeps two pages through effect changes and stops motion for an unchanged standby frame', () => {
    const {view, pages, parent} = setUp();
    const cancel = vi.fn();
    const animate = vi.fn(() => ({cancel}));
    for (const page of pages()) {
      Object.defineProperty(page, 'animate', {value: animate});
    }
    view.setTransition({kind: 'none', sec: 0.5});
    view.show(VERSE);
    view.setTransition({kind: 'push', dir: 'right', sec: 4});
    const incoming = {...VERSE, position: 1, lines: ['Next page']};
    view.show(incoming);
    expect(animate).toHaveBeenCalledTimes(2);
    view.setTransition({kind: 'wipe', dir: 'up', sec: 1});
    expect(cancel).not.toHaveBeenCalled();
    expect(pages()).toHaveLength(2);
    view.show(incoming, false);
    expect(cancel).toHaveBeenCalledTimes(2);
    view.show(null);
    expect(pages().every(page => page.style.opacity === '0')).toBe(true);
    view.dispose();
    expect(parent.children).toHaveLength(0);
  });
  it('adds hanging bullets to logical paragraphs, keeps empty lines blank, and updates a retained page when toggled', () => {
    const {view, shownPage} = setUp();
    view.show({...VERSE, lines: ['One\nTwo', '', 'Last']}, false);
    const shown = shownPage();
    view.setStyle({...DEFAULT_TEXT_STYLE, bullets: true});
    const block = shown?.querySelector(`.${classes.block}`);
    expect(block?.children).toHaveLength(4);
    expect(
      [...(block?.querySelectorAll(`.${bulletStyles.marker}`) ?? [])].map(
        node => node.textContent,
      ),
    ).toEqual(['•', '•', '•']);
    expect(block?.children[2]?.textContent).toBe('\u00a0');
    expect(
      [...(block?.children ?? [])].every(row =>
        row.classList.contains(bulletStyles.paragraph ?? ''),
      ),
    ).toBe(true);
    view.replaceLines(['Replacement']);
    expect(shownPage()).toBe(shown);
    expect(block?.children).toHaveLength(1);
    view.setStyle(DEFAULT_TEXT_STYLE);
    expect(block?.textContent).toBe('Replacement');
    expect(block?.querySelectorAll(`.${bulletStyles.marker}`)).toHaveLength(0);
    view.dispose();
  });
  it('scales letter spacing with the output and applies tracking-only edits to retained pages', () => {
    const {view, pages, shownPage} = setUp();
    view.show(VERSE);
    const shown = shownPage();
    view.setStyle({...DEFAULT_TEXT_STYLE, tracking: -3});
    view.rescale(0.5);
    for (const page of pages()) {
      expect(
        page.querySelector<HTMLElement>(`.${classes.block}`)?.style
          .letterSpacing,
      ).toBe('-1.5px');
    }
    view.setStyle({...DEFAULT_TEXT_STYLE, tracking: 6});
    expect(shownPage()).toBe(shown);
    expect(
      shown?.querySelector<HTMLElement>(`.${classes.block}`)?.style
        .letterSpacing,
    ).toBe('3px');
    view.setStyle(DEFAULT_TEXT_STYLE);
    expect(
      shown?.querySelector<HTMLElement>(`.${classes.block}`)?.style
        .letterSpacing,
    ).toBe('0px');
    view.dispose();
  });
  it('keeps split preview text at its configured size and marks only excess lines', () => {
    const parent = document.createElement('div');
    const view = new SlideLayerView(parent, DEFAULT_TEXT_STYLE, 2);
    view.show({
      ...VERSE,
      continued: true,
      lines: ['One', 'Two', 'Three (계속)'],
    });
    const page = parent.querySelector<HTMLElement>(`.${classes.shown}`);
    const block = page?.querySelector<HTMLElement>(`.${classes.block}`);
    expect(block?.style.fontSize).toBe('84px');
    expect(page?.style.justifyContent).toBe('flex-start');
    expect(block?.querySelectorAll(`.${classes.bibleOverflow}`)).toHaveLength(
      1,
    );
    expect(block?.querySelector(`.${classes.bibleOverflow}`)?.textContent).toBe(
      'Three (계속)',
    );
    expect(
      block?.querySelector<HTMLElement>('[data-bible-continuation]')?.style
        .fontSize,
    ).toBe('72px');
    view.show({...VERSE, lines: ['One']});
    const next = parent.querySelector<HTMLElement>(`.${classes.shown}`);
    expect(next?.style.justifyContent).toBe('center');
    expect(next?.querySelectorAll(`.${classes.bibleOverflow}`)).toHaveLength(0);
    view.dispose();
  });
  it('draws detailed outline and shadow at screen scale and updates without a dissolve', () => {
    const {parent, view, shownPage} = setUp();
    view.show(VERSE);
    const page = shownPage();
    const style = {
      ...DEFAULT_TEXT_STYLE,
      outline: {on: true, width: 3, color: '#123456'},
      shadow: {
        on: true,
        blur: 8,
        distance: 8,
        angle: 90,
        opacity: 35,
        color: '#ABCDEF',
      },
    };
    view.rescale(0.5);
    view.setStyle(style);
    const element = parent.firstElementChild;
    if (!(element instanceof HTMLElement)) throw new Error('Missing layer');
    expect(shownPage()).toBe(page);
    expect(element.classList.contains(classes.instant)).toBe(true);
    expect(element.classList.contains(classes.outline)).toBe(true);
    expect(element.classList.contains(classes.shadow)).toBe(true);
    expect(element.style.getPropertyValue('--lyric-outline-width')).toBe(
      '1.5px',
    );
    expect(element.style.getPropertyValue('--lyric-outline-color')).toBe(
      '#123456',
    );
    expect(
      Number.parseFloat(element.style.getPropertyValue('--lyric-shadow-x')),
    ).toBeCloseTo(0);
    expect(
      Number.parseFloat(element.style.getPropertyValue('--lyric-shadow-y')),
    ).toBeCloseTo(4);
    expect(element.style.getPropertyValue('--lyric-shadow-blur')).toBe('4px');
    expect(element.style.getPropertyValue('--lyric-shadow-strength')).toBe(
      '35%',
    );
    expect(element.style.getPropertyValue('--lyric-shadow-color')).toBe(
      '#ABCDEF',
    );
    view.setStyle({
      ...style,
      outline: {...style.outline, on: false},
      shadow: {...style.shadow, on: false},
    });
    expect(element.classList.contains(classes.outline)).toBe(false);
    expect(element.classList.contains(classes.shadow)).toBe(false);
    view.rescale(2);
    expect(element.style.getPropertyValue('--lyric-outline-width')).toBe('6px');
    expect(element.style.getPropertyValue('--lyric-shadow-blur')).toBe('16px');
    view.dispose();
  });
  it.each([
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ])(
    'scales reference-pixel effects for %s by %s without following font shrink',
    (width, height) => {
      const {parent, view} = setUp();
      view.rescale(scaleFor(width, height));
      const element = parent.firstElementChild;
      if (!(element instanceof HTMLElement)) {
        throw new Error('Missing lyric layer');
      }
      const scale = scaleFor(width, height);
      const axis = Number.parseFloat(
        element.style.getPropertyValue('--lyric-shadow-offset'),
      );
      expect(Math.hypot(axis, axis)).toBeCloseTo(4 * scale);
      expect(element.style.getPropertyValue('--lyric-shadow-blur')).toBe(
        `${8 * scale}px`,
      );
      expect(element.style.getPropertyValue('--lyric-outline-width')).toBe(
        `${3 * scale}px`,
      );
      expect(element.style.getPropertyValue('--lyric-shadow-strength')).toBe(
        '60%',
      );
      view.setStyle({...DEFAULT_TEXT_STYLE, size: 12});
      expect(element.style.getPropertyValue('--lyric-outline-width')).toBe(
        `${3 * scale}px`,
      );
    },
  );

  it('applies changed styles immediately to retained pages and restores the slide dissolve for new content', () => {
    const {parent, view, pages, shownPage} = setUp();
    view.show(VERSE);
    const before = pages();
    const current = shownPage();
    view.setStyle({
      ...DEFAULT_TEXT_STYLE,
      font: `Missing "Display" O'Brien Font`,
      size: 60,
      weight: 400,
      lineHeight: 1.8,
      maxLines: 3,
      color: '#123456',
      align: 'left',
      vAlign: 'bottom',
      margin: 10,
      shadow: false,
      outline: true,
    });
    expect(pages()).toEqual(before);
    expect(shownPage()).toBe(current);
    expect(parent.firstElementChild?.classList.contains(classes.instant)).toBe(
      true,
    );
    expect(parent.firstElementChild?.classList.contains(classes.shadow)).toBe(
      false,
    );
    expect(parent.firstElementChild?.classList.contains(classes.outline)).toBe(
      true,
    );
    for (const page of pages()) {
      const block = page.querySelector<HTMLElement>(`.${classes.block}`);
      expect(page.style.inset).toBe('10%');
      expect(page.style.justifyContent).toBe('flex-end');
      expect(page.style.textAlign).toBe('left');
      expect(block?.style.fontFamily).toBe(
        `"Missing \\"Display\\" O'Brien Font", "Pretendard Variable", sans-serif`,
      );
      expect(block?.style.fontWeight).toBe('400');
      expect(block?.style.lineHeight).toBe('1.8');
      expect(block?.style.color).toBe('rgb(18, 52, 86)');
    }
    view.show({...VERSE, position: 1});
    expect(parent.firstElementChild?.classList.contains(classes.instant)).toBe(
      false,
    );
    expect(
      (parent.firstElementChild instanceof HTMLElement
        ? parent.firstElementChild.style
        : undefined
      )?.getPropertyValue('--slide-dissolve'),
    ).toBe(`${SLIDE_DISSOLVE_MS}ms`);
  });
  it('draws the lines of a 장 as stored, one row each', () => {
    const {view, shownLines} = setUp();
    view.show({...VERSE, lines: ['첫 줄', '', '셋째 줄']});
    expect(shownLines()).toEqual(['첫 줄', ' ', '셋째 줄']);
  });

  it('draws only explicitly continued Bible markers at the smaller size and clears them on the last part', () => {
    const {view, parent, shownLines, shownPage} = setUp();
    view.setStyle({...DEFAULT_TEXT_STYLE, size: 36});
    view.show({...VERSE, continued: true, lines: ['가나 다라 (계속)']});
    const marker = shownPage()?.querySelector<HTMLElement>(
      '[data-bible-continuation]',
    );
    expect(marker?.textContent).toBe(' (계속)');
    expect(marker?.style.fontSize).toBe('28px');
    view.rescale(0.5);
    expect(marker?.style.fontSize).toBe('14px');
    view.show({...VERSE, position: 1, lines: ['마바 사아']});
    expect(shownPage()?.querySelector('[data-bible-continuation]')).toBeNull();
    expect(shownLines()).toEqual(['마바 사아']);
    view.show({...VERSE, position: 2, lines: ['Literal (계속)']});
    expect(shownPage()?.querySelector('[data-bible-continuation]')).toBeNull();
    view.dispose();
    expect(parent.childElementCount).toBe(0);
  });

  it('takes the dissolve time of the next 장 from the setting, 0 being a cut', () => {
    const {parent, view} = setUp();
    const layer = () => parent.querySelector<HTMLElement>(`.${classes.layer}`);
    expect(layer()?.style.getPropertyValue('--slide-dissolve')).toBe(
      `${SLIDE_DISSOLVE_MS}ms`,
    );
    view.setDissolveMs(1000);
    expect(layer()?.style.getPropertyValue('--slide-dissolve')).toBe('1000ms');
    view.setDissolveMs(0);
    expect(layer()?.style.getPropertyValue('--slide-dissolve')).toBe('0ms');
  });

  it('dissolves to the next 장 on the other page and reuses its rows', () => {
    const {view, pages, shownPage, shownLines} = setUp();
    view.show(VERSE);
    const first = shownPage();
    view.show({...VERSE, position: 1, lines: ['찬송 드리고']});
    const second = shownPage();
    expect(second).not.toBe(first);
    expect(
      pages().filter(page => page.classList.contains(classes.shown)),
    ).toHaveLength(1);
    expect(shownLines()).toEqual(['찬송 드리고']);

    const rows = second?.querySelector(`.${classes.block}`)?.children;
    const firstRow = rows?.item(0);
    view.show({...VERSE, position: 2});
    view.show({...VERSE, position: 3, lines: ['다시', '두 줄']});
    expect(
      shownPage()?.querySelector(`.${classes.block}`)?.children.item(0),
    ).toBe(firstRow);
  });

  it('leaves the same 장 alone when it is shown again', () => {
    const {view, shownPage} = setUp();
    view.show(VERSE);
    const page = shownPage();
    view.show({...VERSE, lines: [...VERSE.lines]});
    expect(shownPage()).toBe(page);
  });

  it('clears at once without a dissolve', () => {
    const {parent, view, shownPage} = setUp();
    view.show(VERSE);
    view.show(null);
    expect(shownPage()).toBeUndefined();
    expect(parent.firstElementChild?.classList.contains(classes.instant)).toBe(
      true,
    );
    view.show(VERSE);
    expect(parent.firstElementChild?.classList.contains(classes.instant)).toBe(
      false,
    );
  });

  it('applies the lyric style', () => {
    const {parent, view, shownPage} = setUp();
    view.show(VERSE);
    const page = shownPage();
    const block = page?.querySelector<HTMLElement>(`.${classes.block}`);
    expect(page?.style.inset).toBe('6%');
    expect(page?.style.justifyContent).toBe('center');
    expect(block?.style.fontWeight).toBe('700');
    expect(block?.style.fontSize).toBe('84px');
    expect(parent.firstElementChild?.classList.contains(classes.shadow)).toBe(
      true,
    );
  });

  describe('fitting', () => {
    const LINE_HEIGHT = DEFAULT_TEXT_STYLE.lineHeight;

    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
        1000,
      );
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
        1800,
      );
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(0);
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
        function (this: HTMLElement) {
          const size = Number.parseFloat(this.style.fontSize);
          return Math.ceil(this.children.length * size * LINE_HEIGHT);
        },
      );
    });

    it('keeps the style size for a 장 within the maximum lines', () => {
      const {view, shownPage} = setUp();
      view.show(VERSE);
      const block = shownPage()?.querySelector<HTMLElement>(
        `.${classes.block}`,
      );
      expect(block?.style.fontSize).toBe('84px');
    });

    it('keeps four lyric lines at theme size when the frame fits', () => {
      const {view, shownPage} = setUp();
      view.show({...VERSE, lines: ['하나', '둘', '셋', '넷']});
      const block = shownPage()?.querySelector<HTMLElement>(
        `.${classes.block}`,
      );
      expect(block?.style.fontSize).toBe('84px');
    });

    it('scales the style size to the screen', () => {
      const {view, shownPage} = setUp();
      view.show(VERSE);
      view.rescale(0.5);
      const block = shownPage()?.querySelector<HTMLElement>(
        `.${classes.block}`,
      );
      expect(block?.style.fontSize).toBe('42px');
    });

    it.each([
      [1280, 720, 56],
      [3840, 2160, 168],
    ])(
      'keeps text proportions on %s by %s output',
      (width, height, expected) => {
        const {view, shownPage} = setUp();
        view.show(VERSE);
        view.rescale(scaleFor(width, height));
        expect(
          shownPage()?.querySelector<HTMLElement>(`.${classes.block}`)?.style
            .fontSize,
        ).toBe(`${expected}px`);
      },
    );

    it('does not resize lyrics when the Bible line budget changes', () => {
      const {view, shownPage, shownLines} = setUp();
      view.show({...VERSE, lines: ['One', 'Two', 'Three', 'Four']});
      const page = shownPage();
      expect(
        page?.querySelector<HTMLElement>(`.${classes.block}`)?.style.fontSize,
      ).toBe('84px');
      view.setStyle({...DEFAULT_TEXT_STYLE, maxLines: 4});
      expect(shownPage()).toBe(page);
      expect(shownLines()).toEqual(['One', 'Two', 'Three', 'Four']);
      expect(
        page?.querySelector<HTMLElement>(`.${classes.block}`)?.style.fontSize,
      ).toBe('84px');
    });
  });

  it('removes its element on dispose', () => {
    const {parent, view} = setUp();
    view.dispose();
    expect(parent.childElementCount).toBe(0);
  });
});

it('preserves a fitted text cap through refitting and rescaling', () => {
  const {view} = setUp();
  view.setStyle({...DEFAULT_TEXT_STYLE, size: 80});
  view.show(VERSE, false);
  expect(view.fittedSize()).toBe(80);
  view.capSize(60);
  expect(view.fittedSize()).toBe(60);
  view.rescale(2);
  expect(view.fittedSize()).toBe(120);
  view.rescale(1);
  expect(view.fittedSize()).toBe(60);
  view.capSize(undefined);
  expect(view.fittedSize()).toBe(80);
  view.capSize(60);
  view.setStyle({...DEFAULT_TEXT_STYLE, size: 40});
  expect(view.fittedSize()).toBe(40);
  view.dispose();
});

it.each([-1080, 1080])(
  'removes a vertical push of %i px from incoming text bounds',
  offset => {
    expect(
      unshiftTextBounds({top: 410 + offset, bottom: 680 + offset}, offset),
    ).toEqual({top: 410, bottom: 680});
  },
);

it('fits a long automatically wrapped title into at most two visual lines', () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1720);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
  const measuredHeight = function (this: HTMLElement): number {
    const size = Number.parseFloat(this.style.fontSize) || 1;
    return Math.round((size > 80 ? 3 : 2) * size * 1.19);
  };
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
    measuredHeight,
  );
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    measuredHeight,
  );
  const parent = document.createElement('div');
  const view = new SlideLayerView(parent, {
    ...DEFAULT_TEXT_STYLE,
    size: 140,
    lineHeight: 1.19,
  });
  view.setFitLines(2);
  view.show({...VERSE, lines: ['A long sermon title '.repeat(30)]}, false);
  expect(view.fittedSize()).toBe(80);
  const block = parent.querySelector<HTMLElement>(
    `.${classes.shown} .${classes.block}`,
  );
  expect(Number.parseFloat(block?.style.maxHeight ?? '0')).toBeCloseTo(190.4);
  expect(block?.style.overflow).toBe('hidden');
  view.dispose();
});

it.each([-1080, 1080])(
  'measures a pushed incoming page without its %i px transform',
  offset => {
    const {view, shownPage} = setUp();
    view.show(VERSE, false);
    const page = shownPage();
    const block = page?.querySelector<HTMLElement>(`.${classes.block}`);
    if (!page || !block) throw Error('Missing incoming text');
    page.style.transform = `matrix(1, 0, 0, 1, 0, ${offset})`;
    vi.spyOn(block, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 410 + offset, 1720, 270),
    );
    vi.stubGlobal(
      'DOMMatrixReadOnly',
      class {
        m42 = offset;
      },
    );
    try {
      expect(view.lineBoxBounds()).toEqual({top: 410, bottom: 680});
    } finally {
      view.dispose();
      vi.unstubAllGlobals();
    }
  },
);
