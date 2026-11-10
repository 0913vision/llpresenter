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
import {PREPARATION_THEME_ID} from '@core/themes/sundayStandby';
import {ThemeElementView} from '@renderer/rendering/themeElement';
import {ThemeGaps} from '@renderer/rendering/themeGaps';
import {emptyLayers, type SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';

const screen = createScreenId(STARTER_SCREEN_IDS.broadcast);
const slide = {itemId: 'item', position: 0, label: null, lines: ['one', 'two']};

function bandHidden(
  layout: ThemeScreenLayout,
  current: SlideLayer | null,
  item: LiveThemeItem | null = null,
): boolean | undefined {
  const parent = document.createElement('div');
  const resolved = fitBroadcastBand(layout, current, item);
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
  try {
    view.render({...emptyLayers(), slide: current}, {});
    const element = parent.querySelector<HTMLElement>(
      `[data-theme-element="${BROADCAST_BAND_ID}"]`,
    );
    return element === null ? undefined : element.hidden === true;
  } finally {
    view.dispose();
  }
}

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
  it('shows a song title for an empty song slide, but not for empty non-songs or cleared content', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('Missing broadcast layout');
    const blank = {
      ...slide,
      kind: 'song' as const,
      title: 'A song',
      lines: [' ', ''],
    };
    const item = {
      id: 'item',
      kind: 'song' as const,
      source: 'service' as const,
      title: 'My song',
    };
    expect(bandHidden(layout, blank, item)).toBe(false);
    expect(
      bandHidden(layout, {...blank, kind: 'blank'}, {...item, kind: 'blank'}),
    ).toBe(true);
    expect(bandHidden(layout, blank, {...item, contentCleared: true})).toBe(
      true,
    );
    expect(
      bandHidden(layout, {...blank, title: ''}, {...item, title: ''}),
    ).toBe(true);
    const fitted = fitBroadcastBand(layout, blank, item);
    const body = fitted.elements.find(
      element => element.id === BROADCAST_TEXT_ID,
    );
    expect(body).toMatchObject({
      broadcastSongTitle: 'My song',
      minimumTextSize: BROADCAST_MIN_TEXT,
    });
    const spaced = fitBroadcastBand(
      layout,
      {...blank, label: 'Interlude'},
      {...item, title: '  My   song\n title  '},
    );
    expect(
      spaced.elements.find(element => element.id === BROADCAST_TEXT_ID),
    ).toMatchObject({broadcastSongTitle: 'My song title'});
    const fallback = fitBroadcastBand(
      layout,
      {...blank, title: '', label: 'Interlude'},
      {...item, title: ''},
    );
    expect(
      fallback.elements.find(element => element.id === BROADCAST_TEXT_ID),
    ).toMatchObject({broadcastSongTitle: 'Interlude'});
    const lyrics = fitBroadcastBand(
      layout,
      {...blank, lines: ['Lyrics']},
      item,
    );
    expect(
      lyrics.elements.find(element => element.id === BROADCAST_TEXT_ID),
    ).toMatchObject({broadcastSongTitle: undefined});
  });
  it('measures a 40-character song title unwrapped and wraps at the 48 px floor', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('Missing broadcast layout');
    const title = '가'.repeat(40);
    const widths = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.style.whiteSpace === 'pre'
          ? Math.ceil(40 * Number.parseFloat(this.style.fontSize))
          : BROADCAST_GEOMETRY.width - BROADCAST_GEOMETRY.sidePadding * 2;
      });
    const heights = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return Math.ceil(
          Number.parseFloat(this.style.fontSize) *
            BROADCAST_GEOMETRY.lineHeight *
            (this.style.whiteSpace === 'pre' ? 1 : 2),
        );
      });
    try {
      const result = fitBroadcastBand(
        layout,
        {
          ...slide,
          kind: 'song',
          lines: [''],
          title,
        },
        {id: 'item', kind: 'song', source: 'service', title},
      );
      const body = result.elements.find(
        element => element.id === BROADCAST_TEXT_ID,
      );
      if (body?.kind !== 'currentText') throw Error('Missing text');
      expect(body.text.size).toBe(BROADCAST_MIN_TEXT);
      expect(body).toMatchObject({
        broadcastSongTitle: title,
        broadcastSongTitleWrap: true,
        minimumTextSize: BROADCAST_MIN_TEXT,
      });
      expect(body.frame.h).toBeGreaterThanOrEqual(
        Math.ceil(2 * BROADCAST_MIN_TEXT * BROADCAST_GEOMETRY.lineHeight),
      );
      expect(
        result.elements.find(element => element.id === BROADCAST_BAND_ID)?.frame
          .h,
      ).toBe(BROADCAST_GEOMETRY.minHeight);
    } finally {
      widths.mockRestore();
      heights.mockRestore();
    }
  });
  it('hides the preparation, blank and media bands when their broadcast text is empty', () => {
    const preparation = createDefaultThemes().themes.find(
      theme => theme.id === PREPARATION_THEME_ID,
    )?.screens[screen];
    const blank = builtInTheme('blank').screens[screen];
    const media = builtInTheme('media').screens[screen];
    if (!preparation || !blank || !media) {
      throw Error('Missing broadcast layouts');
    }
    const empty = {...slide, lines: ['  ', '']};
    for (const [layout, kind] of [
      [preparation, 'blank'],
      [blank, 'blank'],
      [media, 'media'],
    ] as const) {
      expect(
        bandHidden(layout, empty, {
          id: 'item',
          kind,
          source: 'service',
          title: 'Preparation',
        }),
      ).toBe(true);
    }
  });
  it('keeps the band for a visible section name, notice title or Bible reference', () => {
    const section = createDefaultThemes().themes.find(
      theme => theme.id === SECTION_THEME_ID,
    )?.screens[screen];
    const ad = builtInTheme('ad').screens[screen];
    const bible = builtInTheme('bible').screens[screen];
    if (!section || !ad || !bible) throw Error('Missing broadcast layouts');
    const empty = {...slide, lines: ['']};
    const item = {
      id: 'item',
      kind: 'blank' as const,
      source: 'service' as const,
      title: 'Creed',
    };
    const cases = [
      [section, empty, item],
      [ad, {...empty, name: 'Notice'}, null],
      [bible, {...empty, reference: 'John 3:16'}, null],
    ] as const;
    for (const [layout, current, themeItem] of cases) {
      expect(bandHidden(layout, current, themeItem)).toBe(false);
    }
    expect(
      bandHidden(section, empty, {
        ...item,
        contentCleared: true,
      }),
    ).toBe(true);
  });
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
    expect(clipped.frame.h).toBeGreaterThanOrEqual(
      Math.ceil(12 * BROADCAST_MIN_TEXT * BROADCAST_GEOMETRY.lineHeight),
    );
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
  it('grows beyond the preferred height to keep all twelve lines', () => {
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
    expect(text.frame.h).toBeGreaterThanOrEqual(
      Math.ceil(12 * BROADCAST_MIN_TEXT * 1.22),
    );
    expect(
      result.elements.find(element => element.id === BROADCAST_BAND_ID)?.frame
        .h,
    ).toBeGreaterThan(360);
  });
  it('keeps a five-line verse and its reference inside the band', () => {
    const layout = builtInTheme('bible').screens[screen];
    if (!layout) throw Error('Missing broadcast layout');
    const result = fitBroadcastBand(layout, {
      ...slide,
      reference: 'John 3:18',
      lines: ['one', 'two', 'three', 'four', 'five'],
    });
    const band = result.elements.find(
      element => element.id === BROADCAST_BAND_ID,
    );
    const body = result.elements.find(
      element => element.id === BROADCAST_TEXT_ID,
    );
    const reference = result.elements.find(
      element => element.id === BROADCAST_REFERENCE_ID,
    );
    if (!band || body?.kind !== 'currentText' || !reference) {
      throw Error('Missing broadcast elements');
    }
    expect(body.text.size).toBe(BROADCAST_MIN_TEXT);
    expect(body.frame.h).toBeGreaterThanOrEqual(
      Math.ceil(5 * body.text.size * BROADCAST_GEOMETRY.lineHeight),
    );
    expect(body.frame.y).toBeGreaterThanOrEqual(band.frame.y);
    expect(body.frame.y + body.frame.h).toBeLessThanOrEqual(reference.frame.y);
    expect(reference.frame.y + reference.frame.h).toBeLessThanOrEqual(
      band.frame.y + band.frame.h,
    );
    expect(band.frame.h).toBeGreaterThan(360);
  });
  it('shrinks below the preferred minimum only when needed to stay on screen', () => {
    const layout = builtInTheme('bible').screens[screen];
    if (!layout) throw Error('Missing broadcast layout');
    const result = fitBroadcastBand(layout, {
      ...slide,
      reference: 'John',
      lines: Array.from({length: 30}, (_, i) => `line ${i}`),
    });
    const band = result.elements.find(
      element => element.id === BROADCAST_BAND_ID,
    );
    const body = result.elements.find(
      element => element.id === BROADCAST_TEXT_ID,
    );
    if (!band || body?.kind !== 'currentText') {
      throw Error('Missing broadcast elements');
    }
    expect(body.text.size).toBeLessThan(BROADCAST_MIN_TEXT);
    expect(body.text.size).toBeGreaterThan(0);
    expect(body).toMatchObject({minimumTextSize: body.text.size});
    expect(body.frame.h).toBeGreaterThanOrEqual(
      Math.ceil(30 * body.text.size * BROADCAST_GEOMETRY.lineHeight),
    );
    expect(band.frame.y).toBeGreaterThanOrEqual(0);
  });
  it('measures a five-line Bible slide as one paragraph wrapping into at most three rows', () => {
    const layout = builtInTheme('bible').screens[screen];
    if (!layout) throw Error('Missing broadcast layout');
    const original = [
      '18 요한복음 3:18 임시 본문입니다. 이',
      '문장은 실제 성경이 아니며, 한 절이 두 줄',
      '이상으로 길어질 때 나누기와 줄바꿈이',
      '어떻게 보이는지 확인하려고 조금 길게',
      '썼습니다.',
    ];
    const measured: string[] = [];
    const height = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        measured.push(this.textContent);
        return Math.ceil(
          3 *
            Number.parseFloat(this.style.fontSize) *
            BROADCAST_GEOMETRY.lineHeight,
        );
      });
    try {
      const result = fitBroadcastBand(layout, {
        ...slide,
        kind: 'bible',
        reference: '요한복음 3:18',
        lines: original,
      });
      const text = result.elements.find(
        element => element.id === BROADCAST_TEXT_ID,
      );
      if (text?.kind !== 'currentText') throw Error('Missing text');
      expect(measured).toContain(original.join(' '));
      expect(text.text.size).toBe(BROADCAST_GEOMETRY.textSize);
      expect(text.frame.h).toBeGreaterThanOrEqual(
        Math.ceil(3 * text.text.size * BROADCAST_GEOMETRY.lineHeight),
      );
      expect(original).toHaveLength(5);
    } finally {
      height.mockRestore();
    }
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
    const fittedSection = fitBroadcastBand(
      section,
      {
        ...slide,
        sectionCard: card,
        lines: [card.english],
      },
      {id: 'item', kind: 'blank', source: 'service', title: card.name},
    );
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
      {id: 'item', kind: 'blank', source: 'service', title: card.name},
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
      expect(bandHidden(layout, current)).toBe(hidden);
    }
  });
});
