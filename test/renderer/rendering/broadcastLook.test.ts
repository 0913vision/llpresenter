import {mockBroadcastMeasure, mockBroadcastRect} from './broadcastMeasure';
import {styleBroadcastGlass} from '@renderer/rendering/themeElement';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {builtInTheme} from '@core/themes/defaults';
import {SECTION_THEME_ID} from '@core/themes/sundaySections';
import {
  BROADCAST_REFERENCE_ID,
  BROADCAST_TEXT_ID,
} from '@core/themes/broadcastBand';
import {
  BROADCAST_LOOK_BAND_ID,
  BROADCAST_LOOK_TAB_ID,
  BROADCAST_LOOK_SONG_ID,
  BROADCAST_LOOK_CARD_ID,
  broadcastLookLayout,
} from '@core/themes/broadcastLook';
import {
  fitBroadcastLook as fitLook,
  isBroadcastLook,
} from '@renderer/rendering/broadcastLook';
import type {SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';

const screen = createScreenId(STARTER_SCREEN_IDS.broadcast);
const slide: SlideLayer = {
  itemId: 'test',
  position: 0,
  label: null,
  lines: ['one'],
};
const item: LiveThemeItem = {id: 'test', kind: 'bible', source: 'external'};
const plain = () => {
  const layout = builtInTheme('bible').screens[screen];
  if (!layout) throw Error('missing layout');
  return layout;
};
const element = (layout: ReturnType<typeof fitBroadcastLook>, id: string) => {
  const e = layout.elements.find(x => x.id === id);
  if (!e) throw Error('missing element');
  return e;
};

const fitBroadcastLook = (
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
  item: LiveThemeItem | null,
) => fitLook(layout, slide, {item, measureWidth: text => text.length * 20});

beforeEach(() => {
  mockBroadcastMeasure(1.35);
  mockBroadcastRect();
});
afterEach(() => vi.restoreAllMocks());

describe('built-in broadcast look', () => {
  it('fits line boxes rather than glyph overflow for songs and Bible passages', () => {
    const rowCount = (el: HTMLElement): number => {
      const match = /verse([234])/u.exec(el.textContent);
      return match ? Number(match[1]) : el.children.length;
    };
    mockBroadcastRect(rowCount);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return Math.ceil(
          rowCount(this) *
            Number.parseFloat(this.style.fontSize) *
            Number.parseFloat(this.style.lineHeight) +
            5,
        );
      },
    );
    const songLayout = builtInTheme('song').screens[screen];
    if (!songLayout) throw Error('missing song');
    const song = {...item, kind: 'song' as const, title: 'Song title'};
    const one = fitBroadcastLook(
      songLayout,
      {...slide, lines: ['first']},
      song,
    );
    const two = fitBroadcastLook(
      songLayout,
      {...slide, lines: ['first', 'second']},
      song,
    );
    const oneText = element(one, BROADCAST_LOOK_SONG_ID);
    const twoText = element(two, BROADCAST_LOOK_SONG_ID);
    expect(oneText).toMatchObject({text: {size: 56}, frame: {h: 70}});
    expect(twoText).toMatchObject({text: {size: 56}, frame: {h: 140}});
    expect(element(two, BROADCAST_LOOK_BAND_ID).frame.h).toBeGreaterThan(
      element(one, BROADCAST_LOOK_BAND_ID).frame.h,
    );
    for (const [rows, size] of [
      [2, 55],
      [3, 55],
      [4, 48],
    ]) {
      const bible = fitBroadcastLook(
        plain(),
        {...slide, lines: [`verse${rows}`], reference: 'John 3:16'},
        item,
      );
      expect(element(bible, BROADCAST_TEXT_ID)).toMatchObject({text: {size}});
    }
  });
  it('shows the entire Bible item range above each verse', () => {
    const layout = builtInTheme('bible').screens[screen];
    if (!layout) throw Error('missing Bible layout');
    for (const reference of [
      'Habakkuk 3:17',
      'Habakkuk 3:18',
      'Habakkuk 3:19',
    ]) {
      const result = fitBroadcastLook(
        layout,
        {...slide, reference},
        {...item, kind: 'bible', title: 'Habakkuk 3:17~19'},
      );
      expect(element(result, BROADCAST_REFERENCE_ID)).toMatchObject({
        broadcastText: 'Habakkuk 3:17~19',
        runtimeHidden: false,
      });
    }
    const fallback = fitBroadcastLook(
      layout,
      {...slide, reference: 'Habakkuk 3:18'},
      {id: 'item', kind: 'bible', source: 'service'},
    );
    expect(element(fallback, BROADCAST_REFERENCE_ID)).toMatchObject({
      broadcastText: 'Habakkuk 3:18',
    });
  });

  it('uses the tallest Bible part for every slide in the same item', () => {
    const rows = (element: HTMLElement): number =>
      element.textContent.includes('tall') ? 3 : 1;
    mockBroadcastRect(rows);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return Math.ceil(
          rows(this) * Number.parseFloat(this.style.fontSize) * 1.35,
        );
      },
    );
    const bibleItemSlides = [
      {lines: ['short']},
      {lines: ['tall']},
      {lines: ['other']},
    ];
    const results = bibleItemSlides.map((part, position) =>
      fitBroadcastLook(
        plain(),
        {...slide, position, lines: part.lines, bibleItemSlides},
        item,
      ),
    );
    const boxes = results.map(
      result => element(result, BROADCAST_LOOK_BAND_ID).frame,
    );
    const bodies = results.map(
      result => element(result, BROADCAST_TEXT_ID).frame,
    );
    expect(boxes.map(box => box.h)).toEqual([
      boxes[0]?.h,
      boxes[0]?.h,
      boxes[0]?.h,
    ]);
    expect(boxes.map(box => box.y + box.h)).toEqual([1026, 1026, 1026]);
    expect(bodies.map(body => body.y)).toEqual([
      bodies[0]?.y,
      bodies[0]?.y,
      bodies[0]?.y,
    ]);
    const withoutGroup = fitBroadcastLook(
      plain(),
      {...slide, lines: ['short']},
      item,
    );
    expect(element(withoutGroup, BROADCAST_LOOK_BAND_ID).frame.h).toBeLessThan(
      boxes[0]?.h ?? 0,
    );
    const nonBible = fitBroadcastLook(
      plain(),
      {...slide, lines: ['short'], bibleItemSlides},
      {...item, kind: 'blank'},
    );
    expect(element(nonBible, BROADCAST_LOOK_BAND_ID).frame.h).toBe(
      element(withoutGroup, BROADCAST_LOOK_BAND_ID).frame.h - 48,
    );
  });
  it('grows the box for one, three and four rows and shrinks after three', () => {
    const rows = [1, 3, 4].map(count =>
      fitBroadcastLook(
        plain(),
        {...slide, lines: Array(count).fill('one')},
        {...item, kind: 'blank'},
      ),
    );
    const [one, three, four] = rows;
    if (!one || !three || !four) throw Error('missing fitted rows');
    const boxes = [one, three, four].map(layout =>
      element(layout, BROADCAST_LOOK_BAND_ID),
    );
    const [first, third, fourth] = boxes;
    if (!first || !third || !fourth) throw Error('missing boxes');
    expect(boxes.map(box => box.frame.y + box.frame.h)).toEqual([
      1026, 1026, 1026,
    ]);
    expect(third.frame.h).toBeGreaterThan(first.frame.h);
    expect(fourth.frame.h).toBeGreaterThan(third.frame.h);
    expect(element(three, BROADCAST_TEXT_ID)).toMatchObject({
      frame: {x: 90},
      text: {size: 55, color: '#1F1F1F'},
    });
    expect(element(four, BROADCAST_TEXT_ID)).toMatchObject({
      text: {size: 48},
    });
  });
  it('bounds and fits a very long Bible passage to the 900 px body height', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return Math.ceil(Number.parseFloat(this.style.fontSize) * 1.35 * 40);
      },
    );
    const fitted = fitBroadcastLook(
      plain(),
      {...slide, lines: ['a long passage'], reference: 'John 3:16'},
      item,
    );
    const body = element(fitted, BROADCAST_TEXT_ID);
    const box = element(fitted, BROADCAST_LOOK_BAND_ID);
    expect(body.frame.h).toBeLessThanOrEqual(900);
    expect(body.frame.h).toBeGreaterThan(0);
    expect(box.frame.y).toBeGreaterThanOrEqual(0);
    expect(box.frame.y + box.frame.h).toBe(1026);
    expect(body).toMatchObject({text: {size: 16}});
  });
  it('reports an unavailable canvas context instead of silently using zero widths', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const layout = broadcastLookLayout('card');
    expect(() =>
      fitLook(
        layout,
        {
          ...slide,
          sectionCard: {
            name: 'Sermon',
            english: 'Sermon',
            theme: SECTION_THEME_ID,
          },
        },
        {item},
      ),
    ).toThrow('Cannot measure broadcast text: canvas context unavailable');
    expect(document.body.querySelector('[data-slide-measure]')).toBeNull();
  });
  it('shows the strip inside the box only for Bible slides', () => {
    const bible = fitBroadcastLook(
      plain(),
      {...slide, reference: 'John 3:16'},
      item,
    );
    const blank = fitBroadcastLook(plain(), slide, {...item, kind: 'blank'});
    const band = element(bible, BROADCAST_LOOK_BAND_ID);
    expect(element(bible, BROADCAST_LOOK_TAB_ID)).toMatchObject({
      frame: {x: 64, y: band.frame.y + 6, h: 48},
      runtimeHidden: false,
    });
    expect(element(bible, BROADCAST_REFERENCE_ID)).toMatchObject({
      frame: {x: 90},
      text: {size: 30, color: '#FFFFFF'},
    });
    expect(element(blank, BROADCAST_LOOK_TAB_ID)).toMatchObject({
      runtimeHidden: true,
    });
    expect(element(blank, BROADCAST_REFERENCE_ID)).toMatchObject({
      runtimeHidden: true,
    });
    expect(
      element(
        fitBroadcastLook(plain(), {...slide, lines: []}, item),
        BROADCAST_LOOK_BAND_ID,
      ),
    ).toMatchObject({runtimeHidden: true});
  });
  it('makes the panel opaque without a shadow for a capture window', () => {
    const capture = document.createElement('div');
    const ndi = document.createElement('div');
    styleBroadcastGlass(capture, 'panel', true);
    styleBroadcastGlass(ndi, 'panel', false);
    expect(capture.style.borderColor).toBe('rgb(232, 232, 232)');
    const panel = capture.firstElementChild;
    if (!(panel instanceof HTMLElement)) throw Error('missing panel');
    expect(panel.style.backgroundColor).toBe('rgb(254, 253, 249)');
    expect(capture.style.boxShadow).toBe('none');
    expect(ndi.style.boxShadow).toContain('16px');
    expect(ndi.style.borderColor).toContain('45%');
  });
  it('puts songs in a band by default and hides empty text', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const song = {...item, kind: 'song' as const, title: 'Song title'};
    const savedLayout = {
      ...layout,
      elements: layout.elements.map(e =>
        e.id === BROADCAST_LOOK_BAND_ID && e.kind === 'box'
          ? {...e, box: {...e.box, opacity: 100}}
          : e,
      ),
    };
    const result = fitBroadcastLook(
      savedLayout,
      {...slide, lines: ['one', 'two']},
      song,
    );
    expect(element(result, BROADCAST_LOOK_BAND_ID)).toMatchObject({
      frame: {x: 0, w: 1920},
      box: {fill: '#000000', opacity: 91},
      runtimeHidden: false,
    });
    expect(element(result, BROADCAST_LOOK_SONG_ID)).toMatchObject({
      frame: {x: 160},
      text: {size: 56, align: 'center', color: '#FFFFFF'},
    });
    const empty = fitBroadcastLook(
      layout,
      {...slide, lines: []},
      {...song, title: ''},
    );
    expect(element(empty, BROADCAST_LOOK_BAND_ID)).toMatchObject({
      runtimeHidden: true,
    });
  });
  it('switches per screen between the band and text-only captions', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const song = {...item, kind: 'song' as const};
    const band = fitLook(
      layout,
      {...slide, lines: ['one', 'two']},
      {item: song, songCaption: 'band'},
    );
    const text = fitLook(
      layout,
      {...slide, lines: ['one', 'two']},
      {item: song, songCaption: 'text'},
    );
    expect(element(band, BROADCAST_LOOK_BAND_ID)).toMatchObject({
      runtimeHidden: false,
      broadcastSong: 'band',
    });
    expect(element(text, BROADCAST_LOOK_BAND_ID)).toMatchObject({
      runtimeHidden: true,
    });
    const body = element(text, BROADCAST_LOOK_SONG_ID);
    expect(body).toMatchObject({broadcastSong: 'text', text: {size: 56}});
    expect(body.frame.y + body.frame.h).toBe(1004);
  });
  it('clears song text and its background when the item is cleared', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    for (const songCaption of ['band', 'text'] as const) {
      const result = fitLook(
        layout,
        {...slide, lines: ['one']},
        {item: {...item, kind: 'song', contentCleared: true}, songCaption},
      );
      expect(element(result, BROADCAST_LOOK_BAND_ID)).toMatchObject({
        runtimeHidden: true,
      });
      expect(element(result, BROADCAST_LOOK_SONG_ID)).toMatchObject({
        broadcastText: '',
      });
    }
  });
  it('keeps a final Latin lyric line at full size in both captions', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    for (const songCaption of ['band', 'text'] as const) {
      const result = fitLook(
        layout,
        {...slide, lines: ['\uc8fc \ud558\ub098\ub2d8', 'Hallelujah']},
        {item: {...item, kind: 'song'}, songCaption},
      );
      expect(element(result, BROADCAST_LOOK_SONG_ID)).toMatchObject({
        broadcastText: '\uc8fc \ud558\ub098\ub2d8\nHallelujah',
        text: {size: 56},
      });
      expect(
        result.elements.filter(e => e.id === BROADCAST_REFERENCE_ID),
      ).toHaveLength(0);
    }
  });
  it('shows the song title, never the empty slide label, and remains empty without a title', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const empty = {...slide, kind: 'song' as const, label: '간주', lines: []};
    const titled = fitBroadcastLook(layout, empty, {
      ...item,
      kind: 'song',
      title: '주 사랑',
    });
    expect(element(titled, BROADCAST_LOOK_SONG_ID)).toMatchObject({
      broadcastText: '주 사랑',
    });
    const untitled = fitBroadcastLook(layout, empty, {...item, kind: 'song'});
    expect(element(untitled, BROADCAST_LOOK_SONG_ID)).toMatchObject({
      broadcastText: '',
    });
  });
  it('sizes the glass card layout to its longest text and renders the English uppercase', () => {
    const layout = broadcastLookLayout('card');
    const current = {
      ...slide,
      sectionCard: {
        name: '설교',
        english: 'long sermon',
        theme: SECTION_THEME_ID,
      },
    };
    const result = fitBroadcastLook(layout, current, {...item, kind: 'blank'});
    expect(element(result, BROADCAST_LOOK_CARD_ID)).toMatchObject({
      frame: {x: 58, w: 276},
      box: {fill: '#FEFDF9'},
    });
    expect(element(result, BROADCAST_LOOK_CARD_ID).frame.w).toBe(276);
    expect(element(result, BROADCAST_REFERENCE_ID)).toMatchObject({
      kind: 'text',
      content: 'LONG SERMON',
      text: {size: 28, weight: 600},
    });
    const longer = fitBroadcastLook(
      layout,
      {
        ...current,
        sectionCard: {...current.sectionCard, english: 'a'.repeat(40)},
      },
      {...item, kind: 'blank'},
    );
    expect(element(longer, BROADCAST_LOOK_CARD_ID).frame.w).toBe(856);
  });
  it('leaves unrelated layouts untouched and keeps advertisements empty', () => {
    const layout = builtInTheme('ad').screens[screen];
    expect(layout).toEqual({
      mode: {kind: 'own'},
      elements: [],
    });
    if (!layout) throw Error('missing ad');
    expect(isBroadcastLook(layout)).toBe(false);
    const custom = {...plain(), elements: []};
    expect(isBroadcastLook(custom)).toBe(false);
  });
});
