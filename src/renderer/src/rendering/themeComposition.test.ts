import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import {DEFAULT_LYRIC_STYLE} from '@core/looks/lyricStyle';
import {createMediaId, createThemeId} from '@core/schema/ids';
import type {ThemeElement} from '@core/schema/themes';
import {
  fixedThemeText,
  themeElementBase,
  THEME_MAIN,
} from '@core/testing/themeOutput';
import type {RenderFrame, ThemeFrame} from './layer';
import {ThemeCompositionView} from './themeComposition';
import {OutputRenderer} from './outputRenderer';
import {classes} from './classes';
import {MAX_THEME_GAPS} from './themeGaps';
import {ThemeElementView} from './themeElement';

const song: LiveLayers = {
  ...emptyLayers(),
  slide: {
    itemId: 'invented',
    position: 0,
    label: 'Verse',
    lines: ['Invented line'],
    reference: 'Invented 1:1',
    next: {lines: ['Invented next'], label: 'Chorus'},
  },
};
const themeId = createThemeId('00000000-0000-4000-8000-000000000501');
const mediaId = createMediaId('00000000-0000-4000-8000-000000000601');

function frame(
  elements: readonly ThemeElement[],
  changes: Partial<ThemeFrame> = {},
): RenderFrame {
  return {
    screen: {id: THEME_MAIN, kind: 'audience'},
    theme: {
      themeId,
      revision: 1,
      missing: [],
      sourceScreenId: THEME_MAIN,
      emptyColor: '#123456',
      layout: {mode: {kind: 'own'}, elements},
      item: {
        id: 'invented',
        kind: 'song',
        source: 'service',
        title: 'Item name',
        memo: 'Stage memo',
      },
      ...changes,
    },
  };
}

function setup() {
  const root = document.createElement('div');
  const onError = vi.fn();
  const view = new ThemeCompositionView(root, {
    lyricStyle: DEFAULT_LYRIC_STYLE,
    mediaUrl: id => `https://media.test/${id}`,
    onError,
  });
  const text = (kind: string) =>
    root.querySelector(`[data-kind="${kind}"] .${classes.shown}`)?.textContent;
  return {root, view, onError, text};
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('theme composition drawing', () => {
  it.each(['output', 'preview'] as const)(
    'keeps a background video below later current text in %s',
    mode => {
      const root = document.createElement('div');
      const view = new ThemeCompositionView(root, {
        lyricStyle: DEFAULT_LYRIC_STYLE,
        mediaUrl: id => `https://media.test/${id}`,
        onError: vi.fn(),
        mode,
      });
      const elements: ThemeElement[] = [
        {...themeElementBase(), kind: 'background', fit: 'fit', radius: 0},
        {...themeElementBase(31), kind: 'currentText'},
      ];
      view.render(
        {...song, media: {mediaId, loop: true, startedAt: 1000}},
        frame(elements),
      );
      const background = root.querySelector<HTMLElement>(
        '[data-kind="background"]',
      );
      const lyrics = root.querySelector<HTMLElement>(
        '[data-kind="currentText"]',
      );
      const video = background?.querySelector<HTMLVideoElement>('video[src]');
      if (background == null || lyrics == null || video == null) {
        throw new Error('Missing composition');
      }
      video.dispatchEvent(new Event('playing'));
      expect(video.style.zIndex).toBe('1');
      expect(
        background.compareDocumentPosition(lyrics) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).not.toBe(0);
      expect(getComputedStyle(background).isolation).toBe('isolate');
      expect(getComputedStyle(lyrics).isolation).toBe('isolate');
      expect(lyrics.querySelector(`.${classes.shown}`)?.textContent).toBe(
        'Invented line',
      );
      view.dispose();
    },
  );
  it.each(['own', 'empty'] as const)(
    'updates the inherited empty color in %s mode without replacing the composition',
    kind => {
      const {root, view} = setup();
      const layout = {
        mode: {kind},
        elements: kind === 'own' ? [fixedThemeText()] : [],
      };
      view.render(emptyLayers(), frame([], {layout}));
      const page = root.querySelector<HTMLElement>('[data-theme-page]');
      expect(page?.style.backgroundColor).toBe('rgb(18, 52, 86)');
      view.render(emptyLayers(), frame([], {layout, emptyColor: '#654321'}));
      expect(root.querySelector('[data-theme-page]')).toBe(page);
      expect(page?.style.backgroundColor).toBe('rgb(101, 67, 33)');
      const override = {...layout, background: '#ABCDEF'};
      view.render(emptyLayers(), frame([], {layout: override}));
      const overridden = root.querySelector<HTMLElement>('[data-theme-page]');
      view.render(
        emptyLayers(),
        frame([], {layout: override, emptyColor: '#FF0000'}),
      );
      expect(overridden?.style.backgroundColor).toBe('rgb(171, 205, 239)');
      view.dispose();
    },
  );
  it('isolates a failing element and reports it once while the other elements keep drawing', () => {
    const {view, onError, text} = setup();
    const original = ThemeElementView.prototype.render;
    vi.spyOn(ThemeElementView.prototype, 'render').mockImplementation(function (
      this: ThemeElementView,
      ...args
    ) {
      if (this.element.id === themeElementBase().id) {
        throw new Error('Mock renderer failure');
      }
      original.apply(this, args);
    });
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'currentText'},
      fixedThemeText(),
    ];
    for (let i = 0; i < 20; i++) view.render(song, frame(elements));
    expect(text('text')).toBe('Invented fixed text');
    expect(onError).toHaveBeenCalledTimes(1);
    view.dispose();
  });
  it('draws bottom first, resolves live text sources, and retains only fixed text after clearing', () => {
    const {root, view, text} = setup();
    const elements: ThemeElement[] = [
      {
        ...themeElementBase(30),
        kind: 'box',
        box: {on: true, fill: '#000000', opacity: 40, radius: 12},
      },
      fixedThemeText(),
      ...(
        [
          'currentText',
          'reference',
          'nextText',
          'label',
          'nextLabel',
          'itemName',
          'memo',
        ] as const
      ).map((kind, i) => ({...themeElementBase(31 + i), kind})),
    ];
    view.render(song, frame(elements));
    expect(
      [...root.querySelectorAll('[data-kind]')].map(el =>
        el.getAttribute('data-kind'),
      ),
    ).toEqual(elements.map(el => el.kind));
    expect(text('currentText')).toBe('Invented line');
    expect(text('reference')).toBe('Invented 1:1');
    expect(text('nextText')).toBe('Invented next');
    expect(text('label')).toBe('Verse');
    expect(text('nextLabel')).toBe('Chorus');
    expect(text('itemName')).toBe('Item name');
    expect(text('memo')).toBe('Stage memo');
    const original = root.querySelector('[data-kind="text"]');
    view.render(
      emptyLayers(),
      frame(elements, {
        item: {
          id: 'invented',
          kind: 'song',
          source: 'service',
          contentCleared: true,
        },
      }),
    );
    expect(text('currentText')).toBeUndefined();
    expect(text('itemName')).toBeUndefined();
    expect(text('memo')).toBeUndefined();
    expect(text('text')).toBe('Invented fixed text');
    expect(root.querySelector('[data-kind="text"]')).toBe(original);
    expect(root.querySelector('[data-kind="box"]')).not.toBeNull();
    expect(root.querySelector<HTMLElement>('[data-kind="box"]')?.hidden).toBe(
      false,
    );
    view.dispose();
    expect(root.children).toHaveLength(0);
  });

  it('caps whole-screen transitions at two pages and releases decoders and timers after many changes', () => {
    const {root, view} = setup();
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'background', fit: 'fit', radius: 0},
      {...themeElementBase(31), kind: 'clock', clockFormat: '24h'},
    ];
    const layers = {...song, media: {mediaId, startedAt: 1000, loop: true}};
    for (let i = 1; i <= 100; i++) {
      view.render(
        layers,
        frame(elements, {
          themeId: createThemeId(
            `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          ),
        }),
      );
      expect(
        root.querySelectorAll('[data-theme-page]').length,
      ).toBeLessThanOrEqual(2);
      expect(root.querySelectorAll('video').length).toBeLessThanOrEqual(4);
      expect(
        [...root.querySelectorAll('video')].every(video => video.muted),
      ).toBe(true);
      vi.advanceTimersByTime(16);
    }
    vi.advanceTimersByTime(500);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    expect(root.querySelectorAll('video')).toHaveLength(2);
    view.dispose();
    expect(root.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('falls back to Pretendard, isolates missing media, and bounds resource logs until a theme edit', () => {
    const {root, view, onError, text} = setup();
    const elements: ThemeElement[] = [
      {
        ...themeElementBase(),
        kind: 'text',
        content: 'Visible fallback',
        text: {...themeElementBase().text, font: 'Missing family'},
      },
      {...themeElementBase(31), kind: 'image', mediaId, fit: 'fit', radius: 0},
    ];
    const current = {...frame(elements), fonts: []};
    view.render(song, current);
    const image = root.querySelector('img');
    for (let i = 0; i < 20; i++) {
      image?.dispatchEvent(new Event('error'));
      view.render(song, current);
    }
    expect(text('text')).toBe('Visible fallback');
    expect(
      root.querySelector(`.${classes.block}`)?.getAttribute('style'),
    ).toContain('Pretendard');
    expect(image?.hidden).toBe(true);
    expect(onError).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 100; i++) {
      view.render(song, frame(elements, {missing: [`missing:${i}`]}));
    }
    expect(onError).toHaveBeenCalledTimes(MAX_THEME_GAPS);
    view.render(song, {...frame(elements, {revision: 2}), fonts: []});
    expect(onError).toHaveBeenCalledTimes(MAX_THEME_GAPS + 1);
    view.dispose();
    expect(image?.getAttribute('src')).toBeNull();
    expect(image?.onerror).toBeNull();
  });

  it('ticks clock text without allocating pages and cancels its ticker when hidden', () => {
    const {root, view, text} = setup();
    let wall = Date.UTC(2026, 0, 1, 0);
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'clock', clockFormat: '24h'},
    ];
    view.render(song, {
      ...frame(elements),
      timers: {list: [], runs: undefined, now: () => ({wall, timer: 0})},
    });
    const first = text('clock');
    const shown = root.querySelector(`.${classes.shown}`);
    wall += 60_000;
    vi.advanceTimersByTime(250);
    expect(text('clock')).not.toBe(first);
    expect(root.querySelector(`.${classes.shown}`)).toBe(shown);
    view.render(song, {});
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    view.dispose();
  });

  it('keeps global layers above the theme in the specified order and preserves the legacy renderer', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    const root = document.createElement('div');
    const renderer = new OutputRenderer(root, {
      lyricStyle: DEFAULT_LYRIC_STYLE,
      mediaUrl: id => id,
      onError: vi.fn(),
    });
    const z = (kind: string) =>
      root.querySelector<HTMLElement>(`[data-layer="${kind}"]`)?.style.zIndex;
    renderer.render(song, frame([fixedThemeText()]));
    expect(z('theme')).toBe('1');
    expect(z('notice')).toBe('2');
    expect(z('prop')).toBe('3');
    expect(z('message')).toBe('4');
    expect(
      root
        .querySelector('[data-layer="lyrics"]')
        ?.classList.contains(classes.hidden),
    ).toBe(true);
    renderer.render(song, {});
    expect(
      root
        .querySelector('[data-layer="lyrics"]')
        ?.classList.contains(classes.hidden),
    ).toBe(false);
    expect(root.querySelector('[data-layer="lyrics"]')?.textContent).toContain(
      'Invented line',
    );
    renderer.dispose();
  });
});
