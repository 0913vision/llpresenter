import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseMediaList} from '@core/schema/mediaList';
import {expectSuccess} from '@core/schema/testHelpers';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {audioTracks} from './audioTracks';
import {WindowedAudioTracks} from './WindowedAudioTracks';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('bounds a long list, navigates to both ends and releases its observer', () => {
  const track = '00000000-0000-4000-8000-000000000001';
  const playlistId = '00000000-0000-4000-8000-000000000002';
  const {data} = expectSuccess(
    parseMediaList(
      JSON.stringify({
        format: 'llmedia',
        schemaVersion: 1,
        items: [
          {id: track, name: 'Track', kind: 'audio', file: 'track.wav', size: 1},
        ],
        playlists: [],
        audioPlaylists: [
          {
            id: playlistId,
            name: 'List',
            loop: false,
            items: Array.from({length: 1000}, () => track),
          },
        ],
      }),
      'media.json',
    ),
  );
  const playlist = data.audioPlaylists[0];
  if (!playlist) throw new Error('Missing playlist fixture');
  let resized: () => void = () => undefined;
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 320, 32),
  );
  const {unmount} = render(
    <WindowedAudioTracks
      api={fakeLlpApi()}
      tracks={audioTracks(playlist, data.items, undefined)}
    />,
  );
  const list = screen.getByRole('list');
  Object.defineProperty(list, 'clientHeight', {value: 160});
  act(resized);
  expect(screen.getAllByRole('listitem').length).toBeLessThanOrEqual(11);
  list.focus();
  fireEvent.keyDown(list, {key: 'End'});
  expect(document.activeElement?.textContent).toContain('1000');
  expect(screen.getAllByRole('listitem').length).toBeLessThanOrEqual(11);
  fireEvent.keyDown(document.activeElement ?? list, {key: 'Home'});
  expect(document.activeElement?.textContent).toContain('1');
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
