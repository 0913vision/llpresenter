import {mockBroadcastMeasure, mockBroadcastRect} from './broadcastMeasure';
import {styleBroadcastGlass} from '@renderer/rendering/themeElement';
import {broadcastBibleFlow} from '@renderer/rendering/broadcastBibleFlow';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {builtInTheme} from '@core/themes/defaults';
import {
  BROADCAST_REFERENCE_ID,
  BROADCAST_TEXT_ID,
} from '@core/themes/broadcastBand';
import {
  BROADCAST_LOOK_BAND_ID,
  BROADCAST_LOOK_TAB_ID,
  BROADCAST_LOOK_SONG_ID,
  BROADCAST_LOOK_SONG_TITLE_ID,
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
) => fitLook(layout, slide, {item});

beforeEach(() => {
  mockBroadcastMeasure(1.35);
  mockBroadcastRect();
});
afterEach(() => vi.restoreAllMocks());

describe('built-in broadcast look', () => {
  it('joins automatic Bible rows without losing typed line breaks', () => {
    expect(
      broadcastBibleFlow(['첫 자동 줄', '다음 자동 줄\n직접 입력한 줄']),
    ).toBe('첫 자동 줄 다음 자동 줄\n직접 입력한 줄');
    expect(broadcastBibleFlow(['첫 줄\n\n마지막 줄'])).toBe(
      '첫 줄\n\n마지막 줄',
    );
  });
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
    expect(oneText).toMatchObject({
      text: {size: 72, vAlign: 'middle'},
      frame: {h: 180},
    });
    expect(twoText).toMatchObject({text: {size: 72}, frame: {h: 180}});
    expect(element(two, BROADCAST_LOOK_BAND_ID).frame).toEqual(
      element(one, BROADCAST_LOOK_BAND_ID).frame,
    );
    for (const [rows, size] of [
      [2, 57],
      [3, 57],
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
    expect(element(nonBible, BROADCAST_LOOK_BAND_ID).frame.h).toBe(279);
  });
  it('keeps the box fixed for one to three rows and expands for four', () => {
    const rows = [1, 2, 3, 4].map(count =>
      fitBroadcastLook(
        plain(),
        {...slide, lines: Array(count).fill('one')},
        {...item, kind: 'blank'},
      ),
    );
    const [one, two, three, four] = rows;
    if (!one || !two || !three || !four) throw Error('missing fitted rows');
    const boxes = [one, two, three, four].map(layout =>
      element(layout, BROADCAST_LOOK_BAND_ID),
    );
    const [first, second, third, fourth] = boxes;
    if (!first || !second || !third || !fourth) throw Error('missing boxes');
    expect(boxes.map(box => box.frame.y + box.frame.h)).toEqual([
      1026, 1026, 1026, 1026,
    ]);
    expect(second.frame).toEqual(first.frame);
    expect(third.frame).toEqual(first.frame);
    expect(fourth.frame.h).toBeGreaterThan(third.frame.h);
    expect(element(three, BROADCAST_TEXT_ID)).toMatchObject({
      frame: {x: 90},
      text: {size: 57, color: '#1F1F1F'},
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
  it('shows the strip inside the box only for Bible slides', () => {
    const bible = fitBroadcastLook(
      plain(),
      {...slide, reference: 'John 3:16'},
      item,
    );
    const blank = fitBroadcastLook(plain(), slide, {...item, kind: 'blank'});
    const band = element(bible, BROADCAST_LOOK_BAND_ID);
    expect(element(bible, BROADCAST_LOOK_TAB_ID)).toMatchObject({
      frame: {x: 64, y: band.frame.y + 6, h: 58},
      runtimeHidden: false,
    });
    expect(element(bible, BROADCAST_REFERENCE_ID)).toMatchObject({
      frame: {x: 90},
      text: {size: 40, color: '#FFFFFF'},
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
      frame: {x: 0, y: 780, w: 1920, h: 260},
      box: {fill: '#000000', opacity: 100},
      runtimeHidden: false,
    });
    expect(element(result, BROADCAST_LOOK_SONG_ID)).toMatchObject({
      frame: {x: 160, y: 820, w: 1600, h: 180},
      text: {size: 72, align: 'center', color: '#FFFFFF'},
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
  it.each([
    '고요한 노래',
    '새벽의 노래',
    '기쁜 노래',
    '새찬송가 91장 슬픈 마음 있는 사람',
    '새찬송가 310장 아 하나님의 은혜로',
  ])('omits the lyric-band title for %s and retains its title slide', title => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const song = {
      ...item,
      kind: 'song' as const,
      title,
      broadcastSongTitle: title,
    };
    for (const songCaption of ['band', 'text'] as const) {
      const lyric = fitLook(
        layout,
        {...slide, lines: ['첫째 줄', '둘째 줄']},
        {item: song, songCaption},
      );
      expect(
        lyric.elements.some(e => e.id === BROADCAST_LOOK_SONG_TITLE_ID),
      ).toBe(false);
      expect(element(lyric, BROADCAST_LOOK_SONG_ID)).toMatchObject({
        frame: {x: 160, w: 1600},
        broadcastText: '첫째 줄\n둘째 줄',
      });
      const titleSlide = fitLook(
        layout,
        {...slide, titleSlide: true, lines: [title]},
        {item: song, songCaption},
      );
      expect(element(titleSlide, BROADCAST_LOOK_SONG_ID)).toMatchObject({
        broadcastText: title,
      });
    }
  });
  it('applies a resized Bible band and saved reference to the output', () => {
    const layout = plain();
    const bible = {...item, title: 'Reference'};
    const before = fitBroadcastLook(layout, slide, bible);
    const panel = element(before, BROADCAST_LOOK_BAND_ID);
    const reference = element(before, BROADCAST_REFERENCE_ID);
    const bandFrame = {
      ...panel.frame,
      y: panel.frame.y - 40,
      h: panel.frame.h + 40,
    };
    const referenceFrame = {
      ...reference.frame,
      x: reference.frame.x + 20,
      y: reference.frame.y,
    };
    const changed = {
      ...layout,
      broadcastEdits: {
        [panel.id]: {frame: bandFrame},
        [reference.id]: {frame: referenceFrame},
      },
    };
    const fitted = fitBroadcastLook(changed, slide, bible);
    expect(element(fitted, BROADCAST_LOOK_BAND_ID).frame).toEqual(bandFrame);
    expect(element(fitted, BROADCAST_REFERENCE_ID).frame).toEqual({
      ...referenceFrame,
      y: reference.frame.y - 40,
    });
    expect(element(fitted, BROADCAST_TEXT_ID).frame.y).toBe(
      element(before, BROADCAST_TEXT_ID).frame.y - 40,
    );
  });
  it('uses an edited band fill without retaining the built-in glass effect', () => {
    const layout = plain();
    const before = fitBroadcastLook(layout, slide, item);
    const panel = element(before, BROADCAST_LOOK_BAND_ID);
    if (panel.kind !== 'box') throw Error('Missing band');
    expect(panel).toHaveProperty('broadcastGlass', 'panel');
    const box = {...panel.box, fill: '#123456'};
    const result = fitBroadcastLook(
      {...layout, broadcastEdits: {[panel.id]: {box}}},
      slide,
      item,
    );
    expect(element(result, panel.id)).toMatchObject({box: {fill: '#123456'}});
    expect(element(result, panel.id)).not.toHaveProperty('broadcastGlass');
  });
  it('keeps the lyric line budget when applying text style overrides', () => {
    const layout = plain();
    const fitted = fitBroadcastLook(layout, slide, item);
    const body = element(fitted, BROADCAST_TEXT_ID);
    if (body.kind !== 'currentText') throw Error('Missing body');
    const changed = {
      ...layout,
      broadcastEdits: {[body.id]: {text: {...body.text, size: 70}}},
    };
    const result = element(
      fitBroadcastLook(changed, slide, item),
      BROADCAST_TEXT_ID,
    );
    expect(result).toMatchObject({
      kind: 'currentText',
      text: {size: 70, maxLines: body.text.maxLines},
    });
  });
  it('keeps a long Bible body below the header within an edited band', () => {
    const layout = plain();
    const bible = {...item, title: 'Reference'};
    const sample = fitBroadcastLook(layout, slide, bible);
    const band = element(sample, BROADCAST_LOOK_BAND_ID);
    const changed = {
      ...layout,
      broadcastEdits: {[band.id]: {frame: band.frame}},
    };
    const long = fitBroadcastLook(
      changed,
      {...slide, lines: ['first', 'second', 'third', 'fourth']},
      bible,
    );
    const panel = element(long, BROADCAST_LOOK_BAND_ID).frame;
    const tab = element(long, BROADCAST_LOOK_TAB_ID).frame;
    const body = element(long, BROADCAST_TEXT_ID).frame;
    expect(body.y).toBeGreaterThanOrEqual(tab.y + tab.h);
    expect(body.y + body.h).toBeLessThanOrEqual(panel.y + panel.h);
  });
  it('keeps lyrics in an edited song band without reviving saved title edits', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const song = {
      ...item,
      kind: 'song' as const,
      title: '새찬송가 91장 Song title',
    };
    const body = layout.elements.find(e => e.id === BROADCAST_LOOK_SONG_ID);
    if (body?.kind !== 'currentText') throw Error('missing lyric');
    const oldTitle = {
      ...body,
      id: BROADCAST_LOOK_SONG_TITLE_ID,
      kind: 'text' as const,
      content: song.title,
    };
    const band = element(
      fitBroadcastLook(layout, slide, song),
      BROADCAST_LOOK_BAND_ID,
    );
    const frame = {
      ...band.frame,
      x: 200,
      w: 1100,
      y: band.frame.y - 80,
      h: band.frame.h + 80,
    };
    const edited = {
      ...layout,
      elements: [...layout.elements, oldTitle],
      broadcastEdits: {
        [band.id]: {frame},
        [BROADCAST_LOOK_SONG_TITLE_ID]: {frame: {x: 96, y: 0, w: 340, h: 100}},
      },
    };
    for (const current of [slide, {...slide, lines: ['another', 'verse']}]) {
      const fitted = fitBroadcastLook(edited, current, song);
      expect(element(fitted, BROADCAST_LOOK_BAND_ID).frame).toEqual(frame);
      expect(
        fitted.elements.some(e => e.id === BROADCAST_LOOK_SONG_TITLE_ID),
      ).toBe(false);
      const lyric = element(fitted, BROADCAST_LOOK_SONG_ID).frame;
      expect(lyric.x).toBeGreaterThanOrEqual(frame.x);
      expect(lyric.x + lyric.w).toBeLessThanOrEqual(frame.x + frame.w);
      expect(lyric.y).toBeGreaterThanOrEqual(frame.y);
      expect(lyric.y + lyric.h).toBeLessThanOrEqual(frame.y + frame.h);
    }
  });
  it('keeps title slides while omitting a separate lyric title', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const song = {...item, kind: 'song' as const, title: '임재'};
    for (const current of [
      {
        ...slide,
        titleSlide: true as const,
        lines: ['임재', '하늘의 문을 여소서'],
      },
      {...slide, lines: ['임재']},
    ]) {
      const result = fitBroadcastLook(layout, current, song);
      expect(
        result.elements.some(e => e.id === BROADCAST_LOOK_SONG_TITLE_ID),
      ).toBe(false);
      const body = element(result, BROADCAST_LOOK_SONG_ID);
      if (!('broadcastText' in body)) throw Error('Missing broadcast text');
      expect(body.broadcastText).toContain('임재');
    }
    const lyric = fitBroadcastLook(
      layout,
      {...slide, lines: ['이곳에 임재하소서']},
      song,
    );
    expect(
      lyric.elements.some(e => e.id === BROADCAST_LOOK_SONG_TITLE_ID),
    ).toBe(false);
    expect(element(lyric, BROADCAST_LOOK_SONG_ID)).toMatchObject({
      frame: {x: 160, w: 1600},
      text: {align: 'center'},
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
    expect(body).toMatchObject({broadcastSong: 'text', text: {size: 72}});
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
        {...slide, lines: ['주 하나님', 'Hallelujah']},
        {item: {...item, kind: 'song'}, songCaption},
      );
      expect(element(result, BROADCAST_LOOK_SONG_ID)).toMatchObject({
        broadcastText: '주 하나님\nHallelujah',
        text: {size: 72},
      });
      expect(
        result.elements.filter(e => e.id === BROADCAST_REFERENCE_ID),
      ).toHaveLength(0);
    }
  });
  it('keeps an empty song slide empty even when the song has a title', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    for (const songCaption of ['band', 'text'] as const) {
      const result = fitLook(
        layout,
        {...slide, kind: 'song', label: 'Interlude', lines: []},
        {item: {...item, kind: 'song', title: 'Song title'}, songCaption},
      );
      expect(element(result, BROADCAST_LOOK_SONG_ID)).toMatchObject({
        broadcastText: '',
      });
      expect(element(result, BROADCAST_LOOK_BAND_ID)).toMatchObject({
        runtimeHidden: true,
      });
    }
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
