import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {
  settingsDocument,
  screensDocument,
  LOOK_ID,
  STAGE_ID,
  LAYOUT_ID,
} from '@renderer/features/screens/testing/documents';
import {useShowingClock} from './showingClock';
import {parseMediaList} from '@core/schema/mediaList';
import {expectSuccess} from '@core/schema/testHelpers';
import {MAIN_ID} from '@renderer/features/screens/testing/documents';
import {parseLiveState} from '@core/schema/liveState';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('does not schedule a clock tick unless the selected stage layout contains a clock', () => {
  vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'Date']});
  vi.setSystemTime(new Date('2028-01-01T00:00:00Z'));
  const screens = screensDocument();
  const looks = settingsDocument('looks', {
    current: LOOK_ID,
    lyricStyles: [],
    looks: [
      {
        id: LOOK_ID,
        name: 'Look',
        screens: {[STAGE_ID]: {stageLayout: LAYOUT_ID, layers: {clock: true}}},
      },
    ],
  });
  const layouts = settingsDocument('stage-layouts', {
    format: 'llsettings.stage',
    layouts: [
      {id: LAYOUT_ID, name: 'Stage', width: 1920, height: 1080, elements: []},
    ],
  });
  if (
    screens.name !== 'screens' ||
    looks.name !== 'looks' ||
    layouts.name !== 'stage-layouts'
  ) {
    throw new Error('Invalid fixture');
  }
  const options = {
    screens: screens.value.screens,
    looks: looks.value,
    liveState: emptyLiveState(),
    stageLayoutsFile: layouts.value,
    mediaItems: [],
  };
  const {rerender, unmount} = renderHook(({value}) => useShowingClock(value), {
    initialProps: {value: options},
  });
  expect(vi.getTimerCount()).toBe(0);
  const clockLayouts = settingsDocument('stage-layouts', {
    format: 'llsettings.stage',
    layouts: [
      {
        id: LAYOUT_ID,
        name: 'Stage',
        width: 1920,
        height: 1080,
        elements: [
          {
            id: 'clock',
            name: 'Clock',
            kind: 'clock',
            frame: {x: 0, y: 0, w: 100, h: 50},
          },
        ],
      },
      {
        id: '00000000-0000-4000-8000-0000000000b2',
        name: 'Empty',
        width: 1920,
        height: 1080,
        elements: [],
      },
    ],
  });
  if (clockLayouts.name !== 'stage-layouts') throw new Error('Invalid fixture');
  rerender({value: {...options, stageLayoutsFile: clockLayouts.value}});
  expect(vi.getTimerCount()).toBe(1);
  const stage = screens.value.screens.find(screen => screen.id === STAGE_ID);
  const emptyLayout = clockLayouts.value.layouts[1];
  if (!stage || !emptyLayout) throw new Error('Missing layout fixture');
  rerender({
    value: {
      ...options,
      liveState: {
        ...options.liveState,
        stageLayouts: {[stage.id]: emptyLayout.id},
      },
      stageLayoutsFile: clockLayouts.value,
    },
  });
  expect(vi.getTimerCount()).toBe(0);
  rerender({value: {...options, stageLayoutsFile: clockLayouts.value}});
  act(() => {
    vi.advanceTimersByTime(60000);
  });
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('ticks for a video with a duration, but not for a still image', () => {
  vi.useFakeTimers({
    toFake: [
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'Date',
    ],
  });
  const screens = screensDocument();
  const looks = settingsDocument('looks', {
    current: LOOK_ID,
    lyricStyles: [],
    looks: [
      {
        id: LOOK_ID,
        name: 'Look',
        screens: {[MAIN_ID]: {layers: {media: true}}},
      },
    ],
  });
  const {data} = expectSuccess(
    parseMediaList(
      JSON.stringify({
        format: 'llmedia',
        schemaVersion: 1,
        items: [
          {
            id: '00000000-0000-4000-8000-000000000011',
            name: 'Still',
            kind: 'image',
            file: 'still.png',
            size: 1,
          },
          {
            id: '00000000-0000-4000-8000-000000000012',
            name: 'Video',
            kind: 'video',
            file: 'video.mp4',
            size: 1,
            duration: 30,
          },
        ],
        playlists: [],
        audioPlaylists: [],
      }),
      'media.json',
    ),
  );
  if (screens.name !== 'screens' || looks.name !== 'looks') {
    throw new Error('Invalid fixture');
  }
  const state = emptyLiveState();
  const withMedia = (id: string) => ({
    ...state,
    layers: {...state.layers, media: {mediaId: id, loop: false, startedAt: 0}},
  });
  const options = {
    screens: screens.value.screens,
    looks: looks.value,
    liveState: withMedia('00000000-0000-4000-8000-000000000011'),
    stageLayoutsFile: null,
    mediaItems: data.items,
  };
  const {rerender, unmount} = renderHook(({value}) => useShowingClock(value), {
    initialProps: {value: options},
  });
  expect(vi.getTimerCount()).toBe(0);
  rerender({
    value: {
      ...options,
      liveState: withMedia('00000000-0000-4000-8000-000000000012'),
    },
  });
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('does not tick for a timed message excluded from every visible audience screen', () => {
  vi.useFakeTimers({
    toFake: [
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'Date',
    ],
  });
  const screens = screensDocument();
  const looks = settingsDocument('looks', {
    current: LOOK_ID,
    lyricStyles: [],
    looks: [
      {
        id: LOOK_ID,
        name: 'Look',
        screens: {[MAIN_ID]: {layers: {message: true}}},
      },
    ],
  });
  if (screens.name !== 'screens' || looks.name !== 'looks') {
    throw new Error('Invalid fixture');
  }
  const base = emptyLiveState();
  const message = {
    messageId: '00000000-0000-4000-8000-000000000021',
    text: 'Test',
    targets: [MAIN_ID],
    excludedTargets: [MAIN_ID],
    startedAt: 0,
    expiresAt: 50000,
  };
  const state = (excludedTargets: readonly string[]) => {
    const parsed = parseLiveState({
      ...base,
      layers: {
        ...base.layers,
        message: {
          messageId: message.messageId,
          text: message.text,
          items: [{...message, excludedTargets}],
        },
      },
    });
    if (!parsed.ok) throw new Error('Invalid live fixture');
    return parsed.value;
  };
  const options = {
    screens: screens.value.screens,
    looks: looks.value,
    liveState: state([MAIN_ID]),
    stageLayoutsFile: null,
    mediaItems: [],
  };
  const {rerender, unmount} = renderHook(({value}) => useShowingClock(value), {
    initialProps: {value: options},
  });
  expect(vi.getTimerCount()).toBe(0);
  rerender({value: {...options, liveState: state([])}});
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
