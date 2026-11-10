import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createMediaId, createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {builtInTheme} from '@core/themes/defaults';
import {
  BROADCAST_BAND_ID,
  BROADCAST_MIN_TEXT,
  BROADCAST_TEXT_ID,
  BROADCAST_TITLE_ID,
  BROADCAST_REFERENCE_ID,
  BROADCAST_GEOMETRY,
} from '@core/themes/broadcastBand';
import {fitBroadcastBand} from '@renderer/rendering/broadcastBand';
import {createDefaultThemes} from '@core/themes/defaults';
import {SECTION_THEME_ID} from '@core/themes/sundaySections';
import {ThemeElementView} from '@renderer/rendering/themeElement';
import {ThemeGaps} from '@renderer/rendering/themeGaps';
import {emptyLayers} from '@core/live/state';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';

const screen = createScreenId(STARTER_SCREEN_IDS.broadcast);
const slide = {itemId: 'item', position: 0, label: null, lines: ['one', 'two']};

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return Math.ceil(
        this.children.length *
          Number.parseFloat(this.style.fontSize) *
          BROADCAST_GEOMETRY.lineHeight,
      );
    },
  );
});
afterEach(() => vi.restoreAllMocks());

describe('broadcast band fitting', () => {
  it('uses size-dependent wrapping, shrinks to fit, and cleans its measuring host', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('Missing broadcast layout');
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get');
    height.mockImplementation(function (this: HTMLElement) {
      const size = Number.parseFloat(this.style.fontSize);
      const rows =
        this.textContent === 'short' ? 1 : size >= 60 ? 6 : size >= 50 ? 5 : 4;
      return Math.ceil(rows * size * BROADCAST_GEOMETRY.lineHeight);
    });
    const hosts = () =>
      document.body.querySelectorAll('[data-slide-measure]').length;
    const before = hosts();
    const short = fitBroadcastBand(layout, {...slide, lines: ['short']});
    const wrapped = fitBroadcastBand(layout, {
      ...slide,
      lines: ['long wrapping text'],
    });
    const shortBand = short.elements.find(
      element => element.id === BROADCAST_BAND_ID,
    );
    const longBand = wrapped.elements.find(
      element => element.id === BROADCAST_BAND_ID,
    );
    const text = wrapped.elements.find(
      element => element.id === BROADCAST_TEXT_ID,
    );
    if (text?.kind !== 'currentText' || !shortBand || !longBand) {
      throw Error('Missing band elements');
    }
    expect(text.text.size).toBeLessThan(BROADCAST_GEOMETRY.textSize);
    expect(text.text.size).toBeGreaterThan(BROADCAST_MIN_TEXT);
    expect(text.frame.h).toBeGreaterThanOrEqual(
      Math.ceil(5 * text.text.size * BROADCAST_GEOMETRY.lineHeight),
    );
    expect(longBand.frame.h).toBeGreaterThan(shortBand.frame.h);
    expect(hosts()).toBe(before);
    height.mockImplementation(function (this: HTMLElement) {
      return Math.ceil(
        12 *
          Number.parseFloat(this.style.fontSize) *
          BROADCAST_GEOMETRY.lineHeight,
      );
    });
    const overflow = fitBroadcastBand(layout, {...slide, lines: ['very long']});
    const clipped = overflow.elements.find(
      element => element.id === BROADCAST_TEXT_ID,
    );
    if (clipped?.kind !== 'currentText') throw Error('Missing text');
    expect(clipped.text.size).toBe(BROADCAST_MIN_TEXT);
    const rows =
      clipped.frame.h / (BROADCAST_MIN_TEXT * BROADCAST_GEOMETRY.lineHeight);
    expect(rows).toBeCloseTo(Math.floor(rows));
    expect(hosts()).toBe(before);
  });
  it('grows for four lines and preserves the whole slide without paging', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('Missing broadcast layout');
    const two = fitBroadcastBand(layout, slide);
    const four = fitBroadcastBand(layout, {
      ...slide,
      lines: ['one', 'two', 'three', 'four'],
    });
    const band = (value: typeof layout) =>
      value.elements.find(element => element.id === BROADCAST_BAND_ID);
    expect(band(two)?.frame.h).toBeGreaterThanOrEqual(204);
    expect(band(four)?.frame.h).toBeGreaterThan(band(two)?.frame.h ?? 0);
    expect(band(four)?.frame.h).toBeLessThanOrEqual(360);
    const text = four.elements.find(
      element => element.id === BROADCAST_TEXT_ID,
    );
    if (text?.kind !== 'currentText') throw Error('Missing text');
    expect(text.text.size).toBeGreaterThanOrEqual(BROADCAST_MIN_TEXT);
  });
  it('uses the minimum size and clips at a complete line when the slide is too long', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('Missing broadcast layout');
    const result = fitBroadcastBand(layout, {
      ...slide,
      lines: Array.from({length: 12}, (_, i) => `line ${i}`),
    });
    const text = result.elements.find(
      element => element.id === BROADCAST_TEXT_ID,
    );
    if (text?.kind !== 'currentText') throw Error('Missing text');
    expect(text.text.size).toBe(BROADCAST_MIN_TEXT);
    expect(text.frame.h / (BROADCAST_MIN_TEXT * 1.22)).toBeCloseTo(
      Math.floor(text.frame.h / (BROADCAST_MIN_TEXT * 1.22)),
    );
    expect(
      result.elements.find(element => element.id === BROADCAST_BAND_ID)?.frame
        .h,
    ).toBeLessThanOrEqual(360);
  });
  it('does not alter a saved layout without the built-in marker', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('Missing broadcast layout');
    const saved = {
      ...layout,
      elements: layout.elements.filter(
        element => element.id !== BROADCAST_BAND_ID,
      ),
    };
    expect(fitBroadcastBand(saved, slide)).toBe(saved);
    expect(fitBroadcastBand(layout, null)).not.toBe(layout);
  });
  it.each([
    'WIDE WORLD WIDE WORSHIP WIDE WORLD WIDE WORSHIP WIDE WORLD',
    '우리 가운데 역사하시는 크신 사랑을 온 마음으로 노래하며 이 세상에 전합니다',
  ])('uses the rendered row measurement for long text: %s', line => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('Missing broadcast layout');
    const measured: string[] = [];
    const height = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        measured.push(this.textContent);
        return Math.ceil(
          Number.parseFloat(this.style.fontSize) *
            BROADCAST_GEOMETRY.lineHeight *
            3,
        );
      });
    try {
      const result = fitBroadcastBand(layout, {...slide, lines: [line]});
      const text = result.elements.find(
        element => element.id === BROADCAST_TEXT_ID,
      );
      if (text?.kind !== 'currentText') throw Error('Missing text');
      expect(measured).toContain(line);
      expect(text.frame.h).toBeGreaterThanOrEqual(
        Math.ceil(text.text.size * BROADCAST_GEOMETRY.lineHeight * 3),
      );
    } finally {
      height.mockRestore();
    }
  });
  it('sizes section names, and reserves title and reference rows at the expected positions', () => {
    const section = createDefaultThemes().themes.find(
      theme => theme.id === SECTION_THEME_ID,
    )?.screens[screen];
    const ad = builtInTheme('ad').screens[screen];
    const bible = builtInTheme('bible').screens[screen];
    if (!section || !ad || !bible) throw Error('Missing broadcast layouts');
    const card = {
      name: '사도신경',
      english:
        'A long English line that should not determine the section height',
      theme: SECTION_THEME_ID,
    };
    const fittedSection = fitBroadcastBand(section, {
      ...slide,
      sectionCard: card,
      lines: [card.english],
    });
    expect(
      fittedSection.elements.find(element => element.id === BROADCAST_BAND_ID)
        ?.frame.h,
    ).toBe(BROADCAST_GEOMETRY.minHeight);
    expect(
      fittedSection.elements.find(element => element.id === BROADCAST_TEXT_ID)
        ?.kind,
    ).toBe('itemName');
    const standalone = fitBroadcastBand(
      section,
      {...slide, lines: [card.english]},
      card.name,
    );
    expect(
      standalone.elements.find(element => element.id === BROADCAST_BAND_ID)
        ?.frame.h,
    ).toBe(BROADCAST_GEOMETRY.minHeight);
    const adWithout = fitBroadcastBand(ad, slide);
    const adWith = fitBroadcastBand(ad, {...slide, name: 'Notice'});
    expect(
      adWith.elements.find(element => element.id === BROADCAST_BAND_ID)?.frame
        .h,
    ).toBeGreaterThan(
      adWithout.elements.find(element => element.id === BROADCAST_BAND_ID)
        ?.frame.h ?? 0,
    );
    expect(
      adWith.elements.find(element => element.id === BROADCAST_TITLE_ID)?.frame
        .y,
    ).toBe(
      (adWith.elements.find(element => element.id === BROADCAST_BAND_ID)?.frame
        .y ?? 0) + BROADCAST_GEOMETRY.padding,
    );
    const bibleWithout = fitBroadcastBand(bible, slide);
    const bibleWith = fitBroadcastBand(bible, {
      ...slide,
      reference: 'John 3:16',
    });
    expect(
      bibleWith.elements.find(element => element.id === BROADCAST_BAND_ID)
        ?.frame.h,
    ).toBeGreaterThan(
      bibleWithout.elements.find(element => element.id === BROADCAST_BAND_ID)
        ?.frame.h ?? 0,
    );
    expect(
      bibleWith.elements.find(element => element.id === BROADCAST_REFERENCE_ID)
        ?.frame.y,
    ).toBe(
      BROADCAST_GEOMETRY.height -
        BROADCAST_GEOMETRY.bottom -
        BROADCAST_GEOMETRY.padding -
        BROADCAST_GEOMETRY.extraHeight,
    );
  });
  it('hides the band for a clear or picture-only slide, and shows it for text or a named picture', () => {
    const layout = builtInTheme('ad').screens[screen];
    if (!layout) throw Error('Missing broadcast layout');
    const parent = document.createElement('div');
    const picture = {
      ...slide,
      picture: createMediaId('00000000-0000-4000-8000-000000000901'),
      lines: [''],
    };
    const cases = [
      [null, true],
      [picture, true],
      [slide, false],
      [{...picture, name: 'Title'}, false],
    ] as const;
    for (const [current, hidden] of cases) {
      const resolved = fitBroadcastBand(layout, current);
      const band = resolved.elements.find(
        element => element.id === BROADCAST_BAND_ID,
      );
      if (!band) throw Error('Missing band');
      const view = new ThemeElementView(band, parent, {
        options: {
          textStyle: DEFAULT_TEXT_STYLE,
          mediaUrl: id => id,
          onError: vi.fn(),
        },
        gaps: new ThemeGaps(vi.fn()),
      });
      view.render({...emptyLayers(), slide: current}, {});
      expect(
        parent.querySelector<HTMLElement>(
          `[data-theme-element="${BROADCAST_BAND_ID}"]`,
        )?.hidden,
      ).toBe(hidden);
      view.dispose();
    }
  });
});
