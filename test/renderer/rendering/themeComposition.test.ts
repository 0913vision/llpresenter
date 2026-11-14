import type {Theme, ThemesFile} from '@core/schema/themes';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {createMediaId, createScreenId, createThemeId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {
  builtInTheme as currentBuiltInTheme,
  createDefaultThemes as currentDefaultThemes,
  DEFAULT_THEME_TEXT,
} from '@core/themes/defaults';
import {broadcastBandLayout} from '@core/themes/broadcastBand';
import {
  broadcastLookLayout,
  BROADCAST_LOOK_BAND_ID,
  BROADCAST_LOOK_TAB_ID,
  BROADCAST_LOOK_SONG_ID,
} from '@core/themes/broadcastLook';
import {sectionOtherLayout} from '@core/themes/sundaySections';
import type {ThemeItemKind} from '@core/themes/elementRules';
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
import {
  SECTION_BAND_ID,
  SECTION_NAME_ID,
  sectionBroadcastLayout,
} from '@core/themes/sectionBroadcast';

function builtInTheme(kind: ThemeItemKind): Theme {
  const theme = currentBuiltInTheme(kind);
  const id = createScreenId(STARTER_SCREEN_IDS.broadcast);
  return {
    ...theme,
    screens: {
      ...theme.screens,
      [id]: broadcastBandLayout(kind, DEFAULT_THEME_TEXT),
    },
  };
}
function createDefaultThemes(): ThemesFile {
  const file = currentDefaultThemes();
  const id = createScreenId(STARTER_SCREEN_IDS.broadcast);
  return {
    ...file,
    themes: file.themes.map(theme =>
      theme.id === SECTION_THEME_ID
        ? {
            ...theme,
            screens: {
              ...theme.screens,
              [id]: sectionOtherLayout(
                broadcastBandLayout('blank', DEFAULT_THEME_TEXT),
                'broadcast',
              ),
            },
          }
        : theme,
    ),
  };
}

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

function setup(transparent = false) {
  const root = document.createElement('div');
  const onError = vi.fn();
  const view = new ThemeCompositionView(root, {
    textStyle: DEFAULT_TEXT_STYLE,
    transparent,
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
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('theme composition drawing', () => {
  it.each(['same', 'different'] as const)(
    'uses one full-page wipe with %s background',
    background => {
      const {root, view} = setup();
      const render = vi.spyOn(ThemeElementView.prototype, 'render');
      const base = frame([
        {...themeElementBase(), kind: 'background', fit: 'fill', radius: 0},
        {...themeElementBase(31), kind: 'currentText'},
      ]);
      const effect = {kind: 'wipe' as const, sec: 1};
      if (song.slide === null) throw new Error('Missing slide');
      view.render(song, {...base, slideTransition: effect});
      const incoming = {
        ...song,
        slide: {...song.slide, position: 1, lines: ['Next']},
        ...(background === 'same' ? {} : {media: null}),
      };
      view.render(incoming, {...base, slideTransition: effect});
      const pages = root.querySelectorAll<HTMLElement>('[data-theme-page]');
      expect(pages).toHaveLength(2);
      for (const page of pages) {
        expect(page.querySelector('[data-kind="background"]')).not.toBeNull();
        expect(page.querySelector('[data-kind="currentText"]')).not.toBeNull();
      }
      expect(
        render.mock.calls.every(([, frame]) => frame.transitions === false),
      ).toBe(true);
      view.dispose();
    },
  );

  it('preserves the outgoing picture without a separate fade during a background-changing wipe', () => {
    const {root, view} = setup();
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'background', fit: 'fill', radius: 0},
      {...themeElementBase(31), kind: 'currentText'},
    ];
    const effect = {kind: 'wipe' as const, dir: 'left' as const, sec: 1};
    const base = frame(elements);
    const initial = {...song, media: {mediaId, loop: true, startedAt: 1}};
    view.render(initial, {...base, slideTransition: effect});
    const outgoing = root.querySelector<HTMLElement>('[data-theme-page]');
    if (outgoing === null || song.slide === null) {
      throw Error('Missing outgoing page');
    }
    const oldText =
      outgoing.querySelector<HTMLElement>('[data-kind="currentText"]') ??
      outgoing.querySelector<HTMLElement>('[data-kind="text"]');
    if (oldText === null) throw Error('Missing outgoing text');
    const previousOpacity = oldText.style.opacity;
    const nextId = createMediaId('00000000-0000-4000-8000-000000000602');
    view.render(
      {
        ...initial,
        slide: {...song.slide, itemId: 'new', lines: ['Next']},
        media: {mediaId: nextId, loop: true, startedAt: 2},
      },
      {
        ...base,
        slideTransition: effect,
        clearOpacity: {slide: 0.5, media: 0.5},
      },
    );
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(2);
    expect(oldText.style.opacity).toBe(previousOpacity);
    const incoming = root.querySelectorAll<HTMLElement>('[data-theme-page]')[1];
    expect(incoming?.style.transition).toBe('none');
    view.dispose();
  });

  it('transitions whole pages between items sharing a background', () => {
    const {root, view} = setup();
    const base = frame([
      {...themeElementBase(), kind: 'background', fit: 'fill', radius: 0},
      {...themeElementBase(31), kind: 'currentText'},
    ]);
    const effect = {kind: 'push' as const, dir: 'left' as const, sec: 0.5};
    view.render(song, {...base, slideTransition: effect});
    if (song.slide === null) throw new Error('Missing slide');
    view.render(
      {...song, slide: {...song.slide, itemId: 'second', lines: ['Next']}},
      {...base, slideTransition: effect},
    );
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(2);
    expect(root.textContent).toContain('Invented line');
    expect(root.textContent).toContain('Next');
    view.dispose();
  });

  it.each(['card', 'text'] as const)(
    'wipes every element together from a section card to %s',
    kind => {
      const {root, view} = setup();
      vi.spyOn(ThemeElementView.prototype, 'ready').mockReturnValue(true);
      const elements: ThemeElement[] = [
        {...themeElementBase(), kind: 'background', fit: 'fill', radius: 0},
        {
          ...themeElementBase(31),
          kind: 'image',
          mediaId,
          fit: 'fit',
          radius: 0,
        },
        {
          ...themeElementBase(32),
          kind: 'box',
          box: {on: true, fill: '#000000', opacity: 40, radius: 0},
        },
        {...themeElementBase(33), kind: 'itemName'},
        {...themeElementBase(34), kind: 'currentText'},
      ];
      const base = frame(elements);
      if (
        base.theme === undefined ||
        base.theme.item === null ||
        song.slide === null
      ) {
        throw new Error('Missing slide');
      }
      const effect = {kind: 'wipe' as const, sec: 1};
      view.render(song, {...base, slideTransition: effect});
      const nextLayers = {
        ...song,
        slide: {
          ...song.slide,
          itemId: kind === 'card' ? 'next-card' : 'invented',
          position: 1,
          lines: ['Next text'],
        },
      };
      const nextFrame = {
        ...base,
        slideTransition: effect,
        theme: {
          ...base.theme,
          item: {
            ...base.theme.item,
            id: nextLayers.slide.itemId,
            title: 'Next title',
          },
        },
      };
      view.render(nextLayers, nextFrame);
      const pages = root.querySelectorAll<HTMLElement>('[data-theme-page]');
      expect(pages).toHaveLength(2);
      const incoming = pages[1];
      if (incoming === undefined) throw new Error('Missing incoming page');
      for (const name of [
        'background',
        'image',
        'box',
        'itemName',
        'currentText',
      ]) {
        expect(incoming.querySelector(`[data-kind="${name}"]`)).not.toBeNull();
      }
      const animate = vi.fn(() => ({cancel: vi.fn()}));
      for (const page of pages) {
        Object.defineProperty(page, 'animate', {value: animate});
      }
      vi.advanceTimersByTime(32);
      expect(animate).toHaveBeenCalledTimes(2);
      expect(animate).toHaveBeenLastCalledWith(expect.any(Array), {
        duration: 1000,
        easing: 'linear',
      });
      view.dispose();
    },
  );

  it('retains both pages while a wipe is paused beyond its nominal duration', async () => {
    const {root, view} = setup();
    const base = frame([{...themeElementBase(), kind: 'currentText'}]);
    const effect = {kind: 'wipe' as const, sec: 1};
    view.render(song, {...base, slideTransition: effect});
    if (song.slide === null) throw new Error('Missing slide');
    view.render(
      {...song, slide: {...song.slide, position: 1, lines: ['Next']}},
      {...base, slideTransition: effect},
    );
    let finish = (): void => undefined;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    for (const page of root.querySelectorAll<HTMLElement>(
      '[data-theme-page]',
    )) {
      Object.defineProperty(page, 'animate', {
        value: vi.fn(() => ({cancel: vi.fn(), finished})),
      });
    }
    vi.advanceTimersByTime(32);
    vi.advanceTimersByTime(2000);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(2);
    finish();
    await finished;
    await Promise.resolve();
    await Promise.resolve();
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    view.dispose();
  });

  it('keeps the new broadcast look on transparent NDI output', () => {
    const root = document.createElement('div');
    const view = new ThemeCompositionView(root, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl: id => id,
      onError: vi.fn(),
      transparent: true,
    });
    const element = (id: string) =>
      root.querySelector<HTMLElement>(`[data-theme-element="${id}"]`);
    const render = (kind: 'plain' | 'card' | 'song') => {
      const layout = broadcastLookLayout(kind);
      view.render(song, {...frame(layout.elements), transitions: false});
    };
    render('plain');
    expect(element(BROADCAST_LOOK_BAND_ID)?.firstElementChild).not.toBeNull();
    expect(element(BROADCAST_LOOK_TAB_ID)?.firstElementChild).not.toBeNull();
    render('song');
    expect(element(BROADCAST_LOOK_BAND_ID)?.firstElementChild).not.toBeNull();
    expect(root.textContent).toContain('Invented line');
    view.dispose();
  });
  it('keeps an NDI screen translucent through the composition', () => {
    const root = document.createElement('div');
    const view = new ThemeCompositionView(root, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl: id => id,
      onError: vi.fn(),
      transparent: true,
    });
    const active = frame(broadcastLookLayout('plain').elements, {
      item: {id: 'invented', kind: 'bible', source: 'service'},
    });
    view.render(song, {
      ...active,
      screen: {id: THEME_MAIN, kind: 'broadcast', method: 'ndi'},
      transitions: false,
    });
    const panel = root.querySelector<HTMLElement>(
      `[data-theme-element="${BROADCAST_LOOK_BAND_ID}"] > div`,
    );
    if (panel === null) throw Error('missing panel');
    const inner = panel.firstElementChild;
    if (!(inner instanceof HTMLElement)) throw Error('missing panel');
    expect(panel.style.borderColor).toContain('45%');
    expect(inner.style.backgroundColor).toContain('90%');
    expect(panel.style.boxShadow).toContain('16px');
    const header = root.querySelector<HTMLElement>(
      `[data-theme-element="${BROADCAST_LOOK_TAB_ID}"] > div`,
    );
    expect(header?.style.background).toContain('transparent');
    view.dispose();
  });
  it.each(['capture', 'ndi'] as const)(
    'draws an opaque box in a %s capture window',
    method => {
      const root = document.createElement('div');
      const view = new ThemeCompositionView(root, {
        textStyle: DEFAULT_TEXT_STYLE,
        mediaUrl: id => id,
        onError: vi.fn(),
      });
      const active = frame(broadcastLookLayout('plain').elements, {
        item: {id: 'invented', kind: 'bible', source: 'service'},
      });
      view.render(song, {
        ...active,
        screen: {id: THEME_MAIN, kind: 'broadcast', method},
        transitions: false,
      });
      const panel = root.querySelector<HTMLElement>(
        `[data-theme-element="${BROADCAST_LOOK_BAND_ID}"] > div`,
      );
      expect(panel?.style.borderColor).toBe('rgb(232, 232, 232)');
      expect(panel?.style.boxShadow).toBe('none');
      const inner = panel?.firstElementChild;
      if (!(inner instanceof HTMLElement)) throw Error('missing panel');
      expect(inner.style.backgroundColor).toBe('rgb(254, 253, 249)');
      const bible = frame(broadcastLookLayout('plain').elements, {
        item: {id: 'invented', kind: 'bible', source: 'service'},
      });
      view.render(song, {
        ...bible,
        screen: {id: THEME_MAIN, kind: 'broadcast', method},
        transitions: false,
      });
      const header = root.querySelector<HTMLElement>(
        `[data-theme-element="${BROADCAST_LOOK_TAB_ID}"] > div`,
      );
      expect(header?.style.background).toContain('rgb(254, 253, 249)');
      expect(header?.style.background).not.toContain('transparent');
      view.dispose();
    },
  );
  it.each([
    {caption: 'band', transparent: true, shadow: '2px 6px'},
    {caption: 'text', transparent: true, shadow: '24px'},
    {caption: 'band', transparent: false, shadow: '2px 2px 0'},
    {caption: 'text', transparent: false, shadow: '2px 2px 0'},
  ] as const)(
    'draws $caption with the correct output shadow',
    ({caption, transparent, shadow}) => {
      const root = document.createElement('div');
      const view = new ThemeCompositionView(root, {
        textStyle: DEFAULT_TEXT_STYLE,
        mediaUrl: id => id,
        onError: vi.fn(),
        transparent,
      });
      const active = frame(broadcastLookLayout('song').elements);
      view.render(song, {
        ...active,
        screen: {
          id: THEME_MAIN,
          kind: 'broadcast',
          method: 'ndi',
          songCaption: caption,
        },
        transitions: false,
      });
      const text = root.querySelector<HTMLElement>(
        `[data-theme-element="${BROADCAST_LOOK_SONG_ID}"] .${classes.block}`,
      );
      expect(text?.style.textShadow).toContain(shadow);
      if (caption === 'band' && transparent) {
        expect(text?.style.textShadow).toMatch(/^0(?:px)? 2px 6px/);
        expect(text?.style.textShadow).toContain('80%');
      }
      const panel = root.querySelector<HTMLElement>(
        `[data-theme-element="${BROADCAST_LOOK_BAND_ID}"] > div`,
      );
      if (caption === 'band') {
        expect(panel?.style.backgroundColor).toBe('rgba(0, 0, 0, 0.91)');
        expect(panel?.style.background).not.toContain('gradient');
      }
      view.dispose();
    },
  );
  it('redraws a live broadcast song when its screen caption choice changes', () => {
    const root = document.createElement('div');
    const view = new ThemeCompositionView(root, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl: id => id,
      onError: vi.fn(),
      transparent: true,
    });
    const active = frame(broadcastLookLayout('song').elements);
    const display = {
      id: THEME_MAIN,
      kind: 'broadcast' as const,
      method: 'ndi' as const,
    };
    view.render(song, {...active, screen: display, transitions: false});
    const band = () =>
      root.querySelector<HTMLElement>(
        `[data-theme-element="${BROADCAST_LOOK_BAND_ID}"]`,
      );
    const shadow = () =>
      root.querySelector<HTMLElement>(
        `[data-theme-element="${BROADCAST_LOOK_SONG_ID}"] .${classes.block}`,
      )?.style.textShadow;
    expect(band()?.hidden).toBe(false);
    expect(shadow()).toContain('6px');
    view.render(song, {
      ...active,
      screen: {...display, songCaption: 'text'},
      transitions: false,
    });
    expect(band()?.hidden).toBe(true);
    expect(shadow()).toContain('24px');
    view.render(song, {
      ...active,
      screen: {...display, songCaption: 'band'},
      transitions: false,
    });
    expect(band()?.hidden).toBe(false);
    expect(shadow()).toContain('6px');
    view.dispose();
  });
  it('omits the built-in caption band only for transparent output', () => {
    const screenId = createScreenId(STARTER_SCREEN_IDS.broadcast);
    const layout = builtInTheme('song').screens[screenId];
    if (!layout) throw Error('Missing broadcast layout');
    const transparentRoot = document.createElement('div');
    const transparent = new ThemeCompositionView(transparentRoot, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl: id => id,
      onError: vi.fn(),
      transparent: true,
    });
    const normal = setup();
    const active = frame(layout.elements);
    transparent.render(song, active);
    normal.view.render(song, active);
    expect(
      transparentRoot.querySelector(
        `[data-theme-element="${BROADCAST_BAND_ID}"]`,
      ),
    ).toBeNull();
    expect(
      normal.root.querySelector(`[data-theme-element="${BROADCAST_BAND_ID}"]`),
    ).not.toBeNull();
    expect(transparentRoot.textContent).toContain('Invented line');
    transparent.dispose();
    normal.view.dispose();
  });
  it.each(['main', 'stage'] as const)(
    'lays out Bible text for the %s screen without changing its source',
    screenKind => {
      const screenId = createScreenId(STARTER_SCREEN_IDS[screenKind]);
      const layout = builtInTheme('bible').screens[screenId];
      if (!layout) throw Error('Missing Bible layout');
      const {root, view} = setup();
      const current = {
        ...song,
        slide: {
          ...song.slide,
          itemId: 'invented',
          position: 0,
          label: null,
          kind: 'bible' as const,
          lines: ['first line', 'second line'],
        },
      };
      const active = frame(layout.elements);
      if (!active.theme?.item) throw Error('Missing theme item');
      try {
        view.render(current, {
          ...active,
          transitions: false,
          screen: {
            id: screenId,
            kind: screenKind === 'main' ? 'audience' : 'stage',
          },
          theme: {...active.theme, item: {...active.theme.item, kind: 'bible'}},
        });
        const block = root.querySelector<HTMLElement>(
          `[data-kind="currentText"] .${classes.shown} .${classes.block}`,
        );
        if (!block) throw Error('Missing Bible text');
        expect(Array.from(block.children, child => child.textContent)).toEqual(
          screenKind === 'main'
            ? ['first line', 'second line']
            : ['first line second line'],
        );
        expect(current.slide.lines).toEqual(['first line', 'second line']);
      } finally {
        view.dispose();
      }
    },
  );
  it('renders the title in the broadcast band for an empty song slide', () => {
    const layout =
      builtInTheme('song').screens[
        createScreenId(STARTER_SCREEN_IDS.broadcast)
      ];
    if (!layout) throw Error('Missing broadcast layout');
    const {root, view} = setup();
    const current = {
      ...song,
      slide: {
        ...song.slide,
        itemId: 'invented',
        position: 0,
        label: 'Interlude',
        kind: 'song' as const,
        lines: [''],
      },
    };
    const active = frame(layout.elements);
    if (!active.theme?.item) throw Error('Missing theme item');
    try {
      view.render(current, {
        ...active,
        transitions: false,
        theme: {
          ...active.theme,
          item: {...active.theme.item, title: 'My song'},
        },
      });
      const band = root.querySelector<HTMLElement>(
        `[data-theme-element="${BROADCAST_BAND_ID}"]`,
      );
      const block = root.querySelector<HTMLElement>(
        `[data-kind="currentText"] .${classes.shown} .${classes.block}`,
      );
      expect(band?.hidden).toBe(false);
      expect(block?.textContent).toBe('My song');
      expect(block?.style.whiteSpace).toBe('pre');
      expect(current.slide.lines).toEqual(['']);
    } finally {
      view.dispose();
    }
  });
  it.each(['bible', 'song', 'ad'] as const)(
    'reflows only %s Bible output in the broadcast band',
    kind => {
      const layout =
        builtInTheme(kind).screens[
          createScreenId(STARTER_SCREEN_IDS.broadcast)
        ];
      if (!layout) throw Error('Missing broadcast layout');
      const {root, view} = setup();
      const current = {
        ...song,
        slide: {
          ...song.slide,
          itemId: 'invented',
          position: 0,
          label: null,
          kind,
          lines: ['first line', 'second line'],
        },
      };
      const original = [...current.slide.lines];
      const active = frame(layout.elements);
      if (!active.theme?.item) throw Error('Missing theme item');
      try {
        view.render(current, {
          ...active,
          transitions: false,
          theme: {...active.theme, item: {...active.theme.item, kind}},
        });
        const block = root.querySelector<HTMLElement>(
          `[data-kind="currentText"] .${classes.shown} .${classes.block}`,
        );
        if (!block) throw Error('Missing text block');
        expect(block.children.length).toBe(kind === 'bible' ? 1 : 2);
        expect(block.textContent).toBe(
          kind === 'bible' ? 'first line second line' : 'first linesecond line',
        );
        expect(current.slide.lines).toEqual(original);
      } finally {
        view.dispose();
      }
    },
  );
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
      if (!activeFrame.theme?.item) throw Error('Missing theme item');
      const blankFrame = {
        ...activeFrame,
        theme: {
          ...activeFrame.theme,
          item: {...activeFrame.theme.item, kind: 'blank' as const},
        },
      };
      expect(() => view.render(empty, blankFrame)).not.toThrow();
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
  it('reports a new broadcast look measurement error and uses its unfitted layout', () => {
    const layout =
      currentBuiltInTheme('bible').screens[
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
      expect(root.querySelector('[data-kind="currentText"]')).not.toBeNull();
      expect(document.body.querySelector('[data-slide-measure]')).toBeNull();
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
  it('refits a section band when only the live item changes', () => {
    const section = createDefaultThemes().themes.find(
      theme => theme.id === SECTION_THEME_ID,
    )?.screens[createScreenId(STARTER_SCREEN_IDS.broadcast)];
    if (!section) throw Error('Missing broadcast layout');
    const {root, view} = setup();
    const append = vi.spyOn(document.body, 'append');
    const measured: string[] = [];
    const height = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        if (this.closest('[data-slide-measure]')) {
          measured.push(this.textContent);
        }
        return 100;
      });
    const active = {...frame(section.elements), transitions: false};
    const theme = active.theme;
    if (!theme?.item) throw Error('Missing theme item');
    const current = {
      ...song,
      slide: {
        ...song.slide,
        itemId: 'invented',
        position: 0,
        label: null,
        lines: [''],
      },
    };
    try {
      view.render(current, active);
      const band = () =>
        Array.from(
          root.querySelectorAll<HTMLElement>(
            `[data-theme-element="${BROADCAST_BAND_ID}"]`,
          ),
        ).at(-1);
      expect(band()?.hidden).toBe(false);
      const before = append.mock.calls.length;
      view.render(current, {
        ...active,
        theme: {
          ...theme,
          item: {...theme.item, title: 'Changed item name'},
        },
      });
      expect(append.mock.calls.length).toBeGreaterThan(before);
      expect(measured).toContain('Changed item name');
    } finally {
      view.dispose();
      append.mockRestore();
      height.mockRestore();
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

  it('keeps the old page until its replacement picture decodes', async () => {
    const {root, view} = setup();
    const picture: ThemeElement = {
      ...themeElementBase(31),
      kind: 'image',
      mediaId,
      fit: 'fit',
      radius: 0,
    };
    view.render(song, {
      ...frame([{...themeElementBase(), kind: 'currentText'}]),
      transitions: false,
    });
    vi.advanceTimersByTime(32);
    const oldPage = root.querySelector<HTMLElement>('[data-theme-page]');
    view.render(song, {
      ...frame([picture], {
        themeId: createThemeId('00000000-0000-4000-8000-000000000502'),
      }),
      transitions: false,
    });
    const image = root.querySelector('img');
    if (image === null) throw new Error('Missing picture');
    let resolveDecode = (): void => {};
    image.decode = () =>
      new Promise<void>(resolve => {
        resolveDecode = resolve;
      });
    image.dispatchEvent(new Event('load'));
    const incoming = [
      ...root.querySelectorAll<HTMLElement>('[data-theme-page]'),
    ].at(-1);
    expect(view.ready()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(incoming?.style.opacity).toBe('0');
    expect(root.contains(oldPage)).toBe(true);
    resolveDecode();
    await Promise.resolve();
    expect(view.ready()).toBe(true);
    vi.advanceTimersByTime(32);
    expect(incoming?.style.opacity).toBe('1');
    vi.advanceTimersByTime(1);
    expect(root.contains(oldPage)).toBe(false);
    view.dispose();
  });

  it('reports a rejected theme picture decode and ignores a decode after disposal', async () => {
    const {root, view, onError} = setup();
    const picture: ThemeElement = {
      ...themeElementBase(31),
      kind: 'image',
      mediaId,
      fit: 'fit',
      radius: 0,
    };
    view.render(song, frame([picture]));
    const image = root.querySelector('img');
    if (image === null) throw new Error('Missing picture');
    image.decode = () => Promise.reject(new Error('decode failed'));
    image.dispatchEvent(new Event('load'));
    await Promise.resolve();
    expect(view.ready()).toBe(true);
    expect(image.hidden).toBe(true);
    expect(onError).toHaveBeenCalled();
    let rejectDecode: (error: Error) => void = () => {};
    image.decode = () =>
      new Promise<void>((_resolve, reject) => {
        rejectDecode = reject;
      });
    image.dispatchEvent(new Event('load'));
    view.dispose();
    onError.mockClear();
    rejectDecode(new Error('stale'));
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
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
    await Promise.resolve();
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
    async mode => {
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
      await Promise.resolve();
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
        Object.defineProperty(page, 'animate', {
          value: animate,
          configurable: true,
        });
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
      if (kind === 'none') {
        expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
        expect(text('currentText')).toBe('Next lyrics');
      } else {
        const pages = root.querySelectorAll<HTMLElement>('[data-theme-page]');
        expect(pages).toHaveLength(2);
        for (const page of pages) {
          Object.defineProperty(page, 'animate', {
            value: animate,
            configurable: true,
          });
        }
        vi.advanceTimersByTime(32);
        expect(animate).toHaveBeenLastCalledWith(expect.any(Array), {
          duration: 500,
          easing: 'linear',
        });
        vi.advanceTimersByTime(500);
        expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
        expect(text('currentText')).toBe('Next lyrics');
      }
      expect(onError).not.toHaveBeenCalled();
      view.dispose();
    },
  );

  it.each([false, true])(
    'animates a theme dissolve with transparent=%s',
    transparent => {
      const {root, view} = setup(transparent);
      const elements: ThemeElement[] = [
        {...themeElementBase(), kind: 'currentText'},
      ];
      view.render(song, frame(elements));
      view.render(song, {
        ...frame(elements, {
          themeId: createThemeId('00000000-0000-4000-8000-000000000502'),
        }),
        slideTransition: {kind: 'dissolve', sec: 0.5},
      });
      const [outgoing, incoming] =
        root.querySelectorAll<HTMLElement>('[data-theme-page]');
      const oldAnimate = vi.fn(() => ({cancel: vi.fn()}));
      const newAnimate = vi.fn(() => ({cancel: vi.fn()}));
      Object.defineProperty(outgoing, 'animate', {value: oldAnimate});
      Object.defineProperty(incoming, 'animate', {value: newAnimate});
      vi.advanceTimersByTime(32);
      const timing = {duration: 500, easing: 'linear'};
      expect(oldAnimate).toHaveBeenCalledWith(
        [{opacity: 1}, {opacity: transparent ? 0 : 1}],
        timing,
      );
      expect(newAnimate).toHaveBeenCalledWith(
        [{opacity: 0}, {opacity: 1}],
        timing,
      );
      vi.advanceTimersByTime(500);
      expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
      view.dispose();
    },
  );

  it('fades the outgoing transparent page for a media transition', () => {
    const {root, view} = setup(true);
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'currentText'},
    ];
    view.render(song, frame(elements));
    const next = frame(elements, {
      themeId: createThemeId('00000000-0000-4000-8000-000000000502'),
    });
    if (!next.theme?.item) throw Error('Missing item');
    view.render(song, {
      ...next,
      theme: {...next.theme, item: {...next.theme.item, kind: 'media'}},
    });
    const [outgoing, incoming] =
      root.querySelectorAll<HTMLElement>('[data-theme-page]');
    if (!outgoing || !incoming) throw Error('Missing theme pages');
    vi.advanceTimersByTime(32);
    expect(outgoing.style.opacity).toBe('0');
    expect(incoming.style.opacity).toBe('1');
    expect(outgoing.style.transition).toBe('opacity 0ms linear');
    expect(incoming.style.transition).toBe('none');
    vi.advanceTimersByTime(500);
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
    view.dispose();
  });

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
      {
        ...frame(elements, {
          themeId: createThemeId('00000000-0000-4000-8000-000000000502'),
        }),
        transitionTimes: {slideMs: 500, backgroundMs: 500},
      },
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
    view.render(layers, {
      ...frame([background], {
        themeId: createThemeId('00000000-0000-4000-8000-000000000505'),
      }),
      transitionTimes: {slideMs: 500, backgroundMs: 500},
    });
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

  it('aligns seconds clocks to the wall second and stops when hidden or off', () => {
    const {view, text} = setup();
    let wall = Date.UTC(2026, 0, 1, 0, 0, 0, 400);
    const content = {
      ...frame([
        {
          ...themeElementBase(),
          kind: 'clock',
          clockFormat: '24h',
          seconds: true,
        },
      ]),
      transitions: false,
      timers: {list: [], runs: undefined, now: () => ({wall, timer: 0})},
    };
    view.render(song, content);
    expect(vi.getTimerCount()).toBe(1);
    const first = text('clock');
    wall += 599;
    vi.advanceTimersByTime(599);
    expect(text('clock')).toBe(first);
    wall++;
    vi.advanceTimersByTime(1);
    expect(text('clock')).not.toBe(first);
    view.render(song, {...content, standby: true});
    expect(vi.getTimerCount()).toBe(0);
    view.render(song, content);
    view.render(song, {});
    expect(vi.getTimerCount()).toBe(0);
    view.dispose();
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

it('reflows Bible parts independently on stage and broadcast, including the next verse', () => {
  const {root, view} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(), kind: 'currentText'},
    {...themeElementBase(31), kind: 'nextText', lineLimit: 2},
  ];
  const current = [
    '29 \ub098\ub294 \ub9c8\uc74c\uc774 \uc628\uc720\ud558\uace0 \uacb8\uc190\ud558\ub2c8',
    '\ub098\uc758 \uba4d\uc5d0\ub97c \uba54\uace0 \ub0b4\uac8c \ubc30\uc6b0\ub77c \uadf8\ub9ac\ud558\uba74 \ub108\ud76c',
    '\ub9c8\uc74c\uc774 \uc27c\uc744 \uc5bb\uc73c\ub9ac\ub2c8',
  ];
  const next = [
    '30 \uc774\ub294 \ub0b4 \uba4d\uc5d0\ub294 \uc27d\uace0',
    '\ub0b4 \uc9d0\uc740 \uac00\ubcbc\uc6c0\uc774\ub77c',
    '\ud558\uc2dc\ub2c8\ub77c',
  ];
  const layers: LiveLayers = {
    ...emptyLayers(),
    slide: {
      itemId: 'invented',
      position: 0,
      label: '11:29',
      lines: current,
      next: {label: '11:30', lines: next, itemKind: 'bible'},
    },
  };
  const base = frame(elements);
  if (!base.theme?.item) throw Error('Missing item');
  const bible = {
    ...base,
    theme: {...base.theme, item: {...base.theme.item, kind: 'bible' as const}},
    transitions: false,
  };
  const rows = (kind: string) =>
    Array.from(
      root.querySelectorAll(
        `[data-kind="${kind}"] .${classes.shown} .${classes.block} > div`,
      ),
      row => row.textContent,
    );
  for (const kind of ['stage', 'broadcast'] as const) {
    view.render(layers, {...bible, screen: {id: THEME_MAIN, kind}});
    expect(rows('currentText')).toEqual([current.join(' ')]);
    expect(rows('nextText')).toEqual([next.join(' ')]);
    expect(
      root.querySelector<HTMLElement>('[data-kind="currentText"]')?.style
        .textWrap,
    ).toBe(kind === 'stage' ? 'balance' : '');
    expect(
      root.querySelector<HTMLElement>('[data-kind="nextText"]')?.style.textWrap,
    ).toBe('balance');
  }
  view.render(layers, {...bible, screen: {id: THEME_MAIN, kind: 'audience'}});
  expect(rows('currentText')).toEqual(current);
  if (layers.slide === null) throw Error('Missing slide');
  const songLayers = {
    ...layers,
    slide: {
      ...layers.slide,
      next: {label: null, lines: next, itemKind: 'song' as const},
    },
  };
  view.render(songLayers, {
    ...base,
    screen: {id: THEME_MAIN, kind: 'stage'},
    transitions: false,
  });
  expect(rows('currentText')).toEqual([
    `(11:29) ${current[0]}`,
    ...current.slice(1),
  ]);
  expect(rows('nextText')).toEqual(next.slice(0, 2));
  expect(
    root.querySelector<HTMLElement>('[data-kind="currentText"]')?.style
      .textWrap,
  ).toBe('');
  view.dispose();
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

it.each(['song', 'ad'] as const)(
  'targets two thirds of the fitted stage current size for %s items',
  kind => {
    const {view} = setup();
    const size = vi.spyOn(ThemeElementView.prototype, 'fittedTextSize');
    const target = vi.spyOn(ThemeElementView.prototype, 'targetTextSize');
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'currentText'},
      {...themeElementBase(31), kind: 'nextText'},
    ];
    const base = frame(elements);
    if (!base.theme?.item) throw Error('missing item');
    const stage = {
      ...base,
      screen: {id: THEME_MAIN, kind: 'stage' as const},
      theme: {...base.theme, item: {...base.theme.item, kind}},
    };
    for (const fitted of [120, 150, 72]) {
      size.mockReturnValue(fitted);
      view.render(song, stage);
      expect(target).toHaveBeenLastCalledWith((fitted * 2) / 3);
    }
    size.mockRestore();
    target.mockRestore();
    view.dispose();
  },
);

it('sizes section stage next text against the Korean item name, not its English subtitle', () => {
  const {view} = setup();
  const size = vi
    .spyOn(ThemeElementView.prototype, 'fittedTextSize')
    .mockImplementation(function (this: ThemeElementView) {
      return this.element.kind === 'itemName' ? 120 : 42;
    });
  const cap = vi.spyOn(ThemeElementView.prototype, 'targetTextSize');
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
    const cap = vi.spyOn(ThemeElementView.prototype, 'targetTextSize');
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

it('keeps stage next text at least 48px even when the current text is smaller', () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
  const {root, view} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(), kind: 'currentText'},
    {...themeElementBase(31), kind: 'nextText'},
  ];
  view.render(song, {
    ...frame(elements),
    screen: {id: THEME_MAIN, kind: 'stage'},
  });
  const block = root.querySelector<HTMLElement>(
    `[data-kind="nextText"] .${classes.shown} .${classes.block}`,
  );
  expect(block?.style.fontSize).toBe('48px');
  view.dispose();
});

it.each(['output', 'preview'] as const)(
  'shows an empty song cue on stage in %s and leaves audience lyrics empty',
  mode => {
    const root = document.createElement('div');
    const view = new ThemeCompositionView(root, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl: id => id,
      onError: vi.fn(),
      mode,
    });
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'currentText'},
      {...themeElementBase(31), kind: 'nextText'},
    ];
    const base = frame(elements);
    if (!base.theme) throw Error('Missing theme');
    const stage = {
      ...base,
      transitions: false,
      screen: {id: THEME_MAIN, kind: 'stage' as const},
      theme: {
        ...base.theme,
        layout: {...base.theme.layout, stageBar: 'message-row' as const},
      },
    };
    if (song.slide === null) throw Error('Missing slide');
    const empty = {
      ...song,
      slide: {...song.slide, lines: ['  '], label: 'Interlude'},
    };
    const current = () =>
      root.querySelector<HTMLElement>(
        `[data-kind="currentText"] .${classes.shown} .${classes.block}`,
      );
    view.render(empty, stage);
    expect(current()?.textContent).toBe('(Interlude)');
    expect(current()?.style.color).toBe('rgb(180, 180, 180)');
    expect(
      root.querySelector(`[data-kind="nextText"] .${classes.shown}`)
        ?.textContent,
    ).toBe('(Chorus) Invented next');
    view.render({...empty, slide: {...empty.slide, label: null}}, stage);
    expect(current()?.textContent).toBe('(\uc5c6\uc74c)');
    view.render(
      {...empty, slide: {...empty.slide, label: null}},
      {
        ...stage,
        theme: {
          ...stage.theme,
          item: {id: 'invented', kind: 'blank', source: 'service'},
        },
      },
    );
    expect(current()?.textContent).toBe('(\uc5c6\uc74c)');
    view.render(song, stage);
    expect(current()?.textContent).toBe('(Verse) Invented line');
    expect(current()?.style.color).not.toBe('rgb(180, 180, 180)');
    view.render(empty, {
      ...frame(elements),
      transitions: false,
      screen: {id: THEME_MAIN, kind: 'stage'},
    });
    expect(current()?.textContent.trim()).toBe('(Interlude)');
    expect(current()?.style.color).toBe('rgb(180, 180, 180)');
    view.render(empty, {...frame(elements), transitions: false});
    expect(current()?.textContent.trim()).toBe('');
    view.dispose();
  },
);

it('renders only the section name in the fading NDI band', () => {
  const {root, view} = setup(true);
  const active = frame(sectionBroadcastLayout().elements, {
    item: {
      id: 'invented',
      kind: 'blank',
      source: 'service',
      title: 'Section name',
    },
  });
  const screen = {
    id: THEME_MAIN,
    kind: 'broadcast' as const,
    method: 'ndi' as const,
  };
  const element = (id: string) =>
    root.querySelector<HTMLElement>(`[data-theme-element="${id}"]`);
  for (const english of ['Praise', '']) {
    view.render(
      {
        ...song,
        slide: {
          ...song.slide,
          itemId: 'invented',
          position: 0,
          label: null,
          lines: [english],
        },
      },
      {...active, screen, transitions: false},
    );
    expect(element(SECTION_BAND_ID)?.style.top).toBe('888px');
    expect(element(SECTION_BAND_ID)?.style.height).toBe('102px');
    expect(
      element(SECTION_BAND_ID)?.firstElementChild?.getAttribute('style'),
    ).toContain('8.33333');
    expect(
      element(SECTION_BAND_ID)?.firstElementChild?.getAttribute('style'),
    ).toContain('0.88');
    expect(element(SECTION_NAME_ID)?.textContent).toContain('Section name');
    expect(root.textContent).not.toContain('Praise');
  }
  view.render(
    {
      ...song,
      slide: {
        ...song.slide,
        itemId: 'invented',
        position: 0,
        label: null,
        lines: [],
        sectionCard: {
          name: 'Card name',
          english: 'English title',
          theme: SECTION_THEME_ID,
        },
      },
    },
    {...active, screen, transitions: false},
  );
  expect(element(SECTION_NAME_ID)?.textContent).toContain('Card name');
  expect(root.textContent).not.toContain('English title');
  view.dispose();
});

it('hides the next item on stage only at the end of a Bible item', () => {
  const {root, view} = setup();
  const slide = song.slide;
  if (slide === null) throw Error('Missing slide');
  const elements: ThemeElement[] = [
    {...themeElementBase(31), kind: 'nextText'},
    {...themeElementBase(32), kind: 'nextLabel'},
  ];
  const render = (
    kind: 'bible' | 'song',
    position: number,
    screen: 'stage' | 'audience',
  ) => {
    view.render(
      {...song, slide: {...slide, kind, position, sequenceLength: 2}},
      {
        ...frame(elements, {item: {id: 'invented', kind, source: 'service'}}),
        screen: {id: THEME_MAIN, kind: screen},
        transitions: false,
      },
    );
  };
  const nextText = () =>
    root.querySelector(`[data-kind="nextText"] .${classes.shown}`)
      ?.textContent ?? '';
  const nextLabel = () =>
    root.querySelector(`[data-kind="nextLabel"] .${classes.shown}`)
      ?.textContent ?? '';
  render('bible', 0, 'stage');
  expect(nextText()).toContain('Invented next');
  expect(nextLabel()).toContain('Chorus');
  render('bible', 1, 'stage');
  expect(nextText()).not.toContain('Invented next');
  expect(nextLabel()).not.toContain('Chorus');
  render('song', 1, 'stage');
  expect(nextText()).toContain('Invented next');
  render('bible', 1, 'audience');
  expect(nextText()).toContain('Invented next');
  view.dispose();
});

it('refits the current Bible item when output fonts finish loading', () => {
  const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
  const fonts = new EventTarget();
  Object.defineProperty(document, 'fonts', {configurable: true, value: fonts});
  const {view} = setup();
  const renderSpy = vi.spyOn(view, 'render');
  const active = frame(broadcastLookLayout('plain').elements, {
    item: {id: 'invented', kind: 'bible', source: 'service'},
  });
  const layers: LiveLayers = {
    ...song,
    slide: {
      ...song.slide,
      itemId: 'invented',
      position: 0,
      label: null,
      lines: ['Verse'],
      kind: 'bible',
      bibleItemSlides: [{lines: ['Verse']}, {lines: ['Longer verse']}],
    },
  };
  try {
    view.render(layers, {
      ...active,
      screen: {id: THEME_MAIN, kind: 'broadcast'},
      transitions: false,
    });
    fonts.dispatchEvent(new Event('loadingdone'));
    expect(renderSpy).toHaveBeenCalledTimes(2);
    view.dispose();
    fonts.dispatchEvent(new Event('loadingdone'));
    expect(renderSpy).toHaveBeenCalledTimes(2);
  } finally {
    view.dispose();
    if (descriptor === undefined) Reflect.deleteProperty(document, 'fonts');
    else Object.defineProperty(document, 'fonts', descriptor);
  }
});

it('shows an empty stage next slide cue and preserves labels and other screens', () => {
  const {root, view} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(31), kind: 'nextText'},
  ];
  const slide = song.slide;
  if (slide === null) throw Error('Missing slide');
  let layers: LiveLayers = {
    ...song,
    slide: {...slide, next: {label: null, lines: [' ']}},
  };
  const show = (kind: 'stage' | 'audience') =>
    view.render(layers, {
      ...frame(elements),
      screen: {id: THEME_MAIN, kind},
      transitions: false,
    });
  const text = () =>
    root.querySelector(`[data-kind="nextText"] .${classes.shown}`)
      ?.textContent ?? '';
  show('stage');
  expect(text()).toBe('(\uc5c6\uc74c)');
  layers = {
    ...layers,
    slide: {...slide, next: {label: 'Interlude', lines: [' ']}},
  };
  show('stage');
  expect(text()).toBe('(Interlude)');
  layers = {
    ...layers,
    slide: {...slide, next: {label: null, lines: [' ']}},
  };
  show('audience');
  expect(text().trim()).toBe('');
  view.dispose();
});

it('shows stage prelude and interlude labels and omits a title slide subtitle', () => {
  const {root, view} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(31), kind: 'nextText'},
  ];
  const slide = song.slide;
  if (slide === null) throw Error('Missing slide');
  const draw = (
    next: NonNullable<typeof slide.next>,
    screen: 'stage' | 'audience',
  ) => {
    view.render(
      {...song, slide: {...slide, next}},
      {
        ...frame(elements),
        screen: {id: THEME_MAIN, kind: screen},
        transitions: false,
      },
    );
    return (
      root.querySelector(`[data-kind="nextText"] .${classes.shown}`)
        ?.textContent ?? ''
    );
  };
  expect(
    draw(
      {label: '\uc804\uc8fc', titleSlide: true, lines: ['\ucc2c\uc591']},
      'stage',
    ),
  ).toBe('\ucc2c\uc591 (\uc804\uc8fc)');
  expect(draw({label: 'Verse', lines: ['Text']}, 'stage')).toBe('(Verse) Text');
  expect(draw({label: '\uac04\uc8fc', lines: []}, 'stage')).toBe(
    '(\uac04\uc8fc)',
  );
  expect(
    draw(
      {label: null, titleSlide: true, lines: ['\ucc2c\uc591', 'English title']},
      'stage',
    ),
  ).toBe('\ucc2c\uc591');
  expect(
    draw(
      {label: null, titleSlide: true, lines: ['\ucc2c\uc591', 'English title']},
      'audience',
    ),
  ).toContain('English title');
  view.dispose();
});

it('shows only Korean title or section name on stage and retains audience subtitle', () => {
  const {root, view} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(), kind: 'currentText'},
    {...themeElementBase(31), kind: 'itemName'},
  ];
  if (song.slide === null) throw Error('Missing slide');
  const title = {
    ...song,
    slide: {
      ...song.slide,
      titleSlide: true as const,
      lines: ['Korean title', 'English subtitle'],
    },
  };
  const draw = (layers: LiveLayers, kind: 'stage' | 'audience') =>
    view.render(layers, {
      ...frame(elements),
      screen: {id: THEME_MAIN, kind},
      transitions: false,
    });
  const current = () =>
    root.querySelector(`[data-kind="currentText"] .${classes.shown}`)
      ?.textContent ?? '';
  draw(title, 'stage');
  expect(current()).toBe('Korean title');
  draw(title, 'audience');
  expect(current()).toContain('English subtitle');
  const card = {
    ...song,
    slide: {
      ...song.slide,
      sectionCard: {
        name: 'Korean section',
        english: 'English section',
        theme: themeId,
      },
      lines: ['English section'],
    },
  };
  draw(card, 'stage');
  expect(current()).toBe('Korean section');
  expect(
    root.querySelector(`[data-kind="itemName"] .${classes.shown}`)?.textContent,
  ).toBe('Korean section');
  view.dispose();
});

it('places ordinary stage labels before lyrics and omits them on titles', () => {
  const {root, view} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(), kind: 'currentText'},
    {...themeElementBase(31), kind: 'nextText'},
  ];
  const slide = song.slide;
  if (slide === null) throw Error('Missing slide');
  const draw = (title: boolean, screen: 'stage' | 'audience') =>
    view.render(
      {
        ...song,
        slide: {
          ...slide,
          label: 'Verse',
          ...(title ? {titleSlide: true as const} : {}),
          lines: ['Current'],
          next: {
            label: 'Outro',
            ...(title ? {titleSlide: true as const} : {}),
            lines: ['Next'],
          },
        },
      },
      {
        ...frame(elements),
        screen: {id: THEME_MAIN, kind: screen},
        transitions: false,
      },
    );
  const text = (kind: string) =>
    root.querySelector(`[data-kind="${kind}"] .${classes.shown}`)
      ?.textContent ?? '';
  draw(false, 'stage');
  expect(text('currentText')).toBe('(Verse) Current');
  expect(text('nextText')).toBe('(Outro) Next');
  draw(true, 'stage');
  expect(text('currentText')).toBe('Current');
  expect(text('nextText')).toBe('Next');
  draw(false, 'audience');
  expect(text('currentText')).toBe('Current');
  expect(text('nextText')).toBe('Next');
  view.dispose();
});

it.each(['\uc804\uc8fc', '\uac04\uc8fc', '\ud6c4\uc8fc'])(
  'puts %s after text for both title and lyric slides',
  label => {
    const {root, view} = setup();
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'currentText'},
      {...themeElementBase(31), kind: 'nextText'},
    ];
    if (song.slide === null) throw Error('Missing slide');
    for (const title of [false, true]) {
      view.render(
        {
          ...song,
          slide: {
            ...song.slide,
            label,
            ...(title ? {titleSlide: true as const} : {}),
            lines: ['Current'],
            next: {label, lines: ['Next']},
          },
        },
        {
          ...frame(elements),
          screen: {id: THEME_MAIN, kind: 'stage'},
          transitions: false,
        },
      );
      expect(
        root.querySelector(`[data-kind="currentText"] .${classes.shown}`)
          ?.textContent,
      ).toBe(`Current (${label})`);
      expect(
        root.querySelector(`[data-kind="nextText"] .${classes.shown}`)
          ?.textContent,
      ).toBe(`Next (${label})`);
    }
    view.dispose();
  },
);

it('shows only an adjacent sermon title on stage after the last Bible slide', () => {
  const {root, view} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(31), kind: 'nextText'},
  ];
  if (song.slide === null) throw Error('Missing slide');
  const layers: LiveLayers = {
    ...song,
    slide: {
      ...song.slide,
      kind: 'bible',
      position: 1,
      sequenceLength: 2,
      next: {label: null, lines: ['Sermon title'], sermonTitle: true},
    },
  };
  const draw = (kind: 'stage' | 'audience') =>
    view.render(layers, {
      ...frame(elements),
      screen: {id: THEME_MAIN, kind},
      transitions: false,
    });
  const next = () =>
    root.querySelector(`[data-kind="nextText"] .${classes.shown}`)
      ?.textContent ?? '';
  draw('stage');
  expect(next()).toBe('Sermon title');
  draw('audience');
  expect(
    root.querySelector<HTMLElement>('[data-kind="nextText"]')?.hidden,
  ).toBe(true);
  view.dispose();
});
