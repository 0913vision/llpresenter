import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';
import {PREPARATION_THEME_ID} from '@core/themes/sundayStandby';
import {LIGHT_SONG_THEME_ID} from '@core/themes/lightSong';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {
  createMediaId,
  createScreenId,
  createThemeId,
  createTimerId,
} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {
  builtInTheme as currentBuiltInTheme,
  createDefaultThemes as currentDefaultThemes,
  DEFAULT_THEME_TEXT,
} from '@core/themes/defaults';
import {
  broadcastLookLayout,
  BROADCAST_LOOK_BAND_ID,
  BROADCAST_LOOK_TAB_ID,
  BROADCAST_LOOK_SONG_ID,
} from '@core/themes/broadcastLook';
import type {ThemeElement} from '@core/schema/themes';
import {
  fixedThemeText,
  liveThemeTextElements,
  themeElementBase,
  THEME_MAIN,
} from '@fixtures/core/themeOutput';
import type {RenderFrame, ThemeFrame} from '@renderer/rendering/layer';
import {ThemeCompositionView} from '@renderer/rendering/themeComposition';
import {classes} from '@renderer/rendering/classes';
import {bibleVerseTiles} from '@core/bible/bibleTiles';
import {projectSlides, slidesOutput} from '@core/presentation/slides';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {
  editedSlideText,
  textOverridesForTiles,
  textSlideKey,
} from '@core/presentation/textOverrides';
import * as textSlots from '@core/themes/textSlots';
import {pictureKey} from '@core/output/pictureKey';
import {outputSlideSpec} from '@renderer/rendering/outputSlideSpec';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {slidesItem} from '@fixtures/core/slides';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {ThemeElementView} from '@renderer/rendering/themeElement';
import {followPlaybackProblems} from '@renderer/rendering/playbackProblem';
import {SECTION_THEME_ID} from '@core/themes/sundaySections';
import {
  SECTION_BAND_ID,
  SECTION_NAME_ID,
  sectionBroadcastLayout,
} from '@core/themes/sectionBroadcast';

const createDefaultThemes = currentDefaultThemes;

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
  it('keeps the live stage values through redraws and ignores old slide overrides', () => {
    const {view, text, root} = setup();
    const match = vi.spyOn(textSlots, 'withSlideTextOverrides');
    const elements = liveThemeTextElements();
    const stage = {
      ...frame(elements),
      screen: {id: THEME_MAIN, kind: 'stage' as const},
      stageMessage: 'Stage cue',
      transitions: false,
    };
    if (song.slide === null) throw Error('Missing slide');
    const overrides = Object.fromEntries(
      elements.map(element => [
        [themeId, THEME_MAIN, element.id].join('/'),
        'Old slide value',
      ]),
    );
    const slide = {...song.slide, textOverrides: overrides};
    const layers = {...song, slide};
    view.render(layers, stage);
    const page = root.querySelector('[data-theme-page]');
    for (const opacity of [0.9, 0.7, 0.5]) {
      view.render(layers, {...stage, clearOpacity: {slide: opacity}});
      vi.advanceTimersByTime(1000);
      expect(text('clock')).toMatch(/\d{2}:\d{2}:\d{2}/u);
      expect(text('timer')).toBeUndefined();
      expect(text('stageMessage')).toBeUndefined();
      expect(text('videoTimeLeft')).toBeUndefined();
      expect(text('nextText')).toContain('Invented next');
      expect(text('nextLabel')).toBe('Chorus');
    }
    expect(match).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[data-theme-page]')).toBe(page);
    view.dispose();
  });

  it('keys identical still layouts by the theme and the source screen', () => {
    const element: ThemeElement = {...themeElementBase(), kind: 'currentText'};
    const composition = frame([element]).theme;
    if (composition === undefined || song.slide === null) {
      throw Error('Missing picture input');
    }
    const input = {
      ...composition,
      slide: song.slide,
      screen: {id: THEME_MAIN, kind: 'audience' as const},
    };
    const first = pictureKey(outputSlideSpec(input));
    expect(
      pictureKey(outputSlideSpec({...input, themeId: LIGHT_SONG_THEME_ID})),
    ).not.toBe(first);
    expect(
      pictureKey(
        outputSlideSpec({
          ...input,
          sourceScreenId: createScreenId(STARTER_SCREEN_IDS.stage),
        }),
      ),
    ).not.toBe(first);
  });

  it.each(['audience', 'stage', 'broadcast'] as const)(
    'applies a saved per-box Bible text override on %s and restores the automatic text',
    kind => {
      const passage = panelPassage();
      const tiles = bibleVerseTiles(passage, {reference: 'every'});
      const first = tiles[0];
      if (!first) throw Error('Missing verse');
      const key = textSlideKey(first);
      if (!key) throw Error('Missing verse identity');
      const cursor = {itemId: 'bible-test', index: 0};
      const theme = currentBuiltInTheme('bible');
      const id = createScreenId(
        kind === 'audience'
          ? STARTER_SCREEN_IDS.main
          : STARTER_SCREEN_IDS[kind],
      );
      const layout = theme.screens[id];
      if (!layout) throw Error('Missing layout');
      const item = {
        id: cursor.itemId,
        source: 'service' as const,
        kind: 'bible' as const,
        title: passage.displayRef,
      };
      const appearance = {
        themeId: theme.id,
        layout,
        item,
        emptyColor: '#000000',
        screen: {id, kind, method: 'fullscreen' as const},
      };
      const {view, text} = setup();
      function draw(source: typeof tiles) {
        const slide = slideLayerOf(cursor, () => source);
        if (!slide) throw Error('Missing slide');
        const picture = outputSlideSpec({...appearance, slide});
        view.render(picture.layers, {
          ...frame(appearance.layout.elements, {
            layout: appearance.layout,
            item,
            themeId: theme.id,
            sourceScreenId: id,
          }),
          screen: appearance.screen,
          transitions: false,
        });
        return pictureKey(picture);
      }
      const automatic = draw(tiles);
      const overrides = {
        [key]: {reference: 'Edited reference', currentText: 'Edited body'},
      };
      expect(draw(textOverridesForTiles(tiles, overrides))).not.toBe(automatic);
      expect(text('currentText')).toContain('Edited body');
      expect(text('reference')).toBe('Edited reference');
      const referenceKey = `${theme.id}/shared/reference`;
      const manualBlank = editedSlideText(overrides, {
        slide: key,
        slot: referenceKey,
        value: {
          mode: 'manual',
          slotId: 'reference',
          role: 'reference',
          sourceThemeId: theme.id,
          text: '',
        },
      });
      draw(textOverridesForTiles(tiles, manualBlank));
      expect(text('reference')?.trim() ?? '').toBe('');
      const restored = editedSlideText(
        editedSlideText(manualBlank, {
          slide: key,
          slot: referenceKey,
          value: null,
        }),
        {
          slide: key,
          slot: 'reference',
          value: null,
        },
      );
      draw(textOverridesForTiles(tiles, restored));
      expect(text('reference')).toBe(passage.displayRef);
      expect(text('currentText')).toContain('Edited body');
      view.dispose();
    },
  );

  it.each(['blank', 'ad'] as const)(
    'draws referenced %s text like the same Bible passage on all three screens',
    form => {
      const item = slidesItem(form);
      const [first, second] = item.slides.slides;
      if (first === undefined || second === undefined) {
        throw Error('Missing source slides');
      }
      const reference = '하박국 3:17~19';
      const text = '17 비록 무화과나무가\n무성하지 못하며 (계속)';
      const longerText = '18 나는 여호와로 말미암아 즐거워하며';
      const legacySlides = [
        {id: first.id, text: `${text}  \n`, reference},
        {id: second.id, text: longerText, reference},
      ];
      const tiles = projectSlides({
        ...item,
        slides: {
          ...item.slides,
          slides: legacySlides,
        },
      });
      const bibleTiles = tiles.map(
        ({kind: _kind, name: _name, ...tile}, index) => ({
          ...tile,
          lines: tile.lines.map(line => line.trimEnd()),
          biblePart: 1,
          continued: index === 0,
        }),
      );
      const theme = currentBuiltInTheme('bible');
      const screens = [
        {kind: 'audience', id: createScreenId(STARTER_SCREEN_IDS.main)},
        {kind: 'stage', id: createScreenId(STARTER_SCREEN_IDS.stage)},
        {kind: 'broadcast', id: createScreenId(STARTER_SCREEN_IDS.broadcast)},
      ] as const;
      function render(passage: boolean, screen: (typeof screens)[number]) {
        const source = passage ? bibleTiles : tiles;
        const slide = slideLayerOf({itemId: item.id, index: 0}, () => source);
        if (slide === null) throw Error('Missing live slide');
        const parsed = parseLiveCommand(slidesOutput(slide, undefined));
        if (!parsed.ok || parsed.value.type !== 'live.batch') {
          throw Error('Invalid live slide');
        }
        const command = parsed.value.commands[0];
        if (command?.type !== 'slide.show') {
          throw Error('Missing slide command');
        }
        const frameFor = (id: typeof screen.id) => {
          const layout = theme.screens[id];
          if (layout === undefined) throw Error('Missing Bible screen layout');
          return {
            themeId: theme.id,
            revision: 1,
            missing: [],
            emptyColor: '#000000',
            sourceScreenId: id,
            layout,
            item: {
              source: 'service',
              kind: passage ? 'bible' : form,
              id: item.id,
              title: passage ? reference : item.slides.name,
            },
          } satisfies ThemeFrame;
        };
        const {root, view, onError} = setup();
        view.render(
          {...emptyLayers(), slide: command.slide},
          {
            screen,
            theme: frameFor(screen.id),
            ...(screen.kind !== 'stage'
              ? {}
              : {
                  audience: {
                    screen: screens[0],
                    theme: frameFor(screens[0].id),
                  },
                }),
            transitions: false,
          },
        );
        expect(onError).not.toHaveBeenCalled();
        const page = root.querySelector(
          ':scope > [data-layer="theme"] > [data-theme-page]',
        );
        const body = page?.querySelector<HTMLElement>(
          '[data-kind="currentText"]',
        );
        const shown = body?.querySelector<HTMLElement>(`.${classes.shown}`);
        const block = shown?.querySelector<HTMLElement>(`.${classes.block}`);
        if (!body || !shown || !block) throw Error('Missing rendered body');
        const marker = block.querySelector<HTMLElement>(
          '[data-bible-continuation]',
        );
        const result = {
          element: body.dataset['themeElement'],
          frame: [
            body.style.left,
            body.style.top,
            body.style.width,
            body.style.height,
          ],
          alignment: [shown.style.textAlign, shown.style.justifyContent],
          wrap: body.style.textWrap,
          font: [
            block.style.fontFamily,
            block.style.fontSize,
            block.style.lineHeight,
          ],
          lines: Array.from(block.children, row => row.textContent),
          marker: marker && {
            text: marker.textContent,
            size: marker.style.fontSize,
          },
          reference: page?.querySelector(
            `[data-kind="reference"] .${classes.shown}`,
          )?.textContent,
        };
        view.dispose();
        return result;
      }
      const fitted = vi
        .spyOn(ThemeElementView.prototype, 'fittedTextSize')
        .mockReturnValue(71);
      const target = vi.spyOn(ThemeElementView.prototype, 'targetTextSize');
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
        function (this: HTMLElement) {
          return this.closest('[data-slide-measure]') === null
            ? 0
            : this.textContent === longerText
              ? 140
              : 80;
        },
      );
      for (const screen of screens) {
        const bible = render(true, screen);
        target.mockClear();
        expect(render(false, screen), screen.kind).toEqual(bible);
        expect(bible.lines).toEqual([
          '17 비록 무화과나무가',
          '무성하지 못하며 (계속)',
        ]);
        expect(bible.reference).toBe(reference);
        expect(bible.marker?.text).toBe(' (계속)');
        expect(Number.parseFloat(bible.marker?.size ?? '')).toBeLessThan(
          Number.parseFloat(bible.font[1] ?? ''),
        );
        if (screen.kind === 'audience') {
          expect(bible.alignment[1]).toBe('flex-start');
        }
        if (screen.kind === 'stage') expect(target).toHaveBeenCalledWith(71);
        if (screen.kind === 'broadcast') {
          expect(bible.frame[3]).toBe('140px');
        }
      }
      fitted.mockRestore();
    },
  );

  it('renders a saved blank slide reference on audience, stage and broadcast', () => {
    const item = slidesItem('blank');
    const first = item.slides.slides[0];
    if (first === undefined || !('text' in first)) {
      throw Error('Missing text slide');
    }
    const reference = '하박국 3:17~19';
    const legacySlide = {...first, reference};
    const tiles = projectSlides({
      ...item,
      slides: {...item.slides, slides: [legacySlide]},
    });
    expect(tiles[0]?.reference).toBe(reference);
    const slide = slideLayerOf({itemId: item.id, index: 0}, () => tiles);
    if (slide === null) throw Error('Missing projected slide');
    const parsed = parseLiveCommand(slidesOutput(slide, undefined));
    if (!parsed.ok || parsed.value.type !== 'live.batch') {
      throw Error('Invalid live slide');
    }
    const command = parsed.value.commands[0];
    if (command?.type !== 'slide.show') throw Error('Missing slide command');
    const theme = currentBuiltInTheme('bible');
    const screens = [
      {kind: 'audience', id: STARTER_SCREEN_IDS.main},
      {kind: 'stage', id: STARTER_SCREEN_IDS.stage},
      {kind: 'broadcast', id: STARTER_SCREEN_IDS.broadcast},
    ] as const;
    for (const {kind, id} of screens) {
      const screenId = createScreenId(id);
      const layout = theme.screens[screenId];
      if (layout === undefined) throw Error('Missing Bible screen layout');
      const {view, text, onError} = setup();
      view.render(
        {...emptyLayers(), slide: command.slide},
        {
          ...frame(layout.elements, {
            themeId: theme.id,
            sourceScreenId: screenId,
            layout,
            item: {
              source: 'service',
              kind: 'blank',
              id: item.id,
              title: item.slides.name,
            },
          }),
          screen: {id: screenId, kind},
          transitions: false,
        },
      );
      expect(text('reference'), kind).toBe(reference);
      expect(onError, kind).not.toHaveBeenCalled();
      view.dispose();
    }
  });

  it('updates the live stage countdown from media progress without a stage background video', () => {
    const root = document.createElement('div');
    let remaining = 11;
    const progress = vi.fn(() => remaining);
    const view = new ThemeCompositionView(root, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl: id => `https://media.test/${id}`,
      previewMedia: {
        url: async id => `https://media.test/${id}`,
        remaining: progress,
      },
      onError: vi.fn(),
    });
    const element = {...themeElementBase(984), kind: 'videoTimeLeft' as const};
    view.render(
      {...song, media: {mediaId, loop: true, startedAt: 1000}},
      {
        ...frame([element]),
        screen: {id: THEME_MAIN, kind: 'stage'},
        transitions: false,
      },
    );
    expect(root.querySelector('video')).toBeNull();
    expect(root.querySelector('[data-kind="videoTimeLeft"]')?.textContent).toBe(
      '0:11',
    );
    remaining = 9;
    vi.advanceTimersByTime(1000);
    expect(root.querySelector('[data-kind="videoTimeLeft"]')?.textContent).toBe(
      '0:09',
    );
    expect(progress).toHaveBeenCalled();
    view.dispose();
  });
  it.each([
    ['song', 'stage'],
    ['bible', 'stage'],
    ['blank', 'stage'],
    ['ad', 'stage'],
    ['song', 'broadcast'],
    ['bible', 'broadcast'],
    ['blank', 'broadcast'],
    ['ad', 'broadcast'],
  ] as const)(
    'keeps the built-in %s item background off the %s layout',
    (itemKind, screenKind) => {
      const {root, view, text} = setup();
      const id = createScreenId(STARTER_SCREEN_IDS[screenKind]);
      const theme = createDefaultThemes().themes.find(
        entry => entry.id === LIGHT_SONG_THEME_ID,
      );
      const layout = theme?.screens[id];
      if (!theme || !layout) throw Error('Missing built-in screen layout');
      const item = {id: 'invented', kind: itemKind, source: 'service' as const};
      const base = frame(layout.elements, {themeId: theme.id, layout, item});
      if (base.theme === undefined) throw Error('Missing theme frame');
      const active = {
        ...base,
        theme: base.theme,
        screen: {id, kind: screenKind},
        transitions: false,
      };
      const live = {...song, media: {mediaId, loop: true, startedAt: 1000}};
      view.render(live, active);
      const background = root.querySelector<HTMLElement>(
        '[data-theme-background]',
      );
      const original = background?.style.background;
      view.render(live, {
        ...active,
        theme: {
          ...active.theme,
          item: {
            ...item,
            backgroundOverride: {kind: 'media', mediaId, loop: true},
          },
        },
      });
      expect(
        root.querySelector<HTMLElement>('[data-theme-background]')?.style
          .background,
      ).toBe(original);
      expect(root.querySelector(`video[src*="${mediaId}"]`)).toBeNull();
      expect(root.querySelector(`img[src*="${mediaId}"]`)).toBeNull();
      expect(text('currentText')).toContain('Invented line');
      if (screenKind === 'stage') {
        expect(root.querySelector('[data-kind="clock"]')).not.toBeNull();
      }
      view.dispose();
    },
  );

  it.each(['stage', 'broadcast'] as const)(
    'keeps the item background out of a custom %s background element',
    screenKind => {
      const {root, view} = setup();
      const background = {
        ...themeElementBase(806),
        kind: 'background' as const,
        frame: {x: 110, y: 220, w: 800, h: 450},
        fit: 'fit' as const,
        radius: 32,
      };
      const item = {
        id: 'invented',
        kind: 'song' as const,
        source: 'service' as const,
        backgroundOverride: {kind: 'media' as const, mediaId, loop: true},
      };
      const fixedId = createMediaId('00000000-0000-4000-8000-000000000602');
      const fixed = {
        ...themeElementBase(807),
        kind: 'image' as const,
        mediaId: fixedId,
        fit: 'fill' as const,
        radius: 0,
      };
      view.render(
        {...song, media: {mediaId, loop: true, startedAt: 1000}},
        {
          ...frame([fixed, background], {
            item,
            layout: {
              mode: {kind: 'own'},
              background: '#123456',
              elements: [fixed, background],
            },
          }),
          screen: {id: THEME_MAIN, kind: screenKind},
          transitions: false,
        },
      );
      const element = root.querySelector<HTMLElement>(
        '[data-kind="background"]',
      );
      expect(element?.style.left).toBe('110px');
      expect(element?.style.top).toBe('220px');
      expect(element?.style.width).toBe('800px');
      expect(element?.style.height).toBe('450px');
      expect(element?.style.borderRadius).toBe('32px');
      expect(root.querySelector(`video[src*="${mediaId}"]`)).toBeNull();
      expect(root.querySelector(`img[src*="${mediaId}"]`)).toBeNull();
      expect(root.querySelector(`img[src*="${fixedId}"]`)).not.toBeNull();
      expect(
        root.querySelector<HTMLElement>('[data-theme-background]')?.style
          .backgroundColor,
      ).toBe('rgb(18, 52, 86)');
      view.dispose();
    },
  );

  it('keeps a transparent broadcast free of item backgrounds even when the layout has a background element', () => {
    const {root, view} = setup(true);
    const background = {
      ...themeElementBase(806),
      kind: 'background' as const,
      fit: 'fill' as const,
      radius: 0,
    };
    view.render(
      {...song, media: {mediaId, loop: true, startedAt: 1000}},
      {
        ...frame([background], {
          item: {
            id: 'invented',
            kind: 'song',
            source: 'service',
            backgroundOverride: {kind: 'media', mediaId, loop: true},
          },
        }),
        screen: {id: THEME_MAIN, kind: 'broadcast'},
        transitions: false,
      },
    );
    expect(root.querySelector(`video[src*="${mediaId}"]`)).toBeNull();
    view.dispose();
  });

  it.each(['stage', 'broadcast'] as const)(
    'keeps slide pictures visible through a %s media element',
    kind => {
      const {root, view} = setup();
      if (song.slide === null) throw Error('Missing slide');
      const background = {
        ...themeElementBase(808),
        kind: 'background' as const,
        fit: 'fill' as const,
        radius: 0,
      };
      const media = {
        ...themeElementBase(809),
        kind: 'media' as const,
        fit: 'fit' as const,
        radius: 0,
      };
      view.render(
        {
          ...song,
          slide: {...song.slide, picture: mediaId},
          media: {mediaId, loop: false, slidePicture: true, startedAt: 1000},
        },
        {
          ...frame([background, media]),
          screen: {id: THEME_MAIN, kind},
          transitions: false,
        },
      );
      expect(
        root.querySelector(`[data-kind="media"] video[src*="${mediaId}"]`),
      ).not.toBeNull();
      expect(
        root.querySelector(`[data-kind="background"] video[src*="${mediaId}"]`),
      ).toBeNull();
      view.dispose();
    },
  );
  it('backs stage clock and timer only while a picture is the live content', () => {
    const {root, view, text} = setup();
    const timerId = createTimerId('00000000-0000-4000-8000-000000000701');
    const elements: ThemeElement[] = [
      {...themeElementBase(1), kind: 'clock', clockFormat: '24h'},
      {...themeElementBase(2), kind: 'timer', timerId},
    ];
    const stage = {
      ...frame(elements),
      screen: {id: THEME_MAIN, kind: 'stage' as const},
      transitions: false,
      timers: {
        list: [
          {
            id: timerId,
            name: 'Timer',
            kind: 'countdown' as const,
            duration: 300,
          },
        ],
        runs: undefined,
        now: () => ({wall: 0, timer: 0}),
      },
    };
    if (song.slide === null || stage.theme === undefined) {
      throw Error('Missing fixture');
    }
    const picture = {...song, slide: {...song.slide, picture: mediaId}};
    const boxes = () => [
      ...root.querySelectorAll<HTMLElement>(
        '[data-kind="clock"], [data-kind="timer"]',
      ),
    ];
    view.render(picture, stage);
    expect(boxes()).toHaveLength(2);
    expect(text('timer')).toBe('5:00');
    expect(root.querySelector<HTMLElement>('[data-kind=timer]')?.hidden).toBe(
      false,
    );
    expect(
      boxes().every(box => box.hasAttribute('data-stage-picture-utility')),
    ).toBe(true);
    expect(boxes().every(box => box.style.overflow === 'visible')).toBe(true);
    view.render(song, stage);
    expect(
      boxes().every(box => !box.hasAttribute('data-stage-picture-utility')),
    ).toBe(true);
    expect(boxes().every(box => box.style.overflow === 'hidden')).toBe(true);
    view.render(picture, {
      ...stage,
      screen: {id: THEME_MAIN, kind: 'audience'},
    });
    expect(
      boxes().every(box => !box.hasAttribute('data-stage-picture-utility')),
    ).toBe(true);
    const media = {
      ...song,
      slide: null,
      media: {mediaId, loop: false, startedAt: 0},
    };
    view.render(media, {
      ...stage,
      theme: {
        ...stage.theme,
        item: {id: 'image', kind: 'media', source: 'service'},
      },
    });
    expect(
      boxes().every(box => box.hasAttribute('data-stage-media-utility')),
    ).toBe(true);
    view.dispose();
  });

  it.each([
    ['left', 'flex-start'],
    ['center', 'center'],
    ['right', 'flex-end'],
  ] as const)(
    'keeps %s alignment for stage clock and timer on pictures',
    (align, expected) => {
      const {root, view} = setup();
      const clockBase = themeElementBase(1);
      const timerBase = themeElementBase(2);
      const elements: ThemeElement[] = [
        {
          ...clockBase,
          kind: 'clock',
          clockFormat: '24h',
          text: {...clockBase.text, align},
        },
        {...timerBase, kind: 'timer', text: {...timerBase.text, align}},
      ];
      if (song.slide === null) throw Error('Missing slide');
      view.render(
        {...song, slide: {...song.slide, picture: mediaId}},
        {
          ...frame(elements),
          screen: {id: THEME_MAIN, kind: 'stage'},
          transitions: false,
        },
      );
      const boxes = [
        ...root.querySelectorAll<HTMLElement>('[data-stage-picture-utility]'),
      ];
      expect(boxes).toHaveLength(2);
      expect(
        boxes.map(box => box.style.getPropertyValue('--stage-utility-align')),
      ).toEqual([expected, expected]);
      view.dispose();
    },
  );

  it('selects a shown still image but not a playing video for the media-item backing', async () => {
    const {root, view} = setup();
    const mediaElement: ThemeElement = {
      ...themeElementBase(3),
      kind: 'media',
      fit: 'fill',
      radius: 0,
    };
    const clock: ThemeElement = {
      ...themeElementBase(4),
      kind: 'clock',
      clockFormat: '24h',
    };
    const videoId = createMediaId('00000000-0000-4000-8000-000000000602');
    const stage = {
      ...frame([mediaElement, clock], {
        item: {id: 'item', kind: 'media', source: 'service'},
      }),
      screen: {id: THEME_MAIN, kind: 'stage' as const},
      transitions: false,
    };
    const selector = `[data-theme-page]:has([data-kind="media"] img.${classes.image}.${classes.shown}) [data-stage-media-utility] .${classes.block}`;
    const layers = {
      ...emptyLayers(),
      media: {mediaId: videoId, loop: false, startedAt: 0},
    };
    view.render(layers, stage);
    const video = root.querySelector<HTMLVideoElement>(
      '[data-kind="media"] video[src]',
    );
    if (video === null) throw Error('Missing media video');
    video.dispatchEvent(new Event('playing'));
    expect(video.classList.contains(classes.shown)).toBe(true);
    expect(root.querySelector(selector)).toBeNull();
    view.render({...layers, media: {...layers.media, mediaId}}, stage);
    const next = [
      ...root.querySelectorAll<HTMLVideoElement>(
        '[data-kind="media"] video[src]',
      ),
    ].find(node => node.getAttribute('src')?.includes(mediaId));
    if (next === undefined) throw Error('Missing media candidate');
    Object.defineProperty(next, 'error', {
      configurable: true,
      value: {code: 4},
    });
    next.dispatchEvent(new Event('error'));
    const image = root.querySelector<HTMLImageElement>(
      '[data-kind="media"] img[src]',
    );
    if (image === null) throw Error('Missing image fallback');
    image.decode = () => Promise.resolve();
    image.dispatchEvent(new Event('load'));
    await Promise.resolve();
    expect(image.classList.contains(classes.shown)).toBe(true);
    expect(root.querySelector(selector)).not.toBeNull();
    view.dispose();
  });

  it('draws a macro background over an explicit item background and holds it during a clear fade', () => {
    const {root, view, text} = setup();
    const current = {...themeElementBase(806), kind: 'currentText' as const};
    const item = {
      id: 'invented',
      kind: 'song' as const,
      source: 'service' as const,
      backgroundOverride: {kind: 'media' as const, mediaId, loop: true},
    };
    const active = {...frame([current], {item}), transitions: false};
    const first = {...song, media: {mediaId, loop: true, startedAt: 1000}};
    view.render(first, active);
    const nextId = createMediaId('00000000-0000-4000-8000-000000000602');
    const macro = {
      ...first,
      media: {mediaId: nextId, loop: true, startedAt: 2000},
    };
    view.render(macro, active);
    expect(root.querySelector(`video[src*="${nextId}"]`)).not.toBeNull();
    expect(text('currentText')).toContain('Invented line');
    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    view.render(macro, {...active, clearOpacity: {media: 0.5}});
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(root.querySelector(`video[src*="${nextId}"]`)).not.toBeNull();
    view.dispose();
  });
  it('draws an item background beneath content and restores the theme background', () => {
    const {root, view, text} = setup();
    const image = {
      ...themeElementBase(805),
      kind: 'image' as const,
      mediaId,
      fit: 'fill' as const,
      radius: 0,
      frame: {x: 0, y: 0, w: 1920, h: 1080},
    };
    const current = {...themeElementBase(806), kind: 'currentText' as const};
    const item = {
      id: 'invented',
      kind: 'song' as const,
      source: 'service' as const,
    };
    view.render(song, {
      ...frame([image, current], {
        item: {
          ...item,
          backgroundOverride: {kind: 'media', mediaId, loop: true},
          backgroundStartedAt: 1,
        },
      }),
      transitions: false,
    });
    const page = root.querySelector<HTMLElement>('[data-theme-page]');
    const background = page?.querySelector<HTMLElement>(
      '[data-theme-background]',
    );
    expect(background?.style.zIndex).toBe('0');
    expect(background?.querySelector('img')).toBeTruthy();
    expect(page?.querySelector('[data-kind="image"]')).toBeNull();
    expect(text('currentText')).toContain('Invented line');
    view.render(song, {
      ...frame([image, current], {
        item: {...item, backgroundOverride: {kind: 'none'}},
      }),
      transitions: false,
    });
    expect(root.querySelector('[data-kind="image"]')).toBeNull();
    view.render(song, {...frame([image, current], {item}), transitions: false});
    expect(root.querySelector('[data-kind="image"]')).toBeTruthy();
    view.dispose();
  });
  it('keeps stage utilities visible through both clears and restores slide content', () => {
    const {root, view, text} = setup();
    const elements: ThemeElement[] = [
      {...themeElementBase(30), kind: 'clock', clockFormat: '24h'},
      {...themeElementBase(31), kind: 'timer'},
      {...themeElementBase(32), kind: 'stageMessage'},
      fixedThemeText(),
    ];
    const stage = {
      ...frame(elements),
      screen: {id: THEME_MAIN, kind: 'stage' as const},
      stageMessage: 'Stage cue',
      transitions: false,
    };
    view.render(song, stage);
    const clock = root.querySelector<HTMLElement>('[data-kind="clock"]');
    const timer = root.querySelector<HTMLElement>('[data-kind="timer"]');
    expect(
      root.querySelector<HTMLElement>('[data-kind="stageMessage"]')?.hidden,
    ).toBe(true);
    const fixed = root.querySelector<HTMLElement>('[data-kind="text"]');
    expect(text('clock')).toBeTruthy();
    view.render({...song, slide: null}, stage);
    expect(clock?.style.opacity).toBe('1');
    if (stage.theme === undefined || stage.theme.item === null) {
      throw Error('Missing theme');
    }
    const cleared = {
      ...stage,
      theme: {
        ...stage.theme,
        item: {...stage.theme.item, contentCleared: true},
      },
    };
    view.render(emptyLayers(), cleared);
    expect(clock?.style.opacity).toBe('1');
    expect(timer?.style.opacity).toBe('1');
    expect(text('clock')).toBeTruthy();
    expect(fixed?.style.opacity).toBe('0');
    view.render(song, stage);
    expect(fixed?.style.opacity).toBe('1');
    view.dispose();
  });
  it.each(['stage', 'broadcast'] as const)(
    'draws a centered sermon passage above its title on %s',
    kind => {
      const {root, view} = setup();
      const screenId = createScreenId(STARTER_SCREEN_IDS[kind]);
      const theme = createDefaultThemes().themes.find(
        entry => entry.name === '설교 제목',
      );
      const layout = theme?.screens[screenId];
      if (!theme || !layout || song.slide === null) {
        throw Error('Missing sermon layout');
      }
      const active = frame(layout.elements, {
        themeId: theme.id,
        layout,
        item: {
          id: 'invented',
          kind: 'bible',
          source: 'service',
          title: '마태복음 11:29~30',
        },
      });
      view.render(
        {
          ...song,
          slide: {
            ...song.slide,
            kind: 'bible',
            sermonTitle: true,
            reference: '마태복음 11:29~30',
            label: null,
            lines: ['동행의 열매 : 온유'],
          },
        },
        {...active, screen: {id: screenId, kind}, transitions: false},
      );
      expect(
        root.querySelector(
          `[data-kind="${kind === 'stage' ? 'reference' : 'itemName'}"] .${classes.shown}`,
        )?.textContent,
      ).toBe('마태복음 11:29~30');
      expect(
        root.querySelector(`[data-kind="currentText"] .${classes.shown}`)
          ?.textContent,
      ).toBe('동행의 열매 : 온유');
      if (kind === 'broadcast') {
        expect(
          root.querySelector<HTMLElement>('[data-kind="box"] > div')?.style
            .background,
        ).toContain('linear-gradient');
      }
      view.dispose();
    },
  );
  it.each([
    [CREED_PRAYER_THEME_ID, 'stage'],
    [CREED_PRAYER_THEME_ID, 'broadcast'],
    [PREPARATION_THEME_ID, 'broadcast'],
  ] as const)('shows Bible references in theme %s on %s', (id, kind) => {
    const {view, text} = setup();
    const screenId = createScreenId(STARTER_SCREEN_IDS[kind]);
    const theme = createDefaultThemes().themes.find(entry => entry.id === id);
    const layout = theme?.screens[screenId];
    if (!theme || !layout || song.slide === null) throw Error('Missing layout');
    const item = {
      id: 'invented',
      kind: 'bible' as const,
      source: 'service' as const,
      title: 'Book 1:2',
    };
    const active = {
      ...frame(layout.elements, {themeId: id, layout, item}),
      screen: {id: screenId, kind},
      transitions: false,
    };
    view.render(
      {...song, slide: {...song.slide, kind: 'bible', reference: 'Book 1:2'}},
      active,
    );
    expect(text('reference')).toBe('Book 1:2');
    view.render(
      {...song, slide: {...song.slide, kind: 'song', reference: 'Not Bible'}},
      {
        ...frame(layout.elements, {
          themeId: id,
          layout,
          item: {...item, kind: 'song'},
        }),
        screen: {id: screenId, kind},
        transitions: false,
      },
    );
    expect(text('reference') ?? '').toBe('');
    view.dispose();
  });
  it('shows independent stage passage and item name boxes beside the sermon title', () => {
    const {root, view} = setup();
    const screenId = createScreenId(STARTER_SCREEN_IDS.stage);
    const theme = createDefaultThemes().themes.find(
      entry => entry.name === '설교 제목',
    );
    const layout = theme?.screens[screenId];
    const bibleLayout = currentBuiltInTheme('bible').screens[screenId];
    if (!theme || !layout || !bibleLayout || song.slide === null) {
      throw Error('Missing stage layout');
    }
    const title = layout.elements.find(
      element => element.kind === 'currentText',
    );
    const bible = bibleLayout.elements.find(
      element => element.kind === 'currentText',
    );
    if (title?.kind !== 'currentText' || bible?.kind !== 'currentText') {
      throw Error('Missing stage text');
    }
    expect(title.text.align).toBe('left');
    expect(title.frame.x).toBe(bible.frame.x);
    const active = frame(layout.elements, {
      themeId: theme.id,
      layout,
      item: {
        id: 'invented',
        kind: 'bible',
        source: 'service',
        title: 'Matthew 11:29',
      },
    });
    view.render(
      {
        ...song,
        slide: {
          ...song.slide,
          sermonTitle: true,
          reference: 'Matthew 11:29',
          lines: ['Sermon'],
        },
      },
      {...active, screen: {id: screenId, kind: 'stage'}, transitions: false},
    );
    expect(
      root.querySelector(`[data-kind="reference"] .${classes.shown}`)
        ?.textContent,
    ).toBe('Matthew 11:29');
    expect(root.querySelector('[data-kind="itemName"]')).toBeNull();
    expect(
      root.querySelector(`[data-kind="currentText"] .${classes.shown}`)
        ?.textContent,
    ).toBe('Sermon');
    const savedLayout = {
      ...layout,
      elements: [
        ...layout.elements,
        {...themeElementBase(987), kind: 'itemName' as const},
      ],
    };
    const savedActive = frame(savedLayout.elements, {
      themeId: theme.id,
      layout: savedLayout,
      item: {
        id: 'invented',
        kind: 'bible',
        source: 'service',
        title: 'Matthew 11:29',
      },
    });
    view.render(
      {
        ...song,
        slide: {
          ...song.slide,
          sermonTitle: true,
          reference: 'Matthew 11:29',
          lines: ['Sermon'],
          textOverrides: {
            reference: 'Edited passage',
            itemName: 'Edited stage name',
          },
        },
      },
      {
        ...savedActive,
        screen: {id: screenId, kind: 'stage'},
        transitions: false,
      },
    );
    expect(
      root.querySelector(`[data-kind="itemName"] .${classes.shown}`)
        ?.textContent,
    ).toBe('Edited stage name');
    expect(
      root.querySelector(`[data-kind="reference"] .${classes.shown}`)
        ?.textContent,
    ).toBe('Edited passage');
    view.dispose();
  });
  it.each(['stage', 'broadcast'] as const)(
    'preserves a stored two-line sermon title on %s',
    kind => {
      const {root, view} = setup();
      const screenId = createScreenId(STARTER_SCREEN_IDS[kind]);
      const theme = createDefaultThemes().themes.find(
        entry => entry.name === '설교 제목',
      );
      const layout = theme?.screens[screenId];
      if (!theme || !layout || !song.slide) throw Error('Missing sermon');
      const active = frame(layout.elements, {
        themeId: theme.id,
        layout,
        item: {
          id: 'invented',
          kind: 'bible',
          source: 'service',
          title: '마태복음 11:29',
        },
      });
      view.render(
        {
          ...song,
          slide: {
            ...song.slide,
            kind: 'bible',
            label: null,
            sermonTitle: true,
            lines: ['첫 번째 제목', '두 번째 제목'],
          },
        },
        {...active, screen: {id: screenId, kind}, transitions: false},
      );
      const block = root.querySelector(
        `[data-kind="currentText"] .${classes.shown} .${classes.block}`,
      );
      expect(block).not.toBeNull();
      expect(
        Array.from(block?.children ?? [], line => line.textContent).join('\n'),
      ).toBe('첫 번째 제목\n두 번째 제목');
      view.dispose();
    },
  );
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
        fill: 'both',
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
    const render = (kind: 'plain' | 'song') => {
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
        expect(panel?.style.backgroundColor).toBe('rgb(0, 0, 0)');
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
  it('uses the full slide width only for formatted audience song lyrics', () => {
    const {root, view} = setup();
    const element: ThemeElement = {
      ...themeElementBase(),
      kind: 'currentText',
      frame: {x: 132, y: 141, w: 1656, h: 411},
      text: {...DEFAULT_THEME_TEXT, maxLines: 2},
    };
    const active = frame([element]);
    const lyricFormat = {
      lines: [
        {boxWidth: 500, top: 154.6, runs: [{text: 'Invented line', size: 108}]},
      ],
    };
    if (song.slide === null) throw Error('Missing song slide');
    const formatted = {...song, slide: {...song.slide, lyricFormat}};
    view.render(formatted, {...active, transitions: false});
    const box = () =>
      root.querySelector<HTMLElement>('[data-kind="currentText"]');
    expect(box()?.style.left).toBe('0px');
    expect(box()?.style.width).toBe('1920px');
    expect(box()?.style.top).toBe('154.6px');
    for (const kind of ['stage', 'broadcast'] as const) {
      view.render(formatted, {
        ...active,
        screen: {id: THEME_MAIN, kind},
        transitions: false,
      });
      expect(box()?.style.top).toBe('141px');
    }
    view.render(song, {...active, transitions: false});
    expect(box()?.style.left).toBe('132px');
    expect(box()?.style.width).toBe('1656px');
    expect(box()?.style.top).toBe('141px');
    view.dispose();
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

  it('identifies an unready image and can reveal its partially prepared page', () => {
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
    view.render(song, {
      ...frame([picture], {
        themeId: createThemeId('00000000-0000-4000-8000-000000000502'),
      }),
      transitions: false,
    });
    const incoming = [
      ...root.querySelectorAll<HTMLElement>('[data-theme-page]'),
    ].at(-1);
    expect(incoming?.style.opacity).toBe('0');
    expect(view.unreadyElements()).toEqual([{kind: 'image', id: picture.id}]);
    view.revealIncomplete();
    expect(incoming?.style.opacity).toBe('1');
    expect(root.querySelectorAll('[data-theme-page]')).toHaveLength(1);
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
  it('keeps split overflow marks when the cached image omits its separate guide', () => {
    const root = document.createElement('div');
    const element: ThemeElement = {
      ...themeElementBase(),
      kind: 'currentText',
      text: {...themeElementBase().text, maxLines: 1},
    };
    const view = new ThemeCompositionView(root, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl: id => id,
      onError: vi.fn(),
      biblePreview: {elementId: element.id, maxLines: 1, hideGuide: true},
    });
    view.render(
      {
        ...song,
        slide: {
          itemId: 'split',
          position: 0,
          label: null,
          lines: ['One', 'Two'],
        },
      },
      frame([element]),
    );
    expect(
      root.querySelector<HTMLElement>(`.${classes.bibleGuide}`)?.hidden,
    ).toBe(true);
    expect(root.querySelector(`.${classes.bibleOverflow}`)?.textContent).toBe(
      'Two',
    );
    view.dispose();
  });
  it('draws the full Bible reference and translation on the screen reference element', () => {
    const {view, text} = setup();
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'reference'},
    ];
    const [tile] = bibleVerseTiles(
      {...panelPassage(), translationLabel: '개역한글'},
      {reference: 'every', translationName: true},
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
      const page = root.querySelector<HTMLElement>('[data-theme-background]');
      expect(page?.style.backgroundColor).toBe('rgb(18, 52, 86)');
      view.render(emptyLayers(), frame([], {layout, emptyColor: '#654321'}));
      expect(root.querySelector('[data-theme-background]')).toBe(page);
      expect(page?.style.backgroundColor).toBe('rgb(101, 67, 33)');
      const override = {...layout, background: '#ABCDEF'};
      view.render(emptyLayers(), frame([], {layout: override}));
      const overridden = [
        ...root.querySelectorAll<HTMLElement>('[data-theme-background]'),
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
  it('hides the whole theme on clear all and restores it', () => {
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
    const background = root.querySelector<HTMLElement>(
      '[data-theme-background]',
    );
    const box = root.querySelector<HTMLElement>('[data-kind="box"]');
    expect(background?.style.opacity).toBe('0');
    expect(box?.style.opacity).toBe('0');
    view.render(song, frame(elements));
    expect(background?.style.opacity).toBe('1');
    expect(box?.style.opacity).toBe('1');
    expect(text('currentText')).toBe('Invented line');
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
    expect(onError).toHaveBeenCalledTimes(2);
    view.render(song, {...frame(elements, {revision: 2}), fonts: []});
    expect(onError).toHaveBeenCalledTimes(3);
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
    '29 나는 마음이 온유하고 겸손하니',
    '나의 멍에를 메고 내게 배우라 그리하면 너희',
    '마음이 쉼을 얻으리니',
  ];
  const next = ['30 이는 내 멍에는 쉽고', '내 짐은 가벼움이라', '하시니라'];
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
      label: 'Verse',
      next: {label: null, lines: next, itemKind: 'song' as const},
    },
  };
  view.render(songLayers, {
    ...base,
    screen: {id: THEME_MAIN, kind: 'stage'},
    transitions: false,
  });
  expect(rows('currentText')).toEqual(current);
  expect(root.querySelector('[data-kind="label"]')?.textContent).toContain(
    '(Verse)',
  );
  expect(rows('nextText')).toEqual(next.slice(0, 2));
  expect(
    root.querySelector<HTMLElement>('[data-kind="currentText"]')?.style
      .textWrap,
  ).toBe('');
  view.dispose();
});

it.each(['bible', 'blank', 'ad'] as const)(
  'keeps typed scripture breaks for %s text on every screen',
  kind => {
    const {root, view} = setup();
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'currentText'},
      {...themeElementBase(31), kind: 'nextText'},
    ];
    const base = frame(elements);
    if (!base.theme?.item) throw Error('Missing item');
    const layers: LiveLayers = {
      ...emptyLayers(),
      slide: {
        itemId: 'invented',
        position: 0,
        kind,
        reference: 'John 3:16',
        label: null,
        lines: ['첫 문장\n둘째 문장'],
        next: {
          label: null,
          itemKind: 'bible',
          lines: ['다음 첫줄\n다음 둘째줄'],
        },
      },
    };
    for (const screenKind of ['audience', 'stage', 'broadcast'] as const) {
      view.render(layers, {
        ...base,
        screen: {id: THEME_MAIN, kind: screenKind},
        theme: {...base.theme, item: {...base.theme.item, kind}},
        transitions: false,
      });
      const rows = (element: string) =>
        Array.from(
          root.querySelectorAll(
            `[data-kind="${element}"] .${classes.shown} .${classes.block} > div`,
          ),
          row => row.textContent,
        );
      expect(rows('currentText')).toEqual(['첫 문장', '둘째 문장']);
      if (screenKind === 'stage') {
        expect(rows('nextText')).toEqual(['다음 첫줄', '다음 둘째줄']);
      }
    }
    view.dispose();
  },
);

it('keeps sermon title lines on stage and broadcast, including stage next text', () => {
  const {root, view} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(), kind: 'currentText'},
    {...themeElementBase(31), kind: 'nextText', lineLimit: 2},
  ];
  const lines = ['Sermon title', 'English subtitle'];
  const layers: LiveLayers = {
    ...emptyLayers(),
    slide: {
      itemId: 'invented',
      position: 0,
      label: 'Verse',
      lines,
      sermonTitle: true,
      next: {label: 'Verse', lines, sermonTitle: true, itemKind: 'bible'},
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
    expect(rows('currentText')).toEqual(lines);
    if (kind === 'stage') expect(rows('nextText')).toEqual(lines);
  }
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

it('sizes an ad cue against the fitted current ad title, falling back to its body', () => {
  const {view} = setup();
  let titleSize: number | undefined = 108;
  const size = vi
    .spyOn(ThemeElementView.prototype, 'fittedTextSize')
    .mockImplementation(function (this: ThemeElementView) {
      return this.element.kind === 'slideName' ? titleSize : 86;
    });
  const target = vi.spyOn(ThemeElementView.prototype, 'targetTextSize');
  const elements: ThemeElement[] = [
    {...themeElementBase(), kind: 'slideName'},
    {...themeElementBase(31), kind: 'currentText'},
    {...themeElementBase(32), kind: 'nextText'},
  ];
  const stageFrame = frame(elements);
  const layers: LiveLayers = {
    ...emptyLayers(),
    slide: {
      itemId: 'ad',
      position: 0,
      kind: 'ad',
      label: 'Title',
      lines: ['Body'],
      next: {label: 'Next', adTitle: 'Next', lines: []},
    },
  };
  view.render(layers, {...stageFrame, screen: {id: THEME_MAIN, kind: 'stage'}});
  expect(target).toHaveBeenLastCalledWith(72);
  titleSize = undefined;
  view.render(layers, {...stageFrame, screen: {id: THEME_MAIN, kind: 'stage'}});
  expect(target).toHaveBeenLastCalledWith(86 * (2 / 3));
  target.mockRestore();
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

it('fits the stage current text toward the audience rendered size', () => {
  const {view} = setup();
  const stageElement: ThemeElement = {
    ...themeElementBase(31),
    kind: 'currentText',
  };
  const audienceElement: ThemeElement = {
    ...themeElementBase(32),
    kind: 'currentText',
  };
  const stageFrame = frame([stageElement]);
  const audienceFrame = frame([audienceElement]);
  if (!audienceFrame.theme) throw Error('Missing audience theme');
  vi.spyOn(ThemeElementView.prototype, 'fittedTextSize').mockImplementation(
    function (this: ThemeElementView) {
      return this.element.id === audienceElement.id ? 77 : 79;
    },
  );
  const target = vi.spyOn(ThemeElementView.prototype, 'targetTextSize');
  view.render(song, {
    ...stageFrame,
    screen: {id: THEME_MAIN, kind: 'stage'},
    audience: {
      screen: {id: THEME_MAIN, kind: 'audience'},
      theme: audienceFrame.theme,
    },
  });
  expect(target).toHaveBeenCalledWith(77);
  view.dispose();
});

it.each(['bible', 'blank'] as const)(
  'targets the fitted audience size and the final stage next size for %s scripture',
  kind => {
    const {view} = setup();
    const stageCurrent: ThemeElement = {
      ...themeElementBase(701),
      kind: 'currentText',
    };
    const stageNext: ThemeElement = {
      ...themeElementBase(702),
      kind: 'nextText',
    };
    const audienceCurrent: ThemeElement = {
      ...themeElementBase(703),
      kind: 'currentText',
    };
    const stageFrame = frame([stageCurrent, stageNext]);
    const audienceFrame = frame([audienceCurrent]);
    if (!stageFrame.theme?.item || !audienceFrame.theme) {
      throw Error('Missing theme');
    }
    const sizes = vi
      .spyOn(ThemeElementView.prototype, 'fittedTextSize')
      .mockImplementation(function (this: ThemeElementView) {
        return this.element.id === audienceCurrent.id ? 57 : 52;
      });
    const target = vi.spyOn(ThemeElementView.prototype, 'targetTextSize');
    view.render(
      {
        ...song,
        slide: {
          itemId: 'invented',
          position: 0,
          label: null,
          kind,
          reference: 'John 3:16',
          lines: ['First authored line\nSecond authored line'],
          next: {label: null, itemKind: kind, lines: ['Following verse']},
        },
      },
      {
        ...stageFrame,
        screen: {id: THEME_MAIN, kind: 'stage'},
        theme: {...stageFrame.theme, item: {...stageFrame.theme.item, kind}},
        audience: {
          screen: {id: THEME_MAIN, kind: 'audience'},
          theme: audienceFrame.theme,
        },
      },
    );
    expect(target).toHaveBeenCalledWith(57);
    expect(target).toHaveBeenLastCalledWith((52 * 2) / 3);
    target.mockRestore();
    sizes.mockRestore();
    view.dispose();
  },
);

it('draws the audience layout lines on stage, including audience wrapping', () => {
  const {root, view} = setup();
  if (!song.slide) throw Error('Missing slide');
  const audienceElement: ThemeElement = {
    ...themeElementBase(32),
    kind: 'currentText',
  };
  const stageFrame = frame([{...themeElementBase(31), kind: 'currentText'}]);
  const audienceFrame = frame([audienceElement]);
  if (!audienceFrame.theme) throw Error('Missing audience theme');
  vi.spyOn(ThemeElementView.prototype, 'renderedTextLines').mockReturnValue([
    '우리로 여호와의 심으신',
    '의의 나무 되어',
    '주께 영광 돌리라',
  ]);
  view.render(
    {
      ...song,
      slide: {
        ...song.slide,
        kind: 'song',
        lines: ['우리로 여호와의 심으신 의의 나무 되어', '주께 영광 돌리라'],
      },
    },
    {
      ...stageFrame,
      screen: {id: THEME_MAIN, kind: 'stage'},
      audience: {
        screen: {id: THEME_MAIN, kind: 'audience'},
        theme: audienceFrame.theme,
      },
      transitions: false,
    },
  );
  const block = Array.from(
    root.querySelectorAll<HTMLElement>(
      `[data-kind="currentText"] .${classes.shown} .${classes.block}`,
    ),
  ).at(-1);
  expect(Array.from(block?.children ?? [], row => row.textContent)).toEqual([
    '우리로 여호와의 심으신',
    '의의 나무 되어',
    '주께 영광 돌리라',
  ]);
  expect(block?.style.whiteSpace).toBe('pre');
  view.dispose();
});

it.each([undefined, '전주', '간주', '후주'])(
  'matches audience title and subtitle sizes on stage with label %s',
  label => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1920);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
      1080,
    );
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100);
    vi.spyOn(ThemeElementView.prototype, 'fittedTextSize').mockImplementation(
      function (this: ThemeElementView) {
        return this.element.kind === 'text' && this.element.content === '제목'
          ? 120
          : this.element.kind === 'text' && this.element.content === '첫 가사'
            ? 64
            : 108;
      },
    );
    const {view, root} = setup();
    const stageFrame = frame([{...themeElementBase(31), kind: 'currentText'}]);
    const audienceFrame = frame([
      {...themeElementBase(32), kind: 'currentText'},
    ]);
    if (!audienceFrame.theme) throw Error('Missing audience theme');
    if (!song.slide) throw Error('Missing song');
    view.render(
      {
        ...song,
        slide: {
          ...song.slide,
          titleSlide: true,
          lines: ['제목', '첫 가사'],
          label: label ?? null,
        },
      },
      {
        ...stageFrame,
        screen: {id: THEME_MAIN, kind: 'stage'},
        audience: {
          screen: {id: THEME_MAIN, kind: 'audience'},
          theme: {
            ...audienceFrame.theme,
            layout: {...audienceFrame.theme.layout, songTitle: 'sunday'},
          },
        },
      },
    );
    const rows = root.querySelectorAll<HTMLElement>(
      `[data-kind="currentText"] .${classes.shown} .${classes.block} > div`,
    );
    expect([...rows].map(row => row.style.fontSize)).toEqual(['120px', '64px']);
    expect([...rows].map(row => row.textContent)).toEqual([
      '제목',
      label ? `첫 가사 (${label})` : '첫 가사',
    ]);
    view.dispose();
  },
);

it('lets a stage song next line shrink below 48px without wrapping', () => {
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
  expect(block?.style.fontSize).toBe('1px');
  expect(block?.style.whiteSpace).toBe('pre');
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
    expect(current()?.textContent).toBe('(없음)');
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
    expect(current()?.textContent).toBe('(없음)');
    view.render(song, stage);
    expect(current()?.textContent).toBe('Invented line');
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
    expect(element(SECTION_BAND_ID)?.style.top).toBe('756px');
    expect(element(SECTION_BAND_ID)?.style.height).toBe('234px');
    expect(
      element(SECTION_BAND_ID)?.firstElementChild?.getAttribute('style'),
    ).toContain('18%');
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
  expect(text()).toBe('(없음)');
  expect(
    root.querySelector<HTMLElement>(
      `[data-kind="nextText"] .${classes.shown} .${classes.block}`,
    )?.style.color,
  ).toBe('rgb(255, 214, 107)');
  layers = {
    ...layers,
    slide: {...slide, next: {label: null, lines: [], stageStandby: true}},
  };
  show('stage');
  expect(text().trim()).toBe('');
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

it('shows only the main title box in the stage next preview', () => {
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
    draw({label: '전주', titleSlide: true, lines: ['찬양']}, 'stage'),
  ).toBe('찬양 (전주)');
  expect(draw({label: 'Verse', lines: ['Text']}, 'stage')).toBe('(Verse) Text');
  expect(draw({label: '간주', lines: []}, 'stage')).toBe('(간주)');
  expect(
    draw(
      {label: null, titleSlide: true, lines: ['찬양', 'English title']},
      'stage',
    ),
  ).not.toContain('English title');
  expect(
    draw(
      {
        label: null,
        titleSlide: true,
        titleLineCount: 2,
        lines: ['새찬송가 91장', '슬픈 마음 있는 사람', 'English'],
      },
      'stage',
    ),
  ).toContain('슬픈 마음 있는 사람');
  expect(
    draw(
      {
        label: null,
        titleSlide: true,
        titleLineCount: 2,
        lines: ['새찬송가 91장', '슬픈 마음 있는 사람', 'English'],
      },
      'stage',
    ),
  ).not.toContain('English');
  expect(
    draw(
      {label: null, titleSlide: true, lines: ['찬양', 'English title']},
      'audience',
    ),
  ).toContain('English title');
  expect(
    draw(
      {label: null, titleSlide: true, lines: ['임재', '하늘의 문을 여소서']},
      'stage',
    ),
  ).toContain('하늘의 문을 여소서');
  view.dispose();
});

it('shows both title lines on stage while retaining the section name', () => {
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
      titleLineCount: 2,
      lines: ['새찬송가 91장', '슬픈 마음 있는 사람'],
    },
  };
  const draw = (layers: LiveLayers, kind: 'stage' | 'audience' | 'broadcast') =>
    view.render(layers, {
      ...frame(elements),
      screen: {id: THEME_MAIN, kind},
      transitions: false,
    });
  const current = () =>
    root.querySelector(`[data-kind="currentText"] .${classes.shown}`)
      ?.textContent ?? '';
  draw(title, 'stage');
  expect(current()).toContain('새찬송가 91장');
  expect(current()).toContain('슬픈 마음 있는 사람');
  const separate = {
    ...title,
    slide: {
      ...title.slide,
      titleLineCount: 1,
      lines: ['날마다 숨쉬는 순간마다', 'Day by Day'],
    },
  };
  draw(separate, 'stage');
  expect(current()).toContain('날마다 숨쉬는 순간마다');
  expect(current()).not.toContain('Day by Day');
  draw(separate, 'broadcast');
  expect(current()).toContain('날마다 숨쉬는 순간마다');
  expect(current()).not.toContain('Day by Day');
  draw(separate, 'audience');
  expect(current()).toContain('Day by Day');
  const koreanSubtitle = {
    ...separate,
    slide: {...separate.slide, lines: ['임재', '하늘의 문을 여소서']},
  };
  for (const kind of ['stage', 'broadcast'] as const) {
    draw(koreanSubtitle, kind);
    expect(current()).toContain('임재');
    expect(current()).toContain('하늘의 문을 여소서');
  }
  draw(title, 'audience');
  expect(current()).toContain('새찬송가 91장');
  expect(current()).toContain('슬픈 마음 있는 사람');
  draw(title, 'broadcast');
  expect(current()).toContain('새찬송가 91장');
  expect(current()).toContain('슬픈 마음 있는 사람');
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

it('shows stage lyric labels on their own line only at their start', () => {
  const {root, view} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(), kind: 'currentText'},
    {...themeElementBase(31), kind: 'nextText'},
    {...themeElementBase(32), kind: 'label'},
  ];
  const slide = song.slide;
  if (slide === null) throw Error('Missing slide');
  const draw = (
    title: boolean,
    screen: 'stage' | 'audience',
    continued = false,
  ) =>
    view.render(
      {
        ...song,
        slide: {
          ...slide,
          label: 'Verse',
          ...(continued ? {labelContinued: true as const} : {}),
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
  expect(text('currentText')).toBe('Current');
  expect(text('label')).toBe('Verse');
  expect(
    Array.from(
      root.querySelectorAll(`[data-kind="label"] .${classes.shown}`),
    ).map(node => node.textContent),
  ).toEqual(['Verse', '(Verse)']);
  expect(text('nextText')).toBe('(Outro) Next');
  draw(false, 'stage', true);
  expect(text('currentText')).toBe('Current');
  expect(text('label')).toBe('Verse');
  expect(root.querySelectorAll('[data-kind="label"]')).toHaveLength(1);
  expect(text('nextText')).toBe('(Outro) Next');
  draw(true, 'stage');
  expect(text('currentText')).toBe('Current');
  expect(text('nextText')).toBe('Next');
  draw(false, 'audience');
  expect(text('currentText')).toBe('Current');
  expect(text('nextText')).toBe('Next');
  view.dispose();
});

it.each(['전주', '간주', '후주'])(
  'shows the %s cue once on song titles for all label positions',
  label => {
    const {root, view} = setup();
    if (!song.slide) throw Error('Missing slide');
    const slide = song.slide;
    const elements: ThemeElement[] = [
      {...themeElementBase(), kind: 'currentText'},
      {...themeElementBase(32), kind: 'label'},
    ];
    const draw = (
      position: 'line' | 'inline' | 'off',
      title: boolean,
      kind: 'song' | 'bible' = 'song',
    ) =>
      view.render(
        {
          ...song,
          slide: {
            ...slide,
            kind,
            label,
            lines: ['Title'],
            ...(title ? {titleSlide: true as const} : {}),
          },
        },
        {
          ...frame(elements),
          screen: {id: THEME_MAIN, kind: 'stage'},
          stageLyricLabelPosition: position,
          transitions: false,
        },
      );
    const text = (kind: string) =>
      root.querySelector(`[data-kind="${kind}"] .${classes.shown}`)
        ?.textContent ?? '';
    for (const position of ['line', 'inline', 'off'] as const) {
      draw(position, true);
      expect(text('label')).toBe('');
      expect(text('currentText')).toBe(
        position === 'off' ? 'Title' : `Title (${label})`,
      );
    }
    draw('line', false);
    expect(text('label')).toBe('');
    expect(text('currentText')).toBe(`Title (${label})`);
    draw('line', true, 'bible');
    expect(text('label')).toBe(label);
    view.dispose();
  },
);

it('shows the intro cue on an image-backed song slide without extracted text', () => {
  const {view, text} = setup();
  if (!song.slide) throw Error('Missing slide');
  view.render(
    {
      ...song,
      slide: {...song.slide, label: '전주', lines: [], picture: mediaId},
    },
    {
      ...frame([
        {...themeElementBase(), kind: 'currentText'},
        {...themeElementBase(32), kind: 'label'},
      ]),
      screen: {id: THEME_MAIN, kind: 'stage'},
      transitions: false,
    },
  );
  expect(text('currentText')).toBe('(전주)');
  view.dispose();
});

it.each([false, true])(
  'shows the intro cue with a short imported caption (titleSlide: %s)',
  titleSlide => {
    const {view, text} = setup();
    if (!song.slide) throw Error('Missing slide');
    view.render(
      {
        ...song,
        slide: {
          ...song.slide,
          label: '전주',
          lines: ['난 구원의 하나님을 인해 기뻐하리라'],
          ...(titleSlide ? {titleSlide: true as const} : {}),
        },
      },
      {
        ...frame([{...themeElementBase(), kind: 'currentText'}]),
        screen: {id: THEME_MAIN, kind: 'stage'},
        transitions: false,
      },
    );
    expect(text('currentText')).toBe(
      '난 구원의 하나님을 인해 기뻐하리라 (전주)',
    );
    view.dispose();
  },
);

it('keeps other song title labels in the top line', () => {
  const {root, view} = setup();
  if (!song.slide) throw Error('Missing slide');
  view.render(
    {
      ...song,
      slide: {
        ...song.slide,
        kind: 'song',
        titleSlide: true,
        label: 'Verse',
        lines: ['Title'],
      },
    },
    {
      ...frame([
        {...themeElementBase(), kind: 'currentText'},
        {...themeElementBase(32), kind: 'label'},
      ]),
      screen: {id: THEME_MAIN, kind: 'stage'},
      transitions: false,
    },
  );
  expect(
    root.querySelector(`[data-kind="label"] .${classes.shown}`)?.textContent,
  ).toBe('Verse');
  expect(
    root.querySelector(`[data-kind="currentText"] .${classes.shown}`)
      ?.textContent,
  ).toBe('Title');
  view.dispose();
});

it('uses the selected song label position without changing Bible labels', () => {
  const {root, view} = setup();
  if (song.slide === null) throw Error('Missing slide');
  const slide = song.slide;
  const elements: ThemeElement[] = [
    {...themeElementBase(), kind: 'currentText'},
    {...themeElementBase(31), kind: 'nextText'},
    {...themeElementBase(32), kind: 'label'},
    {...themeElementBase(33), kind: 'nextLabel'},
  ];
  const draw = (
    position: 'line' | 'inline' | 'off',
    continued = false,
    bible = false,
  ) =>
    view.render(
      {
        ...song,
        slide: {
          ...slide,
          kind: bible ? 'bible' : 'song',
          label: 'Verse',
          lines: ['Current'],
          ...(continued ? {labelContinued: true as const} : {}),
          next: {
            itemKind: bible ? 'bible' : 'song',
            label: 'Chorus',
            lines: ['Next'],
            ...(continued ? {labelContinued: true as const} : {}),
          },
        },
      },
      {
        ...frame(elements),
        screen: {id: THEME_MAIN, kind: 'stage'},
        stageLyricLabelPosition: position,
        transitions: false,
      },
    );
  const text = (kind: string) =>
    root.querySelector(`[data-kind="${kind}"] .${classes.shown}`)
      ?.textContent ?? '';
  draw('line');
  expect(text('currentText')).toBe('Current');
  expect(root.querySelectorAll('[data-kind="label"]')).toHaveLength(2);
  expect(text('nextText')).toBe('(Chorus) Next');
  draw('inline');
  expect(text('currentText')).toBe('(Verse) Current');
  expect(root.querySelectorAll('[data-kind="label"]')).toHaveLength(1);
  expect(text('nextText')).toBe('(Chorus) Next');
  draw('inline', true);
  expect(text('currentText')).toBe('Current');
  expect(text('nextText')).toBe('Next');
  draw('off');
  expect(text('currentText')).toBe('Current');
  expect(text('nextText')).toBe('Next');
  expect(text('label')).toBe('');
  expect(text('nextLabel')).toBe('');
  draw('off', false, true);
  expect(text('label')).toBe('Verse');
  view.dispose();
});

it('keeps current song rows unwrapped on stage when they fit above 48 pixels', () => {
  const {root, view} = setup();
  if (song.slide === null) throw Error('Missing slide');
  view.render(
    {
      ...song,
      slide: {
        ...song.slide,
        kind: 'song',
        lines: ['우리로 여호와의 심으신 의의 나무 되어', '주께 영광 돌리라'],
      },
    },
    {
      ...frame([{...themeElementBase(), kind: 'currentText'}]),
      screen: {id: THEME_MAIN, kind: 'stage'},
      transitions: false,
    },
  );
  const block = root.querySelector<HTMLElement>(
    `[data-kind="currentText"] .${classes.shown} .${classes.block}`,
  );
  expect(block?.style.whiteSpace).toBe('pre');
  expect(block?.children).toHaveLength(2);
  expect(Array.from(block?.children ?? [], row => row.textContent)).toEqual([
    '우리로 여호와의 심으신 의의 나무 되어',
    '주께 영광 돌리라',
  ]);
  view.dispose();
});

it('hides an empty song label only on stage when labels are off', () => {
  const {root, view} = setup();
  if (!song.slide) throw Error('Missing slide');
  const layers = {
    ...song,
    slide: {
      ...song.slide,
      kind: 'song' as const,
      lines: [],
      label: 'Verse',
      next: {itemKind: 'song' as const, label: 'Chorus', lines: []},
    },
  };
  const elements: ThemeElement[] = [
    {...themeElementBase(), kind: 'currentText'},
    {...themeElementBase(31), kind: 'nextText'},
  ];
  const draw = (stageLyricLabelPosition: 'line' | 'off') =>
    view.render(layers, {
      ...frame(elements),
      screen: {id: THEME_MAIN, kind: 'stage'},
      stageLyricLabelPosition,
      transitions: false,
    });
  const text = (kind: string) =>
    root.querySelector(`[data-kind="${kind}"] .${classes.shown}`)
      ?.textContent ?? '';
  draw('line');
  expect(text('currentText')).toBe('(Verse)');
  expect(text('nextText')).toBe('(Chorus)');
  draw('off');
  expect(text('currentText')).toBe('(없음)');
  expect(text('nextText')).toBe('(없음)');
  view.dispose();
});

it('omits a continuing next label on stage but shows a changed label', () => {
  const {root, view} = setup();
  if (song.slide === null) throw Error('Missing slide');
  const slide = song.slide;
  const draw = (continued: boolean) =>
    view.render(
      {
        ...song,
        slide: {
          ...slide,
          next: {
            label: continued ? 'Verse' : 'Chorus',
            lines: ['Next'],
            ...(continued ? {labelContinued: true as const} : {}),
          },
        },
      },
      {
        ...frame([
          {...themeElementBase(31), kind: 'nextText'},
          {...themeElementBase(32), kind: 'nextLabel'},
        ]),
        screen: {id: THEME_MAIN, kind: 'stage'},
        transitions: false,
      },
    );
  const text = (kind: string) =>
    root.querySelector(`[data-kind="${kind}"] .${classes.shown}`)
      ?.textContent ?? '';
  draw(true);
  expect(text('nextText')).toBe('Next');
  expect(text('nextLabel').trim()).toBe('');
  draw(false);
  expect(text('nextText')).toBe('(Chorus) Next');
  expect(text('nextLabel')).toBe('Chorus');
  view.render(
    {
      ...song,
      slide: {
        ...slide,
        kind: 'blank',
        label: 'Section',
        next: {
          itemKind: 'blank',
          label: 'Section',
          labelContinued: true,
          lines: ['Next'],
        },
      },
    },
    {
      ...frame([
        {...themeElementBase(31), kind: 'nextText'},
        {...themeElementBase(32), kind: 'nextLabel'},
      ]),
      screen: {id: THEME_MAIN, kind: 'stage'},
      transitions: false,
    },
  );
  expect(text('nextText')).toBe('(Section) Next');
  expect(text('nextLabel')).toBe('Section');
  view.dispose();
});

it.each(['전주', '간주', '후주'])(
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

it('keeps the stage next reference above a top-aligned next text frame', () => {
  const {root, view} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(31), kind: 'nextText'},
  ];
  if (song.slide === null) throw Error('Missing slide');
  const layers = {
    ...song,
    slide: {
      ...song.slide,
      next: {label: null, lines: ['Next'], stageReference: 'Numbers 12:3'},
    },
  };
  view.render(layers, {
    ...frame(elements),
    screen: {id: THEME_MAIN, kind: 'stage'},
    transitions: false,
  });
  const label = root.querySelector<HTMLElement>('[data-stage-next-reference]');
  expect(label?.textContent).toBe('Numbers 12:3');
  expect(label?.style.bottom).toBe('100%');
  expect(label?.parentElement?.style.overflow).toBe('visible');
  view.render(layers, {
    ...frame(elements),
    screen: {id: THEME_MAIN, kind: 'audience'},
    transitions: false,
  });
  expect(root.querySelector('[data-stage-next-reference]')?.textContent).toBe(
    '',
  );
  view.dispose();
});

it('numbers current advertisement titles only on stage', () => {
  const {root, view} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(31), kind: 'slideName'},
  ];
  if (song.slide === null) throw Error('Missing slide');
  for (const number of [1, 2]) {
    const layers = {
      ...song,
      slide: {
        ...song.slide,
        kind: 'ad' as const,
        name: 'Title',
        textSlideNumber: number,
      },
    };
    for (const kind of ['stage', 'audience', 'broadcast'] as const) {
      view.render(layers, {
        ...frame(elements),
        screen: {id: THEME_MAIN, kind},
        transitions: false,
      });
      const title = root.querySelector(
        `[data-kind="slideName"] .${classes.shown}`,
      )?.textContent;
      expect(title).toBe(kind === 'stage' ? `${number}. Title` : 'Title');
    }
  }
  view.dispose();
});

it('shows the next ad title only as a stage cue, even when its body has a manual override', () => {
  const {view, text} = setup();
  const elements: ThemeElement[] = [
    {...themeElementBase(), kind: 'currentText'},
    {...themeElementBase(31), kind: 'nextText'},
    {...themeElementBase(32), kind: 'label'},
    {...themeElementBase(33), kind: 'slideName'},
  ];
  const base = frame(elements);
  const theme = base.theme;
  const item = theme?.item;
  if (theme === undefined || item == null) throw Error('Missing item');
  const body = elements[0];
  if (body === undefined) throw Error('Missing body');
  const bodyKey = `${themeId}/${THEME_MAIN}/${body.id}`;
  const layers: LiveLayers = {
    ...emptyLayers(),
    slide: {
      itemId: 'ad',
      position: 0,
      kind: 'ad',
      label: 'Current title',
      name: 'Current title',
      lines: ['Current'],
      next: {
        label: null,
        title: '2. 3. Anniversary',
        adTitle: '3. Anniversary',
        lines: [],
        textOverrides: {[bodyKey]: 'Edited body'},
      },
    },
  };
  const adSlide = layers.slide;
  if (adSlide === null) throw Error('Missing slide');
  const render = (
    kind: 'stage' | 'audience' | 'broadcast',
    value: LiveLayers = layers,
  ) => {
    view.render(value, {
      ...base,
      screen: {id: THEME_MAIN, kind},
      theme: {...theme, item: {...item, kind: 'ad'}},
      transitions: false,
    });
    return text('nextText');
  };
  expect(render('stage')).toBe('다음광고: 3. Anniversary');
  expect(text('currentText')).toBe('Current');
  expect(text('label') ?? '').toBe('');
  expect(text('slideName')).toBe('Current title');
  const titleElement = elements[3];
  if (titleElement === undefined) throw Error('Missing title');
  const titleKey = `${themeId}/${THEME_MAIN}/${titleElement.id}`;
  const savedOnly: LiveLayers = {
    ...layers,
    slide: {
      ...adSlide,
      name: '',
      label: 'Saved edited title',
      textOverrides: {[titleKey]: 'Saved edited title'},
    },
  };
  expect(render('stage', savedOnly)).toBe('다음광고: 3. Anniversary');
  expect(text('label') ?? '').toBe('');
  expect(text('slideName')).toBe('Saved edited title');
  expect(text('currentText')).toBe('Current');
  expect(render('audience')).toBe('Edited body');
  expect(render('broadcast')).toBe('Edited body');
  const cross: LiveLayers = {
    ...layers,
    slide: {
      ...adSlide,
      next: {
        label: null,
        itemKind: 'ad',
        title: '1. Cross item',
        adTitle: 'Cross item',
        lines: [],
      },
    },
  };
  expect(render('stage', cross)).toBe('다음광고: Cross item');
  const card: LiveLayers = {
    ...layers,
    slide: {
      ...adSlide,
      next: {label: null, itemKind: 'ad', title: '광고', lines: []},
    },
  };
  expect(render('stage', card)).toBe('광고');
  const orderCard: LiveLayers = {
    ...layers,
    slide: {
      ...adSlide,
      next: {
        label: null,
        itemKind: 'blank',
        title: '봉헌',
        orderTitle: '봉헌',
        lines: [],
      },
    },
  };
  expect(render('stage', orderCard)).toBe('다음순서: 봉헌');
  expect(
    render('stage', {
      ...orderCard,
      slide: {
        ...adSlide,
        kind: 'song',
        next: {
          label: null,
          itemKind: 'blank',
          title: '봉헌',
          orderTitle: '봉헌',
          lines: [],
        },
      },
    }),
  ).toBe('다음순서: 봉헌');
  expect(render('audience', orderCard)).toBe('봉헌');
  expect(render('broadcast', orderCard)).toBe('봉헌');
  const sermonTitle: LiveLayers = {
    ...layers,
    slide: {
      ...adSlide,
      next: {
        label: null,
        itemKind: 'blank',
        title: 'Sermon title',
        sermonTitle: true,
        lines: [],
      },
    },
  };
  expect(render('stage', sermonTitle)).toBe('Sermon title');
  const blank: LiveLayers = {
    ...layers,
    slide: {
      ...adSlide,
      next: {
        label: null,
        adTitle: '',
        lines: [],
        textOverrides: {[bodyKey]: 'Wrong body'},
      },
    },
  };
  expect(render('stage', blank) ?? '').toBe('');
  const song: LiveLayers = {
    ...layers,
    slide: {
      ...adSlide,
      kind: 'song',
      next: {label: null, itemKind: 'song', lines: ['Next lyric']},
    },
  };
  expect(render('stage', song)).toBe('Next lyric');
  view.dispose();
});
