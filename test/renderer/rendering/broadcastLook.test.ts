import {mockBroadcastMeasure} from './broadcastMeasure';
import {styleBroadcastGlass} from '@renderer/rendering/themeElement';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {builtInTheme, createDefaultThemes} from '@core/themes/defaults';
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

beforeEach(() => mockBroadcastMeasure(1.35));
afterEach(() => vi.restoreAllMocks());

describe('built-in broadcast look', () => {
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
      text: {size: 48, color: '#1F1F1F'},
    });
    expect(element(four, BROADCAST_TEXT_ID)).toMatchObject({
      text: {size: 42},
    });
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
  it('puts songs and the empty slide title in a glass box and hides empty text', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    const song = {...item, kind: 'song' as const, title: 'Song title'};
    const result = fitBroadcastLook(
      layout,
      {...slide, lines: ['one', 'two']},
      song,
    );
    expect(element(result, BROADCAST_LOOK_BAND_ID)).toMatchObject({
      frame: {x: 120, w: 1680},
      runtimeHidden: false,
    });
    expect(element(result, BROADCAST_LOOK_SONG_ID)).toMatchObject({
      frame: {x: 160},
      text: {size: 56, align: 'left', color: '#1F1F1F'},
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
  it('sizes section cards to their longest text and renders the English uppercase', () => {
    const layout = createDefaultThemes().themes.find(
      t => t.id === SECTION_THEME_ID,
    )?.screens[screen];
    if (!layout) throw Error('missing card');
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
  it('leaves unrelated layouts untouched and links advertisements to the audience', () => {
    const layout = builtInTheme('ad').screens[screen];
    expect(layout).toEqual({
      mode: {kind: 'same', screen: createScreenId(STARTER_SCREEN_IDS.main)},
      elements: [],
    });
    if (!layout) throw Error('missing ad');
    expect(isBroadcastLook(layout)).toBe(false);
    const custom = {...plain(), elements: []};
    expect(isBroadcastLook(custom)).toBe(false);
  });
});
