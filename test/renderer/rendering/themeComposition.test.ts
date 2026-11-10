import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {createMediaId, createScreenId, createThemeId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {builtInTheme} from '@core/themes/defaults';
import {
  BROADCAST_BAND_ID,
  BROADCAST_GEOMETRY,
} from '@core/themes/broadcastBand';
import type {ThemeElement} from '@core/schema/themes';
import {
  fixedThemeText,
  themeElementBase,
  THEME_MAIN,
} from '@fixtures/core/themeOutput';
import type {RenderFrame, ThemeFrame} from '@renderer/rendering/layer';
import {ThemeCompositionView} from '@renderer/rendering/themeComposition';
import {classes} from '@renderer/rendering/classes';
import {MAX_THEME_GAPS} from '@renderer/rendering/themeGaps';
import {bibleVerseTiles} from '@core/bible/bibleTiles';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {ThemeElementView} from '@renderer/rendering/themeElement';
import {followPlaybackProblems} from '@renderer/rendering/playbackProblem';
import {SECTION_THEME_ID} from '@core/themes/sundaySections';

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
    textStyle: DEFAULT_TEXT_STYLE,
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
  it('keeps the last good band after a measurement error and retries without leaking the host', () => {
    const layout =
      builtInTheme('song').screens[
        createScreenId(STARTER_SCREEN_IDS.broadcast)
      ];
    if (!layout) throw Error('Missing broadcast layout');
    const {root, view, onError, text} = setup();
    const failure = new Error('measurement failed');
    let failing = false;
    let attempts = 0;
    const height = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        if (this.closest('[data-slide-measure]') === null) return 0;
        attempts++;
        if (failing) throw failure;
        return Math.ceil(
          Number.parseFloat(this.style.fontSize) *
            BROADCAST_GEOMETRY.lineHeight *
            3,
        );
      });
    const activeFrame = {...frame(layout.elements), transitions: false};
    const hosts = () =>
      document.body.querySelectorAll('[data-slide-measure]').length;
    const before = hosts();
    try {
      view.render(song, activeFrame);
      const band = () =>
        root.querySelector<HTMLElement>(
          `[data-theme-element="${BROADCAST_BAND_ID}"]`,
        );
      const goodHeight = band()?.style.height;
      expect(Number.parseFloat(goodHeight ?? '')).toBeGreaterThan(
        BROADCAST_GEOMETRY.minHeight,
      );
      const changed = {
        ...song,
        slide: {
          ...song.slide,
          itemId: 'next',
          position: 1,
          label: null,
          lines: ['New line'],
        },
      };
      failing = true;
      expect(() => view.render(changed, activeFrame)).not.toThrow();
      expect(onError).toHaveBeenCalledWith(
        'could not fit the broadcast band',
        failure,
      );
      expect(band()?.style.height).toBe(goodHeight);
      expect(text('currentText')).toBe('New line');
      expect(hosts()).toBe(before);
      const empty = {...changed, slide: {...changed.slide, lines: ['']}};
      expect(() => view.render(empty, activeFrame)).not.toThrow();
      expect(band()?.hidden).toBe(true);
      expect(hosts()).toBe(before);
      const failedAttempts = attempts;
      failing = false;
      view.render(changed, activeFrame);
      expect(attempts).toBeGreaterThan(failedAttempts);
      expect(hosts()).toBe(before);
    } finally {
      view.dispose();
      height.mockRestore();
    }
  });
  it('uses the unfitted layout if the first band measurement fails', () => {
    const layout =
      builtInTheme('song').screens[
        createScreenId(STARTER_SCREEN_IDS.broadcast)
      ];
    if (!layout) throw Error('Missing broadcast layout');
    const {root, view, onError} = setup();
    const failure = new Error('measurement failed');
    const height = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        if (this.closest('[data-slide-measure]') !== null) throw failure;
        return 0;
      });
    try {
      expect(() =>
        view.render(song, {...frame(layout.elements), transitions: false}),
      ).not.toThrow();
      expect(onError).toHaveBeenCalledWith(
        'could not fit the broadcast band',
        failure,
      );
      expect(
        root.querySelector<HTMLElement>(
          `[data-theme-element="${BROADCAST_BAND_ID}"]`,
        )?.style.height,
      ).toBe(`${BROADCAST_GEOMETRY.minHeight}px`);
      expect(document.body.querySelector('[data-slide-measure]')).toBeNull();
    } finally {
      view.dispose();
      height.mockRestore();
    }
  });
  it('remeasures a broadcast band only when slide, layout or output size changes', () => {
    const layout =
      builtInTheme('song').screens[
        createScreenId(STARTER_SCREEN_IDS.broadcast)
      ];
    if (!layout) throw Error('Missing broadcast layout');
    const {root, view} = setup();
    const append = vi.spyOn(document.body, 'append');
    try {
      view.render(song, frame(layout.elements));
      view.render(song, frame(layout.elements));
      expect(append).toHaveBeenCalledTimes(1);
      const changed = {
        ...song,
        slide: {
          ...song.slide,
          itemId: 'second',
          position: 1,
          label: null,
          lines: ['Changed'],
        },
      };
      view.render(changed, frame(layout.elements));
      expect(append).toHaveBeenCalledTimes(2);
      view.render(
        changed,
        frame([
          ...layout.elements,
          {...themeElementBase(95), kind: 'text', content: 'extra'},
        ]),
      );
      expect(append).toHaveBeenCalledTimes(3);
      const themeRoot = root.querySelector<HTMLElement>('[data-layer="theme"]');
      if (!themeRoot) throw Error('Missing theme root');
      Object.defineProperty(themeRoot, 'clientWidth', {
        configurable: true,
        value: 1920,
      });
      view.render(
        changed,
        frame([
          ...layout.elements,
          {...themeElementBase(95), kind: 'text', content: 'extra'},
        ]),
      );
      expect(append).toHaveBeenCalledTimes(4);
    } finally {
      view.dispose();
      append.mockRestore();
    }
  });
  it('skips JSON keys when the layout and slide references are unchanged', () => {
    const layout =
      builtInTheme('song').screens[
        createScreenId(STARTER_SCREEN_IDS.broadcast)
      ];
    if (!layout) throw Error('Missing broadcast layout');
    const {view} = setup();
    const activeFrame = frame(layout.elements);
    const source = activeFrame.theme?.layout;
    const stringify = vi.spyOn(JSON, 'stringify');
    const keyCalls = () =>
      stringify.mock.calls.filter(
        call => Array.isArray(call[0]) && call[0][0] === source,
      ).length;
    try {
      view.render(song, activeFrame);
      expect(keyCalls()).toBe(1);
      view.render(song, activeFrame);
      expect(keyCalls()).toBe(1);
      const cloned = {
        ...song,
        slide: song.slide === null ? null : {...song.slide},
      };
      view.render(cloned, activeFrame);
      expect(keyCalls()).toBe(2);
      view.render(cloned, activeFrame);
      expect(keyCalls()).toBe(2);
    } finally {
      view.dispose();
      stringify.mockRestore();
    }
  });
  it.each(['dissolve', 'wipe', 'push', 'none'] as const)(
    'shares the %s transition between a new slide and its changed background after decoding',
    kind => {
      const {root, view} = setup();
      const elements: ThemeElement[] = [
        {...themeElementBase(), kind: 'background', fit: 'fill', radius: 0},
        {...themeElementBase(31), kind: 'currentText'},
      ];
      const first = {...song, media: {mediaId, startedAt: 1000, loop: true}};
      view.render(first, frame(elements));
      const outgoing = root.querySelector('[data-theme-page]');
      const nextId = createMediaId('00000000-0000-4000-8000-000000000602');
      const next = {
        ...first,
        media: {...first.media, mediaId: nextId},
        slide: {
          itemId: 'next-song',
          position: 0,
          label: null,
          lines: ['Next song'],
        },
      };
      view.render(next, {
        ...frame(elements),
        slide: next.slide,
        slideTransition: {kind, sec: 1.2},
        transitionTimes: {slideMs: 1200, backgroundMs: 50},
      });
      const pages = root.querySelectorAll<HTMLElement>('[data-theme-page]');
      expect(pages).toHaveLength(2);
      const incoming = pages[1];
      const animate = vi.fn(() => ({cancel: vi.fn()}));
      for (const page of pages) {
        Object.defineProperty(page, 'animate', {value: animate});
      }
      expect(incoming?.textContent).toBe('Next song');
      vi.advanceTimersByTime(1600);
      expect(incoming?.style.opacity).toBe('0');
      expect(root.contains(outgoing)).toBe(true);
      expect(animate).not.toHaveBeenCalled();
      root
        .querySelector(`video[src*="${nextId}"]`)
        ?.dispatchEvent(new Event('playing'));
      vi.advanceTimersByTime(32);
      expect(incoming?.style.opacity).toBe('1');
      expect(animate).toHaveBeenCalledTimes(kind === 'none' ? 0 : 2);
      if (kind !== 'none') {
        expect(animate).toHaveBeenLastCalledWith(expect.any(Array), {
          duration: 1200,
          easing: 'linear',
        });
        expect(root.contains(outgoing)).toBe(true);
        vi.advanceTimersByTime(1200);
      }
      expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
      view.dispose();
    },
  );

  it('keeps the player for an unchanged background and uses media timing for independent cues', () => {
    const {root, view} = setup();
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'background', fit: 'fill', radius: 0},
      {...themeElementBase(31), kind: 'currentText'},
    ];
    const first = {...song, media: {mediaId, startedAt: 1000, loop: true}};
    const instant = {...frame(elements), transitions: false};
    view.render(first, instant);
    const video = root.querySelector<HTMLVideoElement>('video[src]');
    video?.dispatchEvent(new Event('playing'));
    const next = {
      ...first,
      slide: {itemId: 'invented', position: 1, label: null, lines: ['Next']},
    };
    view.render(next, instant);
    expect(root.querySelector('video[src]')).toBe(video);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    const nextId = createMediaId('00000000-0000-4000-8000-000000000602');
    view.render(
      {...next, media: {...next.media, mediaId: nextId}},
      {
        ...frame(elements),
        transitionTimes: {slideMs: 1200, backgroundMs: 350},
      },
    );
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    root
      .querySelector(`video[src*="${nextId}"]`)
      ?.dispatchEvent(new Event('playing'));
    expect(root.querySelector('[data-kind="background"]')?.innerHTML).toContain(
      '350ms',
    );
    view.dispose();
  });

  it('replaces edited theme content synchronously without a leaving page or animation', () => {
    const {root, view} = setup();
    const element = {
      ...themeElementBase(),
      kind: 'text' as const,
      content: 'Before',
    };
    view.render(song, {...frame([element]), transitions: false});
    view.render(song, {
      ...frame([{...element, content: 'After'}]),
      transitions: false,
    });
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    expect(root.textContent).toBe('After');
    expect(vi.getTimerCount()).toBe(0);
    view.dispose();
  });

  it('keeps the outgoing picture when another slide arrives before the same pending background is ready', () => {
    const {root, view, text} = setup();
    let ready = true;
    vi.spyOn(ThemeElementView.prototype, 'ready').mockImplementation(
      () => ready,
    );
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'background', fit: 'fill', radius: 0},
      {...themeElementBase(31), kind: 'currentText'},
    ];
    view.render(song, frame(elements));
    const outgoing = root.querySelector('[data-theme-page]');
    ready = false;
    const layers = {
      ...song,
      media: {mediaId, loop: true, startedAt: 1000},
      slide: {itemId: 'next', position: 0, label: null, lines: ['First']},
    };
    view.render(layers, frame(elements));
    const loads = vi.mocked(HTMLMediaElement.prototype.load).mock.calls.length;
    view.render(
      {...layers, slide: {...layers.slide, position: 1, lines: ['Latest']}},
      {
        ...frame(elements),
        slideTransition: {kind: 'none', sec: 0.5},
      },
    );
    vi.advanceTimersByTime(32);
    expect(root.contains(outgoing)).toBe(true);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(2);
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(loads);
    ready = true;
    vi.advanceTimersByTime(32);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    expect(text('currentText')).toBe('Latest');
    view.dispose();
  });

  it('keeps the outgoing page when decoding finishes before the latest slide arrives and animation has not started', () => {
    const {root, view, text} = setup();
    let ready = true;
    vi.spyOn(ThemeElementView.prototype, 'ready').mockImplementation(
      () => ready,
    );
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'background', fit: 'fill', radius: 0},
      {...themeElementBase(31), kind: 'currentText'},
    ];
    view.render(song, frame(elements));
    ready = false;
    const layers = {
      ...song,
      media: {mediaId, loop: true, startedAt: 1000},
      slide: {itemId: 'next', position: 0, label: null, lines: ['First']},
    };
    view.render(layers, {
      ...frame(elements),
      slideTransition: {kind: 'dissolve', sec: 4},
    });
    const pages = root.querySelectorAll<HTMLElement>('[data-theme-page]');
    const outgoing = pages[0];
    const incoming = pages[1];
    const animate = vi.fn(() => ({cancel: vi.fn()}));
    for (const page of pages) {
      Object.defineProperty(page, 'animate', {value: animate});
    }
    const loads = vi.mocked(HTMLMediaElement.prototype.load).mock.calls.length;
    ready = true;
    view.render(
      {...layers, slide: {...layers.slide, position: 1, lines: ['Latest']}},
      {...frame(elements), slideTransition: {kind: 'push', sec: 1.2}},
    );
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(2);
    expect(root.contains(outgoing ?? null)).toBe(true);
    expect(incoming?.style.opacity).toBe('0');
    expect(animate).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(loads);
    vi.advanceTimersByTime(32);
    expect(incoming?.style.opacity).toBe('1');
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenLastCalledWith(
      [{transform: 'translateX(100%)'}, {transform: 'translate(0)'}],
      {duration: 1200, easing: 'linear'},
    );
    expect(root.contains(outgoing ?? null)).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    expect(text('currentText')).toBe('Latest');
    view.dispose();
  });

  it('keeps the media transition when a media cue also changes the theme', () => {
    const {root, view} = setup();
    const element = {...themeElementBase(), kind: 'currentText' as const};
    view.render(song, frame([element]));
    view.render(song, {
      ...frame([element], {
        themeId: createThemeId('00000000-0000-4000-8000-000000000502'),
        item: {id: 'cue', kind: 'media', source: 'service'},
      }),
      slideTransition: {kind: 'push', sec: 4},
      transitionTimes: {slideMs: 4000, backgroundMs: 350},
    });
    const incoming = root.querySelectorAll<HTMLElement>('[data-theme-page]')[1];
    expect(incoming?.style.transition).toContain('350ms');
    vi.advanceTimersByTime(400);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    view.dispose();
  });

  it('reports active resource failures without output text and retires recovered or removed owners', async () => {
    const {root, view} = setup();
    const report = vi.fn();
    const stop = followPlaybackProblems(root, report);
    const elements: ThemeElement[] = [
      {
        ...themeElementBase(),
        kind: 'text',
        content: 'Fallback text',
        text: {...themeElementBase().text, font: 'Missing family'},
      },
      {...themeElementBase(31), kind: 'image', mediaId, fit: 'fit', radius: 0},
    ];
    view.render(song, {
      ...frame(elements, {missing: ['missing-theme']}),
      fonts: [],
      transitions: false,
    });
    const image = root.querySelector('img');
    image?.dispatchEvent(new Event('error'));
    expect(report).toHaveBeenLastCalledWith([
      'font-missing',
      'media-missing',
      'theme-missing',
    ]);
    expect(root.textContent).toBe('Fallback text');
    image?.dispatchEvent(new Event('load'));
    expect(image?.hidden).toBe(false);
    view.render(song, {...frame(elements), fonts: [], transitions: false});
    expect(report).toHaveBeenLastCalledWith(['font-missing']);
    view.render(song, {screen: {id: THEME_MAIN, kind: 'audience'}});
    await Promise.resolve();
    expect(report).toHaveBeenLastCalledWith([]);
    stop();
    view.dispose();
  });
  it('draws the split guide at a moved three-line text box and marks its overflow', () => {
    const root = document.createElement('div');
    const element: ThemeElement = {
      ...themeElementBase(),
      kind: 'currentText',
      frame: {x: 140, y: 200, w: 1400, h: 600},
      text: {
        ...themeElementBase().text,
        size: 80,
        lineHeight: 1.5,
        maxLines: 3,
        vAlign: 'middle',
      },
    };
    const view = new ThemeCompositionView(root, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl: id => id,
      onError: vi.fn(),
      biblePreview: {elementId: element.id, maxLines: 3},
    });
    const content = {
      ...song,
      slide: {
        itemId: 'split',
        position: 0,
        label: null,
        lines: ['One', 'Two', 'Three', 'Four'],
      },
    };
    view.render(content, frame([element]));
    const box = root.querySelector<HTMLElement>('[data-kind="currentText"]');
    expect(box?.style.left).toBe('140px');
    expect(box?.style.top).toBe('200px');
    expect(box?.style.height).toBe('600px');
    const guideArea = box?.querySelector(
      `.${classes.bibleGuide}`,
    )?.parentElement;
    expect(guideArea?.style.top).toBe('120px');
    expect(guideArea?.style.height).toBe('360px');
    expect(box?.style.overflow).toBe('visible');
    expect(box?.dataset['overflow']).toBe('true');
    expect(box?.querySelector(`.${classes.bibleGuide}`)).not.toBeNull();
    expect(box?.querySelector(`.${classes.bibleOverflow}`)?.textContent).toBe(
      'Four',
    );
    view.render(
      {...content, slide: {...content.slide, lines: ['One']}},
      frame([element]),
    );
    expect(box?.dataset['overflow']).toBe('false');
    expect(
      box?.querySelector(`.${classes.shown} .${classes.bibleOverflow}`),
    ).toBeNull();
    view.dispose();
    expect(root.querySelector('[data-kind="currentText"]')).toBeNull();
  });
  it('draws the full Bible reference and translation on the screen reference element', () => {
    const {view, text} = setup();
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'reference'},
    ];
    const [tile] = bibleVerseTiles(
      {...panelPassage(), translationLabel: '개역한글'},
      {reference: 'every', split: 'two', translationName: true},
    );
    if (!tile) throw Error('Missing Bible tile');
    view.render(
      {...emptyLayers(), slide: {...tile, itemId: 'bible:sample', position: 0}},
      frame(elements),
    );
    expect(text('reference')).toBe('요한복음 3:16 (개역한글)');
    view.dispose();
  });
  it.each(['output', 'preview'] as const)(
    'keeps a background video below later current text in %s',
    mode => {
      const root = document.createElement('div');
      const view = new ThemeCompositionView(root, {
        textStyle: DEFAULT_TEXT_STYLE,
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
      const video = background?.querySelector<
        HTMLVideoElement | HTMLImageElement
      >(mode === 'preview' ? 'img[src]' : 'video[src]');
      if (background == null || lyrics == null || video == null) {
        throw new Error('Missing composition');
      }
      video.dispatchEvent(new Event(mode === 'preview' ? 'load' : 'playing'));
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
      const overridden = [
        ...root.querySelectorAll<HTMLElement>('[data-theme-page]'),
      ].at(-1);
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

  it('gives the lyric elements the 슬라이드 전환 time and leaves the other texts at the default', () => {
    const {root, view} = setup();
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'currentText'},
      {...themeElementBase(31), kind: 'clock', clockFormat: '24h'},
    ];
    view.render(song, {
      ...frame(elements),
      transitionTimes: {slideMs: 900, backgroundMs: 500},
    });
    const times = [...root.querySelectorAll<HTMLElement>('[data-kind]')].map(
      box => [
        box.getAttribute('data-kind'),
        box
          .querySelector<HTMLElement>(`.${classes.layer}`)
          ?.style.getPropertyValue('--slide-dissolve'),
      ],
    );
    expect(times).toEqual([
      ['currentText', '900ms'],
      ['clock', '200ms'],
    ]);
    view.dispose();
  });

  it('fades a changed 테마 for the 슬라이드 전환 time, and cuts for 0', () => {
    const {root, view} = setup();
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'clock', clockFormat: '24h'},
    ];
    const next = (themeNumber: number, slideMs: number) =>
      ({
        ...frame(elements, {
          themeId: createThemeId(
            `00000000-0000-4000-8000-${String(themeNumber).padStart(12, '0')}`,
          ),
        }),
        transitionTimes: {slideMs, backgroundMs: 500},
      }) satisfies RenderFrame;
    view.render(song, next(1, 1000));
    view.render(song, next(2, 1000));
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(2);
    expect(
      [...root.querySelectorAll<HTMLElement>('[data-theme-page]')].some(page =>
        page.style.transition.includes('1000ms'),
      ),
    ).toBe(true);
    vi.advanceTimersByTime(1100);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    view.render(song, next(3, 0));
    vi.advanceTimersByTime(32);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    view.dispose();
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
      root
        .querySelectorAll('video[src]')
        .forEach(video => video.dispatchEvent(new Event('playing')));
      vi.advanceTimersByTime(16);
    }
    vi.advanceTimersByTime(500);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    expect(root.querySelectorAll('video')).toHaveLength(2);
    view.dispose();
    expect(root.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['none', 'push'] as const)(
    'interrupts a four-second theme wipe for the next slide with %s',
    kind => {
      const {root, view, text, onError} = setup();
      const elements: ThemeElement[] = [
        {...themeElementBase(), kind: 'currentText'},
      ];
      view.render(song, frame(elements));
      const incoming = {
        ...song,
        slide: {
          itemId: 'incoming',
          position: 0,
          label: null,
          lines: ['Incoming title'],
        },
      };
      const incomingFrame: RenderFrame = {
        ...frame(elements, {
          themeId: createThemeId('00000000-0000-4000-8000-000000000502'),
        }),
        slide: incoming.slide,
        slideTransition: {kind: 'wipe', dir: 'left', sec: 4},
        transitionTimes: {slideMs: 4000, backgroundMs: 500},
      };
      view.render(incoming, incomingFrame);
      const cancel = vi.fn();
      const animate = vi.fn(() => ({cancel}));
      for (const page of root.querySelectorAll(
        `[data-theme-page], .${classes.page}`,
      )) {
        Object.defineProperty(page, 'animate', {value: animate});
      }
      vi.advanceTimersByTime(1000);
      expect(animate).toHaveBeenCalledTimes(2);
      expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(2);
      view.render(incoming, {...incomingFrame, stageMessage: 'Unrelated'});
      expect(cancel).not.toHaveBeenCalled();

      const next = {
        ...incoming,
        slide: {...incoming.slide, position: 1, lines: ['Next lyrics']},
      };
      view.render(next, {
        ...incomingFrame,
        slide: next.slide,
        slideTransition: {kind, sec: 0.5},
        transitionTimes: {
          slideMs: kind === 'none' ? 0 : 500,
          backgroundMs: 500,
        },
      });

      expect(cancel).toHaveBeenCalledTimes(2);
      expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
      expect(
        root.querySelector<HTMLElement>('[data-theme-page]')?.style.opacity,
      ).toBe('1');
      expect(text('currentText')).toBe('Next lyrics');
      expect(animate).toHaveBeenCalledTimes(kind === 'none' ? 2 : 4);
      if (kind === 'push') {
        expect(animate).toHaveBeenLastCalledWith(expect.any(Array), {
          duration: 500,
          easing: 'linear',
        });
      }
      expect(vi.getTimerCount()).toBe(0);
      expect(onError).not.toHaveBeenCalled();
      view.dispose();
    },
  );

  it('keeps the opaque outgoing picture until the new composition can draw, with no child fade from empty', () => {
    const {root, view} = setup();
    let ready = true;
    vi.spyOn(ThemeElementView.prototype, 'ready').mockImplementation(
      () => ready,
    );
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'currentText'},
    ];
    view.render(song, frame(elements));
    const outgoing = root.querySelector<HTMLElement>('[data-theme-page]');
    ready = false;
    view.render(
      {
        ...song,
        slide: {
          itemId: 'invented',
          position: 1,
          label: null,
          lines: ['Incoming text'],
        },
      },
      frame(elements, {
        themeId: createThemeId('00000000-0000-4000-8000-000000000502'),
      }),
    );
    const incoming = [
      ...root.querySelectorAll<HTMLElement>('[data-theme-page]'),
    ].at(-1);
    expect(incoming?.style.opacity).toBe('0');
    expect(incoming?.querySelector(`.${classes.shown}`)?.textContent).toBe(
      'Incoming text',
    );
    expect(
      incoming?.querySelector(`.${classes.instant} .${classes.shown}`),
    ).not.toBeNull();
    vi.advanceTimersByTime(1000);
    expect(root.contains(outgoing)).toBe(true);
    expect(outgoing?.style.opacity).not.toBe('0');
    expect(incoming?.style.opacity).toBe('0');
    ready = true;
    vi.advanceTimersByTime(32);
    expect(incoming?.style.opacity).toBe('1');
    expect(root.contains(outgoing)).toBe(true);
    expect(outgoing?.style.opacity).not.toBe('0');
    vi.advanceTimersByTime(250);
    expect(root.contains(outgoing)).toBe(true);
    vi.advanceTimersByTime(250);
    expect(root.contains(outgoing)).toBe(false);
    view.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])(
    'stops outgoing media when disabling during a theme transition with incoming ready=%s',
    incomingReady => {
      const {root, view} = setup();
      const background: ThemeElement = {
        ...themeElementBase(),
        kind: 'background',
        fit: 'fit',
        radius: 0,
      };
      const layers = {...song, media: {mediaId, loop: true, startedAt: 1000}};
      view.render(layers, frame([background]));
      const outgoing = root.querySelector('[data-theme-page]');
      const outgoingVideo = root.querySelector<HTMLVideoElement>('video[src]');
      if (outgoingVideo === null) throw new Error('Missing outgoing player');
      outgoingVideo.dispatchEvent(new Event('playing'));
      const nextId = createMediaId('00000000-0000-4000-8000-000000000602');
      const nextLayers = {...layers, media: {...layers.media, mediaId: nextId}};
      const nextFrame = {
        ...frame([background], {
          themeId: createThemeId('00000000-0000-4000-8000-000000000502'),
        }),
        transitionTimes: {slideMs: 1000, backgroundMs: 500},
      };
      view.render(nextLayers, nextFrame);
      const incomingVideo = root.querySelector<HTMLVideoElement>(
        `video[src*="${nextId}"]`,
      );
      if (incomingVideo === null) throw new Error('Missing incoming player');
      if (incomingReady) incomingVideo.dispatchEvent(new Event('playing'));
      vi.advanceTimersByTime(32);
      expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(2);
      expect(root.contains(outgoing)).toBe(true);
      expect(view.ready()).toBe(incomingReady);

      view.render(nextLayers, {...nextFrame, standby: true});

      expect(root.contains(outgoing)).toBe(false);
      expect(outgoingVideo.hasAttribute('src')).toBe(false);
      expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
      expect(root.querySelector('[data-theme-page]')?.classList).toContain(
        classes.instant,
      );
      expect(
        root.querySelector<HTMLElement>('[data-theme-page]')?.style.transition,
      ).toBe('none');
      expect(
        root.querySelector<HTMLElement>('[data-theme-page]')?.style.opacity,
      ).toBe('1');
      expect(incomingVideo.hasAttribute('src')).toBe(true);
      expect(view.ready()).toBe(incomingReady);
      expect(vi.getTimerCount()).toBe(0);
      const plays = vi.mocked(HTMLMediaElement.prototype.play).mock.calls
        .length;
      const loads = vi.mocked(HTMLMediaElement.prototype.load).mock.calls
        .length;
      vi.advanceTimersByTime(5000);
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(plays);
      expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(loads);
      expect(vi.getTimerCount()).toBe(0);
      view.dispose();
    },
  );

  it('reuses a retained background decoder and playback position across theme layouts', () => {
    const {root, view, onError} = setup();
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'background', fit: 'fit', radius: 0},
      {...themeElementBase(31), kind: 'currentText'},
    ];
    const layers = {...song, media: {mediaId, loop: true, startedAt: 1000}};
    view.render(layers, frame(elements));
    const video = root.querySelector<HTMLVideoElement>('video[src]');
    if (video === null) throw new Error('Missing background player');
    video.dispatchEvent(new Event('playing'));
    video.currentTime = 7;
    const playCount = vi.mocked(HTMLMediaElement.prototype.play).mock.calls
      .length;
    view.render(
      layers,
      frame(elements, {
        themeId: createThemeId('00000000-0000-4000-8000-000000000503'),
      }),
    );
    vi.advanceTimersByTime(532);
    expect(root.querySelector('video[src]')).toBe(video);
    expect(root.querySelectorAll('video')).toHaveLength(2);
    expect(video.currentTime).toBe(7);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(playCount);
    const nextMedia = createMediaId('00000000-0000-4000-8000-000000000602');
    view.render(
      {...layers, media: {...layers.media, mediaId: nextMedia}},
      frame(elements, {
        themeId: createThemeId('00000000-0000-4000-8000-000000000503'),
      }),
    );
    root
      .querySelector(`video[src*="${nextMedia}"]`)
      ?.dispatchEvent(new Event('error'));
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining(nextMedia),
      expect.objectContaining({id: nextMedia}),
    );
    view.dispose();
    expect(video.getAttribute('src')).toBeNull();
    vi.advanceTimersByTime(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retains the playing decoder when a slow incoming theme is superseded', () => {
    const {root, view} = setup();
    const background: ThemeElement = {
      ...themeElementBase(),
      kind: 'background',
      fit: 'fit',
      radius: 0,
    };
    const layers = {...song, media: {mediaId, loop: true, startedAt: 1000}};
    view.render(layers, frame([background]));
    const video = root.querySelector<HTMLVideoElement>('video[src]');
    if (video === null) throw new Error('Missing player');
    video.dispatchEvent(new Event('playing'));
    const plays = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;
    view.render(
      layers,
      frame(
        [
          background,
          {
            ...themeElementBase(32),
            kind: 'image',
            mediaId,
            fit: 'fit',
            radius: 0,
          },
        ],
        {
          themeId: createThemeId('00000000-0000-4000-8000-000000000504'),
        },
      ),
    );
    expect(view.ready()).toBe(false);
    view.render(
      layers,
      frame([background], {
        themeId: createThemeId('00000000-0000-4000-8000-000000000505'),
      }),
    );
    vi.advanceTimersByTime(250);
    expect(root.querySelector('video[src]')).toBe(video);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(plays);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(2);
    vi.advanceTimersByTime(282);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    view.dispose();
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

  it('holds standby clock text without ticking and resumes it when enabled', () => {
    const {view, text} = setup();
    let wall = Date.UTC(2026, 0, 1, 0);
    const content = {
      ...frame([{...themeElementBase(), kind: 'clock', clockFormat: '24h'}]),
      standby: true,
      timers: {list: [], runs: undefined, now: () => ({wall, timer: 0})},
    };
    view.render(song, content);
    const first = text('clock');
    wall += 60_000;
    vi.advanceTimersByTime(2500);
    expect(text('clock')).toBe(first);
    expect(vi.getTimerCount()).toBe(0);
    view.render(song, {...content, standby: false});
    expect(text('clock')).not.toBe(first);
    view.dispose();
    expect(vi.getTimerCount()).toBe(0);
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

  it('leaves every idle node untouched and changes only the timed element whose text changed', () => {
    const {root, view, text} = setup();
    let wall = Date.UTC(2026, 0, 1, 0);
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'currentText'},
      {...themeElementBase(31), kind: 'clock', clockFormat: '24h'},
    ];
    view.render(song, {
      ...frame(elements),
      transitions: false,
      timers: {list: [], runs: undefined, now: () => ({wall, timer: 0})},
    });
    const observer = new MutationObserver(() => undefined);
    observer.observe(root, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    const staticBox = root.querySelector('[data-kind="currentText"]');
    const first = text('clock');
    vi.advanceTimersByTime(750);
    expect(observer.takeRecords()).toEqual([]);
    wall += 60_000;
    vi.advanceTimersByTime(250);
    expect(text('clock')).not.toBe(first);
    const mutations = observer.takeRecords();
    expect(mutations.length).toBeGreaterThan(0);
    expect(mutations.every(record => !staticBox?.contains(record.target))).toBe(
      true,
    );
    expect(mutations.some(record => record.attributeName === 'hidden')).toBe(
      false,
    );
    observer.disconnect();
    view.dispose();
  });
});

it('caps next text against the fitted current size for varied slide pairs', () => {
  const {view} = setup();
  const size = vi.spyOn(ThemeElementView.prototype, 'fittedTextSize');
  const cap = vi.spyOn(ThemeElementView.prototype, 'capTextSize');
  const current = {...themeElementBase(), kind: 'currentText' as const};
  const next = {...themeElementBase(31), kind: 'nextText' as const};
  for (const [lines, nextLines, fitted] of [
    [['short'], ['long long long'], 90],
    [['long long long'], ['short'], 42],
    [['one', 'two', 'three', 'four'], ['short'], 72],
  ] as const) {
    size.mockReturnValue(fitted);
    view.render(
      {
        ...song,
        slide: {
          itemId: 'invented',
          position: 0,
          label: null,
          lines: [...lines],
          next: {lines: [...nextLines], label: null},
        },
      },
      frame([current, next]),
    );
    expect(cap).toHaveBeenLastCalledWith((fitted * 2) / 3);
  }
  cap.mockClear();
  size.mockReturnValue(undefined);
  view.render(song, frame([current, next]));
  size.mockReturnValue(NaN);
  view.render(song, frame([current, next]));
  expect(cap).toHaveBeenCalledTimes(2);
  expect(cap).toHaveBeenNthCalledWith(1, undefined);
  expect(cap).toHaveBeenNthCalledWith(2, undefined);
  cap.mockClear();
  size.mockReturnValue(90);
  view.render(song, frame([current]));
  expect(cap).not.toHaveBeenCalled();
  size.mockRestore();
  cap.mockRestore();
  view.dispose();
});

it('caps section stage next text against the Korean item name, not its English subtitle', () => {
  const {view} = setup();
  const size = vi
    .spyOn(ThemeElementView.prototype, 'fittedTextSize')
    .mockImplementation(function (this: ThemeElementView) {
      return this.element.kind === 'itemName' ? 120 : 42;
    });
  const cap = vi.spyOn(ThemeElementView.prototype, 'capTextSize');
  const elements: ThemeElement[] = [
    {...themeElementBase(), kind: 'itemName'},
    {...themeElementBase(31), kind: 'currentText'},
    {...themeElementBase(32), kind: 'nextText'},
  ];
  const stageFrame = frame(elements);
  if (!stageFrame.theme) throw Error('missing theme');
  view.render(song, {
    ...stageFrame,
    screen: {id: THEME_MAIN, kind: 'stage'},
    theme: {...stageFrame.theme, themeId: SECTION_THEME_ID},
  });
  expect(cap).toHaveBeenLastCalledWith(80);
  cap.mockRestore();
  size.mockRestore();
  view.dispose();
});

it.each(['missing', 'hidden', 'invalid'] as const)(
  'falls back to current text when the stage section title is %s',
  state => {
    const {view} = setup();
    const size = vi
      .spyOn(ThemeElementView.prototype, 'fittedTextSize')
      .mockImplementation(function (this: ThemeElementView) {
        if (this.element.kind === 'itemName') {
          return state === 'invalid' ? NaN : undefined;
        }
        return 42;
      });
    const cap = vi.spyOn(ThemeElementView.prototype, 'capTextSize');
    const elements: ThemeElement[] = [
      ...(state === 'missing'
        ? []
        : [{...themeElementBase(), kind: 'itemName' as const}]),
      {...themeElementBase(31), kind: 'currentText'},
      {...themeElementBase(32), kind: 'nextText'},
    ];
    const stageFrame = frame(elements);
    if (!stageFrame.theme) throw Error('missing theme');
    view.render(song, {
      ...stageFrame,
      screen: {id: THEME_MAIN, kind: 'stage'},
      theme: {...stageFrame.theme, themeId: SECTION_THEME_ID},
    });
    expect(cap).toHaveBeenLastCalledWith(28);
    cap.mockRestore();
    size.mockRestore();
    view.dispose();
  },
);
