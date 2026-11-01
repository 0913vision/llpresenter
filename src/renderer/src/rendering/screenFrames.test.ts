import {expect, it, vi, onTestFinished} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {settingsDocument} from '@core/testing/settingsDocument';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {resolveThemeOutput} from '@core/themes/output';
import {
  themeFile,
  themeScreens,
  THEME_MAIN,
  THEME_STAGE,
} from '@core/testing/themeOutput';
import {ScreenFrames} from './screenFrames';

function setup(screenId = THEME_MAIN) {
  const listeners = new Set<(document: SettingsDocument) => void>();
  const unsubscribe = vi.fn();
  const get = vi.fn(async ({name}: {name: string}) =>
    name === 'screens'
      ? settingsDocument('screens', {screens: themeScreens})
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

it('uses the main composition without subscribing to Look or stage layout settings', async () => {
  const {frames, state, get, onChange} = setup(THEME_STAGE);
  expect(frames.frame(state)).toBeUndefined();
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
  expect(get.mock.calls.map(call => call[0].name).sort()).toEqual([
    'screens',
    'timers',
  ]);
  const frame = frames.frame(state);
  expect(frame?.theme).toMatchObject({
    ...state.themeOutput?.screens[THEME_STAGE],
    revision: 7,
    item: state.themeItem,
  });
  expect(frame).not.toHaveProperty('look');
  expect(frame).not.toHaveProperty('stage');
});

it('waits for a complete theme snapshot without changing screen identity', async () => {
  const {frames, state, onChange} = setup();
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
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
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
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
  expect(unsubscribe).toHaveBeenCalledTimes(2);
  push(settingsDocument('timers', {timers: []}, 2));
  expect(onChange).toHaveBeenCalledTimes(3);
});
