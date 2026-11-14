import {expect, it, vi, onTestFinished} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {resolveThemeOutput} from '@core/themes/output';
import {
  themeFile,
  themeScreens,
  THEME_MAIN,
  THEME_STAGE,
  THEME_CAPTURE,
} from '@fixtures/core/themeOutput';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/messages';
import {ScreenFrames} from '@renderer/rendering/screenFrames';
import type {FontsApi} from '@contracts/ipc/output';
import type {FontCatalogSnapshot} from '@core/schema/fontCatalog';

const STYLE_ID = '44444444-4444-4444-8444-444444444444';

function setup(screenId = THEME_MAIN, fonts?: FontsApi) {
  const listeners = new Set<(document: SettingsDocument) => void>();
  const unsubscribe = vi.fn();
  const get = vi.fn(async ({name}: {name: string}) =>
    name === 'screens'
      ? settingsDocument('screens', {screens: themeScreens})
      : name === 'messages'
        ? settingsDocument('messages', {templates: []})
        : name === 'preferences'
          ? settingsDocument('preferences', {
              format: 'llsettings.preferences',
              schemaVersion: 1,
            })
          : settingsDocument('timers', {timers: []}),
  );
  const api = mockLlpApi({
    settings: {
      get,
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
          unsubscribe();
        };
      },
    },
  });
  const onChange = vi.fn();
  const onError = vi.fn();
  const frames = new ScreenFrames({
    ...(fonts === undefined ? {} : {fonts}),
    settings: api.settings,
    clock: async () => 0,
    screenId,
    onChange,
    onError,
  });
  onTestFinished(() => frames.dispose());
  const item = {id: 'invented', kind: 'song', source: 'external'} as const;
  const state: LiveState = {
    ...emptyLiveState(),
    themeItem: item,
    themeOutput: resolveThemeOutput({
      file: themeFile(),
      screens: themeScreens,
      item,
      revision: 7,
    }),
  };
  return {
    frames,
    state,
    get,
    onChange,
    onError,
    unsubscribe,
    push: (document: SettingsDocument) => {
      for (const listener of listeners) listener(document);
    },
  };
}

it('withholds unverified absence from output fallback decisions and releases font subscriptions', async () => {
  let publish: (value: FontCatalogSnapshot) => void = () => undefined;
  const stop = vi.fn();
  const fonts = mockLlpApi({
    fonts: {
      snapshot: async () => ({families: [], verified: false}),
      subscribe: receive => {
        publish = receive;
        return stop;
      },
    },
  }).fonts;
  const {frames, state} = setup(THEME_MAIN, fonts);
  await vi.waitFor(() => expect(frames.frame(state)).toBeDefined());
  expect(frames.frame(state)?.fonts).toBeUndefined();
  publish({families: [], verified: true});
  expect(frames.frame(state)?.fonts).toEqual([]);
  publish({families: [], verified: false});
  expect(frames.frame(state)?.fonts).toBeUndefined();
  frames.dispose();
  expect(stop).toHaveBeenCalledOnce();
});

it('uses the main composition and subscribes only to screens, messages, 환경설정, and timers', async () => {
  const {frames, state, get, onChange} = setup(THEME_STAGE);
  expect(frames.frame(state)).toBeUndefined();
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));
  expect(get.mock.calls.map(call => call[0].name).sort()).toEqual([
    'messages',
    'preferences',
    'screens',
    'timers',
  ]);
  const frame = frames.frame(state);
  expect(frame?.theme).toMatchObject({
    ...state.themeOutput?.screens[THEME_STAGE],
    revision: 7,
    item: state.themeItem,
  });
});

it('draws the 기본 band opaque where the screen background is the chroma green', async () => {
  const {frames, state, onChange} = setup();
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));
  const output = state.themeOutput;
  const composition = output?.screens[THEME_MAIN];
  if (output === undefined || composition === undefined) {
    throw new Error('Missing theme snapshot');
  }
  const over = (
    background: import('@core/schema/themeBackground').ThemeBackground,
  ): LiveState => ({
    ...state,
    themeOutput: {
      ...output,
      screens: {
        ...output.screens,
        [THEME_MAIN]: {
          ...composition,
          layout: {...composition.layout, background},
        },
      },
    },
  });
  expect(frames.frame(over('#00B140'))?.messageBand?.background.opacity).toBe(
    100,
  );
  expect(frames.frame(over('#00b140'))?.messageBand?.background.opacity).toBe(
    100,
  );
  expect(frames.frame(over('#112233'))?.messageBand?.background.opacity).toBe(
    72,
  );
  expect(
    frames.frame(
      over({
        kind: 'linear',
        angle: 0,
        mixing: 'oklch',
        stops: [
          {color: '#00B140', position: 0},
          {color: '#000000', position: 100},
        ],
      }),
    )?.messageBand?.background.opacity,
  ).toBe(72);
});

it('draws the band opaque over the own key color of a 캡처용 창 screen', async () => {
  const {frames, state, onChange, push} = setup();
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));
  push(
    settingsDocument(
      'screens',
      {
        screens: themeScreens.map(screen =>
          screen.id === THEME_MAIN
            ? {...screen, method: 'capture', emptyColor: '#FF00FF'}
            : screen,
        ),
      },
      2,
    ),
  );
  const output = state.themeOutput;
  const composition = output?.screens[THEME_MAIN];
  if (output === undefined || composition === undefined) {
    throw new Error('Missing theme snapshot');
  }
  const over = (background: string): LiveState => ({
    ...state,
    themeOutput: {
      ...output,
      screens: {
        ...output.screens,
        [THEME_MAIN]: {
          ...composition,
          layout: {...composition.layout, background},
        },
      },
    },
  });
  expect(frames.frame(over('#ff00ff'))?.messageBand?.background.opacity).toBe(
    100,
  );
  expect(frames.frame(over('#112233'))?.messageBand?.background.opacity).toBe(
    72,
  );
});

it('carries the 전환 times of 환경설정 and follows a change', async () => {
  const {frames, state, push, onChange} = setup();
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));
  expect(frames.frame(state)?.transitionTimes).toEqual({
    slideMs: 0,
    backgroundMs: 0,
  });
  push(
    settingsDocument(
      'preferences',
      {
        format: 'llsettings.preferences',
        schemaVersion: 1,
        output: {
          transition: {
            between: {kind: 'none', sec: 0.5},
            media: {kind: 'dissolve', seconds: 1.2},
          },
        },
      },
      2,
    ),
  );
  expect(onChange).toHaveBeenCalledTimes(5);
  expect(frames.frame(state)?.transitionTimes).toEqual({
    slideMs: 0,
    backgroundMs: 0,
  });
});

it('waits for a complete theme snapshot without changing screen identity', async () => {
  const {frames, state, onChange} = setup();
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));
  const frame = frames.frame(state);
  expect(frame).toBeDefined();
  expect(frames.frame(null)).toBeUndefined();
  expect(frames.frame(emptyLiveState())).toBeUndefined();
  if (state.themeOutput === undefined) {
    throw new Error('Missing theme snapshot');
  }
  expect(
    frames.frame({...state, themeOutput: {...state.themeOutput, screens: {}}}),
  ).toBeUndefined();
  expect(frames.frame(state)?.theme).toEqual(frame?.theme);
});

it('preserves test patterns, stage messages, clears, timers, and screen correction', async () => {
  const {frames, state, push, onChange, unsubscribe} = setup();
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));
  push(
    settingsDocument(
      'screens',
      {
        screens: themeScreens.map(screen =>
          screen.id === THEME_MAIN ? {...screen, edgeMargin: 5} : screen,
        ),
      },
      2,
    ),
  );
  const frame = frames.frame({
    ...state,
    testPatterns: [THEME_MAIN],
    stageMessage: 'Invented message',
    clearEffects: [],
  });
  expect(frame).toMatchObject({
    testPattern: true,
    stageMessage: 'Invented message',
    clearEffects: [],
    screen: {correction: {edgeMargin: 5}},
    timers: {list: []},
  });
  frames.dispose();
  expect(unsubscribe).toHaveBeenCalledTimes(4);
  push(settingsDocument('timers', {timers: []}, 2));
  expect(onChange).toHaveBeenCalledTimes(5);
});

it('draws a message in the style its screen picked and falls back to 기본', async () => {
  const {frames, state, push, onChange} = setup();
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));
  expect(frames.frame(state)?.messageStyle).toEqual(DEFAULT_MESSAGE_STYLE);
  expect(frames.frame(state)?.messageBand).toBeDefined();

  const picked = {
    ...DEFAULT_MESSAGE_STYLE,
    id: STYLE_ID,
    name: '큰 글씨',
    size: 120,
  };
  push(
    settingsDocument(
      'screens',
      {
        screens: themeScreens.map(screen =>
          screen.id === THEME_MAIN
            ? {...screen, messageStyleId: STYLE_ID}
            : screen,
        ),
      },
      2,
    ),
  );
  expect(frames.frame(state)?.messageStyle).toEqual(DEFAULT_MESSAGE_STYLE);
  push(
    settingsDocument('messages', {templates: [], messageStyles: [picked]}, 2),
  );
  expect(frames.frame(state)?.messageStyle).toMatchObject({size: 120});
  expect(frames.frame(state)?.messageBand).toBeUndefined();
  expect(onChange).toHaveBeenCalledTimes(6);
});

it('holds the selected effect across redraws and applies new defaults only to the next slide', async () => {
  const {frames, state, push, onChange} = setup();
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));
  const at = (
    itemId: string,
    position: number,
    transition?: {kind: 'wipe'; sec: number},
  ): LiveState => ({
    ...state,
    layers: {
      ...state.layers,
      slide: {
        itemId,
        position,
        label: null,
        lines: ['Same words'],
        ...(transition === undefined ? {} : {transition}),
      },
    },
  });
  expect(frames.frame(at('a', 0))?.slideTransition).toEqual({
    kind: 'none',
    sec: 0.5,
  });
  expect(frames.frame(at('a', 1))?.slideTransition).toEqual({
    kind: 'none',
    sec: 0.5,
  });
  expect(
    frames.frame(at('a', 2, {kind: 'wipe', sec: 4}))?.slideTransition,
  ).toEqual({kind: 'wipe', sec: 4});
  push(
    settingsDocument(
      'preferences',
      {
        format: 'llsettings.preferences',
        schemaVersion: 1,
        output: {transition: {within: {kind: 'push', dir: 'right', sec: 10}}},
      },
      3,
    ),
  );
  expect(
    frames.frame(at('a', 2, {kind: 'wipe', sec: 4}))?.slideTransition,
  ).toEqual({kind: 'wipe', sec: 4});
  expect(frames.frame(at('a', 1))?.slideTransition).toEqual({
    kind: 'none',
    sec: 0.5,
  });
  expect(frames.frame(at('b', 1))?.slideTransition).toEqual({
    kind: 'none',
    sec: 0.5,
  });
});

it.each([THEME_STAGE, THEME_CAPTURE])(
  'cuts slide changes on stage and broadcast %s',
  async screenId => {
    const {frames, state, onChange} = setup(screenId);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));
    if (state.themeOutput === undefined) throw new Error('Missing theme');
    const current: LiveState = {
      ...state,
      themeOutput: {...state.themeOutput, transition: {kind: 'wipe', sec: 0.7}},
      layers: {
        ...state.layers,
        slide: {
          itemId: 'bible',
          position: 0,
          label: null,
          lines: ['Verse'],
          transition: {kind: 'push', sec: 1},
        },
      },
    };
    expect(frames.frame(current)).toMatchObject({
      slideTransition: {kind: 'none'},
      transitionTimes: {slideMs: 0},
    });
    const next: LiveState = {
      ...current,
      layers: {
        ...current.layers,
        slide: {itemId: 'bible', position: 1, label: null, lines: ['Next']},
      },
    };
    expect(frames.frame(next)).toMatchObject({
      slideTransition: {kind: 'none'},
      transitionTimes: {slideMs: 0},
    });
  },
);

it('uses the scripture theme wipe for consecutive slides and split verses', async () => {
  const {frames, state, onChange} = setup();
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4));
  if (state.themeOutput === undefined) throw new Error('Missing theme');
  const themeOutput = {
    ...state.themeOutput,
    transition: {kind: 'wipe' as const, sec: 0.7},
  };
  for (const [position, biblePart] of [
    [0, 1],
    [1, 2],
    [2, 1],
  ] as const) {
    const current: LiveState = {
      ...state,
      themeOutput,
      layers: {
        ...state.layers,
        slide: {
          itemId: 'bible',
          position,
          biblePart,
          label: null,
          lines: ['Verse'],
        },
      },
    };
    expect(frames.frame(current)).toMatchObject({
      slideTransition: {kind: 'none', sec: 0.5},
      transitionTimes: {slideMs: 0},
    });
  }
});
