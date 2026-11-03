import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState} from '@core/live/state';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {useAtLastSlide} from '@renderer/features/presentation/useAtLastSlide';
import {useLive} from '@renderer/session/live';
import {
  openItem,
  outputNext,
  setAtLastSlide,
  useShow,
} from '@renderer/session/show';

const sent: LiveCommand[] = [];
const listeners = new Set<(document: SettingsDocument) => void>();

function preferences(atLastSlide: 'stop' | 'nextItem', revision: number) {
  return {
    name: 'preferences' as const,
    value: {
      format: 'llsettings.preferences' as const,
      schemaVersion: 1,
      show: {atLastSlide},
    },
    revision,
    access: 'editable' as const,
  };
}

beforeEach(() => {
  sent.length = 0;
  listeners.clear();
  window.llp = mockLlpApi({
    live: {
      get: async () => emptyLiveState(),
      send: command => sent.push(command),
      subscribe: () => () => undefined,
    },
    settings: {
      get: () => Promise.resolve(preferences('nextItem', 1)),
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  });
  seedSampleService();
  useShow.setState({openItemId: null, selectedTile: 0});
  useLive.setState({
    state: {
      ...emptyLiveState(),
      layers: {
        ...emptyLiveState().layers,
        slide: {itemId: 'song-morning', position: 3, label: null, lines: ['x']},
      },
    },
  });
});

afterEach(() => {
  setAtLastSlide('stop');
  delete window.llp;
  vi.restoreAllMocks();
});

it('hands 환경설정 to the next key at once, and follows a later change', async () => {
  renderHook(() => useAtLastSlide());
  openItem('song-morning');
  await waitFor(() => {
    sent.length = 0;
    outputNext();
    expect(sent.at(-1)).toMatchObject({
      slide: {itemId: 'song-river', position: 0},
    });
  });
  sent.length = 0;
  openItem('song-morning');
  act(() => {
    for (const listener of listeners) listener(preferences('stop', 2));
  });
  await waitFor(() => {
    sent.length = 0;
    outputNext();
    expect(sent).toHaveLength(0);
  });
});
