import {describe, expect, it} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {createItemOverlayId, createMediaId} from '@core/schema/ids';
import {
  themeElementBase,
  themeFile,
  themeScreens,
  THEME_MAIN,
  THEME_CAPTURE,
  THEME_STAGE,
} from '@fixtures/core/themeOutput';
import {resolveThemeOutput} from '@core/themes/output';
import {themeMediaAudible, themeOverlayAudio} from '@core/themes/audio';
import {themeOverlay} from '@core/themes/content';

const mediaId = createMediaId('00000000-0000-4000-8000-000000000701');
function fixture(): LiveState {
  const file = themeFile();
  const theme = file.themes[0];
  if (theme === undefined) throw new Error('Missing theme');
  const output = resolveThemeOutput({
    file: {
      ...file,
      themes: [
        {
          ...theme,
          screens: {
            [THEME_MAIN]: {
              mode: {kind: 'own'},
              elements: [
                {...themeElementBase(), kind: 'overlay', fit: 'fit'},
                {
                  ...themeElementBase(31),
                  kind: 'background',
                  fit: 'fit',
                  radius: 0,
                },
              ],
            },
            [THEME_CAPTURE]: {
              mode: {kind: 'same', screen: THEME_MAIN},
              elements: [],
            },
          },
        },
      ],
    },
    screens: themeScreens,
    revision: 1,
    item: {id: 'song', kind: 'song', source: 'external'},
  });
  return {
    ...emptyLiveState(),
    outputs: {[THEME_MAIN]: true, [THEME_CAPTURE]: true},
    layers: {
      ...emptyLiveState().layers,
      slide: {itemId: 'song', position: 1, lines: [], label: null},
    },
    themeOutput: output,
    themeItem: {
      id: 'song',
      kind: 'song',
      source: 'service',
      slidePosition: 1,
      overlayStartedAt: 2000,
      overlays: [
        {
          id: createItemOverlayId('00000000-0000-4000-8000-000000000702'),
          name: 'Invented overlay',
          from: 2,
          to: 3,
          screens: [THEME_MAIN],
          content: {media: mediaId, loop: false, sound: true},
        },
      ],
    },
  };
}

describe('theme sound selection', () => {
  it('selects one overlay source for several enabled screens, including linked screens', () => {
    const state = fixture();
    expect(themeOverlayAudio(state)).toEqual({
      mediaId,
      loop: false,
      startedAt: 2000,
      properties: {speed: 1, fit: 'fit', volume: 100, audio: true},
    });
    expect(
      themeOverlayAudio({...state, outputs: {[THEME_CAPTURE]: true}})?.mediaId,
    ).toBe(mediaId);
    expect(themeMediaAudible(state)).toBe(false);
    expect(
      themeMediaAudible({
        ...state,
        themeItem: {id: 'media', kind: 'media', source: 'external'},
      }),
    ).toBe(false);
  });

  it('keeps the overlay soundtrack when lyrics are cleared', () => {
    const state = fixture();
    expect(
      themeOverlayAudio({...state, layers: {...state.layers, slide: null}}),
    ).toEqual(themeOverlayAudio(state));
  });

  it('empties overlays on untargeted screens, outside the inclusive range, on all clears, and with outputs off', () => {
    const state = fixture();
    expect(
      themeOverlay(state.themeItem ?? null, state.layers, THEME_CAPTURE),
    ).toBeUndefined();
    expect(themeOverlayAudio({...state, outputs: {}})).toBeNull();
    const item = state.themeItem;
    if (item == null) throw new Error('Missing item');
    expect(
      themeOverlayAudio({
        ...state,
        themeItem: {...item, slidePosition: 3},
        layers: {
          ...state.layers,
          slide: {itemId: 'song', position: 3, lines: [], label: null},
        },
      }),
    ).toBeNull();
    expect(
      themeOverlayAudio({...state, themeItem: {...item, contentCleared: true}}),
    ).toBeNull();
    expect(themeMediaAudible({...state, outputs: {}})).toBe(false);
  });

  it.each([THEME_MAIN, THEME_STAGE, THEME_CAPTURE])(
    'never plays an item background on screen %s',
    id => {
      const state = fixture();
      const output = state.themeOutput;
      const layout = output?.screens[THEME_MAIN];
      if (!output || !layout) throw new Error('Missing audience layout');
      const custom = {
        ...state,
        outputs: {[id]: true},
        themeOutput: {...output, screens: {...output.screens, [id]: layout}},
      };
      expect(themeMediaAudible(custom)).toBe(false);
    },
  );

  it('keeps media-item sound available on a stage media element', () => {
    const state = fixture();
    const output = state.themeOutput;
    const layout = output?.screens[THEME_MAIN];
    if (!output || !layout) throw new Error('Missing layout');
    const screen = {
      ...layout,
      layout: {
        ...layout.layout,
        elements: [
          {
            ...themeElementBase(40),
            kind: 'media' as const,
            fit: 'fit' as const,
            radius: 0,
          },
        ],
      },
    };
    const mediaItem: LiveState = {
      ...state,
      themeItem: {id: 'media', kind: 'media', source: 'service'},
      outputs: {[THEME_STAGE]: true},
      layers: {
        ...state.layers,
        media: {mediaId, itemId: 'media', loop: true, startedAt: 1000},
      },
      themeOutput: {
        ...output,
        screens: {...output.screens, [THEME_STAGE]: screen},
      },
    };
    expect(themeMediaAudible(mediaItem)).toBe(true);
    expect(
      themeMediaAudible({
        ...mediaItem,
        layers: {
          ...mediaItem.layers,
          media: {mediaId, loop: true, startedAt: 1001},
        },
      }),
    ).toBe(false);
  });
});
