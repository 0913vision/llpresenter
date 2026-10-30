import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {SlideLayer} from '@core/live/state';
import {classes} from './classes';
import {DEFAULT_LYRIC_STYLE, scaleFor} from './lyricStyle';
import {SlideLayerView} from './slideLayer';
import {OUTPUT_TRANSITIONS} from './transitions';

const VERSE: SlideLayer = {
  itemId: 'hymn-1',
  position: 0,
  label: '1절',
  lines: ['만복의 근원 하나님', '온 백성 찬송 드리고'],
};

function setUp() {
  const parent = document.createElement('div');
  const view = new SlideLayerView(parent, DEFAULT_LYRIC_STYLE);
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

describe('SlideLayerView', () => {
  it('draws detailed outline and shadow at screen scale and updates without a dissolve', () => {
    const {parent, view, shownPage} = setUp();
    view.show(VERSE);
    const page = shownPage();
    const style = {
      ...DEFAULT_LYRIC_STYLE,
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
      view.setStyle({...DEFAULT_LYRIC_STYLE, size: 12});
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
      ...DEFAULT_LYRIC_STYLE,
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
    ).toBe(`${OUTPUT_TRANSITIONS.slideMs}ms`);
  });
  it('draws the lines of a 장 as stored, one row each', () => {
    const {view, shownLines} = setUp();
    view.show({...VERSE, lines: ['첫 줄', '', '셋째 줄']});
    expect(shownLines()).toEqual(['첫 줄', ' ', '셋째 줄']);
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
    const LINE_HEIGHT = DEFAULT_LYRIC_STYLE.lineHeight;

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

    it('shrinks a 장 with more lines than the maximum until it fits', () => {
      const {view, shownPage} = setUp();
      view.show({...VERSE, lines: ['하나', '둘', '셋', '넷']});
      const block = shownPage()?.querySelector<HTMLElement>(
        `.${classes.block}`,
      );
      expect(block?.style.fontSize).toBe('42px');
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

    it('refits all original lines when the maximum line count changes', () => {
      const {view, shownPage, shownLines} = setUp();
      view.show({...VERSE, lines: ['One', 'Two', 'Three', 'Four']});
      const page = shownPage();
      expect(
        page?.querySelector<HTMLElement>(`.${classes.block}`)?.style.fontSize,
      ).toBe('42px');
      view.setStyle({...DEFAULT_LYRIC_STYLE, maxLines: 4});
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
