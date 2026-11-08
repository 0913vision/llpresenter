import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {createAudioPlaylistId, createMediaId} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {mockPanelTabWidths} from '@fixtures/renderer/ui/responsiveTabTesting';
import {AudioShortcuts} from '@renderer/features/tools/AudioShortcuts';
import {ShowToolsPanel} from '@renderer/features/tools/ShowToolsPanel';
import {useShowToolTab} from '@renderer/features/tools/state/showToolTab';
import {useLive} from '@renderer/session/live';
import {commandBindingStore} from '@renderer/ui/commandBindings';

afterEach(() => {
  cleanup();
  commandBindingStore.set({});
  useLive.setState({state: null});
  useShowToolTab.setState({tool: 'stage'});
  delete window.llp;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('controls audio from the stage tab with default, removed and reassigned keys', async () => {
  mockPanelTabWidths(1000);
  commandBindingStore.set({});
  useShowToolTab.setState({tool: 'stage'});
  const send = vi.fn();
  const stopMedia = vi.fn();
  const stopMissing = vi.fn();
  window.llp = mockLlpApi({
    live: {send},
    media: {
      subscribe: () => stopMedia,
      subscribeMissing: () => stopMissing,
    },
  });
  const audio = {
    mediaId: createMediaId('00000000-0000-4000-8000-000000000001'),
    playback: {
      source: {
        kind: 'playlist' as const,
        playlistId: createAudioPlaylistId(
          '00000000-0000-4000-8000-000000000002',
        ),
        position: 0,
      },
      trackVersion: 1,
      positionSeconds: 10,
      since: 1000,
    },
  };
  const state = emptyLiveState();
  useLive.setState({state: {...state, layers: {...state.layers, audio}}});
  await act(async () => {
    render(
      <>
        <AudioShortcuts onProblem={vi.fn()} />
        <ShowToolsPanel sizeClass="wide" />
      </>,
    );
  });
  expect(
    screen.getByRole('tab', {name: '무대'}).getAttribute('aria-selected'),
  ).toBe('true');
  expect(screen.queryByRole('button', {name: '일시 정지'})).toBeNull();
  const altP = {code: 'KeyP', key: 'p', altKey: true};
  fireEvent.keyDown(document.body, altP);
  expect(send).toHaveBeenCalledExactlyOnceWith({type: 'audio.pause'});

  await act(async () => commandBindingStore.set({'audio.playPause': []}));
  expect(stopMedia).toHaveBeenCalledOnce();
  expect(stopMissing).toHaveBeenCalledOnce();
  send.mockClear();
  fireEvent.keyDown(document.body, altP);
  expect(send).not.toHaveBeenCalled();

  await act(async () => {
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          audio: {...audio, playback: {...audio.playback, since: null}},
        },
      },
    });
    commandBindingStore.set({'audio.playPause': [{code: 'F8', mods: []}]});
  });
  fireEvent.keyDown(document.body, altP);
  expect(send).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, {code: 'F8', key: 'F8'});
  expect(send).toHaveBeenCalledExactlyOnceWith({type: 'audio.play'});

  await act(async () => commandBindingStore.set({}));
  send.mockClear();
  fireEvent.keyDown(document.body, {code: 'F8', key: 'F8'});
  expect(send).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, altP);
  expect(send).toHaveBeenCalledExactlyOnceWith({type: 'audio.play'});
  expect(useShowToolTab.getState().tool).toBe('stage');
});
