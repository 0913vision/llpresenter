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

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return Math.ceil(
        this.children.length * Number.parseFloat(this.style.fontSize) * 1.25,
      );
    },
  );
});
afterEach(() => vi.restoreAllMocks());

describe('built-in broadcast look', () => {
  it('grows its opaque bottom band, shrinking to 44 px after three rows', () => {
    const one = fitBroadcastLook(plain(), slide, {...item, kind: 'blank'});
    const four = fitBroadcastLook(
      plain(),
      {...slide, lines: ['one', 'two', 'three', 'four']},
      {...item, kind: 'blank'},
    );
    const a = element(one, BROADCAST_LOOK_BAND_ID);
    const b = element(four, BROADCAST_LOOK_BAND_ID);
    const body = element(four, BROADCAST_TEXT_ID);
    expect(a).toMatchObject({
      frame: {x: 0, w: 1824, h: 150, y: 930},
      box: {fill: '#106A84', opacity: 100},
    });
    expect(b.frame.h).toBeGreaterThan(a.frame.h);
    expect(b.frame.y + b.frame.h).toBe(1080);
    expect(body).toMatchObject({
      frame: {x: 67},
      text: {size: 44, align: 'left'},
    });
  });
  it('reports an unavailable canvas context instead of silently using zero widths', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() =>
      fitLook(plain(), {...slide, reference: 'John 3:16'}, {item}),
    ).toThrow('Cannot measure broadcast text: canvas context unavailable');
    expect(document.body.querySelector('[data-slide-measure]')).toBeNull();
  });
  it('places the reference tab above the band only for Bible slides', () => {
    const bible = fitBroadcastLook(
      plain(),
      {...slide, reference: 'John 3:16'},
      item,
    );
    const band = element(bible, BROADCAST_LOOK_BAND_ID);
    const tab = element(bible, BROADCAST_LOOK_TAB_ID);
    const ref = element(bible, BROADCAST_REFERENCE_ID);
    expect(tab).toMatchObject({
      frame: {x: 0, y: band.frame.y - 64, h: 64, w: 9 * 20 + 115},
      box: {fill: '#F7F8FC', opacity: 100},
      runtimeHidden: false,
    });
    expect(ref).toMatchObject({
      frame: {x: 67, y: tab.frame.y},
      text: {size: 36, color: '#1A1A1A'},
    });
    const blank = fitBroadcastLook(
      plain(),
      {...slide, reference: 'John 3:16'},
      {...item, kind: 'blank'},
    );
    expect(element(blank, BROADCAST_LOOK_TAB_ID)).toMatchObject({
      runtimeHidden: true,
    });
    expect(element(blank, BROADCAST_REFERENCE_ID)).toMatchObject({
      runtimeHidden: true,
    });
  });
  it('anchors outlined songs and the empty title at the same bottom, without any green box', () => {
    const layout = builtInTheme('song').screens[screen];
    if (!layout) throw Error('missing song');
    expect(layout.elements.map(e => e.kind)).toEqual(['currentText']);
    const song = {...item, kind: 'song' as const, title: '주 사랑'};
    for (const lines of [['one', 'two'], []]) {
      const result = fitBroadcastLook(layout, {...slide, lines}, song);
      const body = element(result, BROADCAST_LOOK_SONG_ID);
      expect(body.frame.y + body.frame.h).toBe(1004);
      expect(body).toMatchObject({
        text: {
          size: 64,
          align: 'center',
          outline: {on: true, width: 3},
          shadow: {on: true, blur: 0, opacity: 100},
        },
      });
      if (!lines.length) {
        expect(body).toMatchObject({broadcastText: '주 사랑'});
      }
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
      frame: {x: 0, w: 640},
      box: {fill: '#1D3A96'},
    });
    expect(element(result, BROADCAST_LOOK_CARD_ID).frame.w).toBe(640);
    expect(element(result, BROADCAST_REFERENCE_ID)).toMatchObject({
      kind: 'text',
      content: 'LONG SERMON',
      text: {size: 34, weight: 600},
    });
    const longer = fitBroadcastLook(
      layout,
      {
        ...current,
        sectionCard: {...current.sectionCard, english: 'a'.repeat(40)},
      },
      {...item, kind: 'blank'},
    );
    expect(element(longer, BROADCAST_LOOK_CARD_ID).frame.w).toBe(920);
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
