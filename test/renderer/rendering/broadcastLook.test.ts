import {mockBroadcastMeasure, mockBroadcastRect} from './broadcastMeasure';
import {styleBroadcastGlass} from '@renderer/rendering/themeElement';
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
      text: {size: 38, color: '#FFFFFF'},
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
      box: {fill: '#000000', opacity: 70},
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
  it('keeps lyrics centered in a narrower box beside the song title', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const song = {
      ...item,
      kind: 'song' as const,
      title: '슬픈 마음 있는 사람',
      broadcastSongTitle: '새찬송가 91장 슬픈 마음 있는 사람',
    };
    const without = fitBroadcastLook(
      layout,
      {...slide, lines: ['첫째 줄', '둘째 줄']},
      {...song, title: '', broadcastSongTitle: ''},
    );
    const withTitle = fitBroadcastLook(
      layout,
      {...slide, lines: ['첫째 줄', '둘째 줄']},
      song,
    );
    expect(element(withTitle, BROADCAST_LOOK_SONG_ID).frame).toMatchObject({
      x: 460,
      w: 1000,
    });
    expect(element(without, BROADCAST_LOOK_SONG_ID).frame).toMatchObject({
      x: 160,
      w: 1600,
    });
    const band = element(withTitle, BROADCAST_LOOK_BAND_ID).frame;
    const baseline = element(without, BROADCAST_LOOK_BAND_ID).frame;
    const lyrics = element(withTitle, BROADCAST_LOOK_SONG_ID).frame;
    const title = element(withTitle, BROADCAST_LOOK_SONG_TITLE_ID).frame;
    expect(title.x + title.w).toBeLessThanOrEqual(lyrics.x);
    expect(title.y).toBe(band.y + 12);
    expect(lyrics.y).toBeGreaterThanOrEqual(band.y);
    expect(lyrics.y + lyrics.h).toBeLessThanOrEqual(band.y + band.h);
    expect(band.y + band.h).toBe(baseline.y + baseline.h);
    expect(band).toEqual(baseline);
    const titleSlide = fitBroadcastLook(
      layout,
      {...slide, titleSlide: true, lines: ['Song']},
      song,
    );
    expect(element(titleSlide, BROADCAST_LOOK_BAND_ID).frame).toEqual(band);
    expect(
      titleSlide.elements.some(e => e.id === BROADCAST_LOOK_SONG_TITLE_ID),
    ).toBe(false);
    expect(element(withTitle, BROADCAST_LOOK_SONG_TITLE_ID)).toMatchObject({
      content: '새찬송가 91장 슬픈 마음 있는 사람',
      frame: {x: 96, h: 220},
      text: {size: 48, weight: 600, color: '#E6E6E6', align: 'left'},
    });
    const textOnly = fitLook(layout, slide, {item: song, songCaption: 'text'});
    expect(
      textOnly.elements.some(e => e.id === BROADCAST_LOOK_SONG_TITLE_ID),
    ).toBe(false);
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
  it('persists a fixed song band and a separate title size across lyric slides', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const song = {
      ...item,
      kind: 'song' as const,
      title: '새찬송가 91장 Song title',
    };
    const initial = fitBroadcastLook(layout, slide, song);
    const band = element(initial, BROADCAST_LOOK_BAND_ID);
    const title = element(initial, BROADCAST_LOOK_SONG_TITLE_ID);
    if (title.kind !== 'text') throw Error('missing title');
    const frame = {...band.frame, y: band.frame.y - 80, h: band.frame.h + 80};
    const edited = {
      ...layout,
      broadcastEdits: {
        [band.id]: {frame},
        [title.id]: {text: {...title.text, size: 70}},
      },
    };
    for (const current of [slide, {...slide, lines: ['another', 'verse']}]) {
      const fitted = fitBroadcastLook(edited, current, song);
      expect(element(fitted, BROADCAST_LOOK_BAND_ID).frame).toEqual(frame);
      expect(element(fitted, BROADCAST_LOOK_SONG_TITLE_ID)).toMatchObject({
        frame: {y: frame.y + 12},
        text: {size: 70},
      });
      const lyric = element(fitted, BROADCAST_LOOK_SONG_ID).frame;
      expect(lyric.y).toBeGreaterThanOrEqual(frame.y);
      expect(lyric.y + lyric.h).toBeLessThanOrEqual(frame.y + frame.h);
    }
    expect(
      element(fitBroadcastLook(layout, slide, song), BROADCAST_LOOK_BAND_ID)
        .frame,
    ).toEqual(band.frame);
  });
  it('keeps both song elements within a narrower moved band', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const song = {
      ...item,
      kind: 'song' as const,
      title: '새찬송가 91장 Song title',
    };
    const base = fitBroadcastLook(layout, slide, song);
    const band = element(base, BROADCAST_LOOK_BAND_ID);
    const frame = {...band.frame, x: 200, w: 1100};
    const fitted = fitBroadcastLook(
      {...layout, broadcastEdits: {[band.id]: {frame}}},
      slide,
      song,
    );
    const lyric = element(fitted, BROADCAST_LOOK_SONG_ID).frame;
    const title = element(fitted, BROADCAST_LOOK_SONG_TITLE_ID).frame;
    expect(title.x).toBeGreaterThanOrEqual(frame.x);
    expect(title.x + title.w).toBeLessThanOrEqual(lyric.x);
    expect(lyric.x + lyric.w).toBeLessThanOrEqual(frame.x + frame.w);
  });
  it('limits long song captions to a single line with a readable minimum', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const song = {
      ...item,
      kind: 'song' as const,
      title: '새찬송가 91장 아주 긴 노래 제목 여러 줄로 보이지 않아야 합니다',
    };
    const title = element(
      fitBroadcastLook(layout, slide, song),
      BROADCAST_LOOK_SONG_TITLE_ID,
    );
    expect(title).toMatchObject({
      kind: 'text',
      broadcastSingleLine: true,
      minimumTextSize: 24,
      content: '새찬송가 91장 아주 긴 노래 제목 여러 줄로 보이지 않아야 합니다',
    });
  });
  it('shows the small song title only when the band is showing lyrics', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const song = {...item, kind: 'song' as const, title: '임재'};
    for (const current of [
      {...slide, lines: []},
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
        {...slide, lines: ['\uc8fc \ud558\ub098\ub2d8', 'Hallelujah']},
        {item: {...item, kind: 'song'}, songCaption},
      );
      expect(element(result, BROADCAST_LOOK_SONG_ID)).toMatchObject({
        broadcastText: '\uc8fc \ud558\ub098\ub2d8\nHallelujah',
        text: {size: 72},
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
