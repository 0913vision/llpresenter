import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {createMediaId, createScreenId} from '@core/schema/ids';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {connectMediaPlayback} from '@main/live/mediaPlayback';
import type {LiveStore} from '@main/live/store';

function mockStore(state: LiveState = emptyLiveState()) {
  const disconnect = vi.fn();
  return {
    disconnect,
    store: {
      state,
      handles: vi.fn<LiveStore['handles']>(() => true),
      dispatch: vi.fn<LiveStore['dispatch']>(() => true),
      connectAudioMedia: vi.fn<LiveStore['connectAudioMedia']>(
        () => disconnect,
      ),
    },
  };
}

const document = (() => {
  const parsed = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [],
      playlists: [],
      audioPlaylists: [],
    },
  });
  if (!parsed.ok) throw new Error('Invalid media fixture');
  return parsed.value;
})();

describe('connectMediaPlayback', () => {
  it('gives the store the media list and refreshes the output properties now and on every change', () => {
    const {store} = mockStore();
    let changed = (): void => undefined;
    connectMediaPlayback(
      store,
      {
        get: () => document,
        subscribe: listener => {
          changed = () => listener(document);
          return () => undefined;
        },
      },
      recordingLogger(),
    );
    const catalog = store.connectAudioMedia.mock.calls[0]?.[0];
    expect(catalog?.()).toBe(document.value);
    expect(store.dispatch).toHaveBeenCalledOnce();
    expect(store.dispatch.mock.calls[0]?.[0]).toEqual({
      type: 'media.properties.refresh',
    });

    changed();
    expect(store.dispatch).toHaveBeenCalledTimes(2);
  });

  it('tells a running 공지 which images left the library, and keeps it paused', () => {
    const state = emptyLiveState();
    const running: LiveState = {
      ...state,
      layers: {
        ...state.layers,
        notice: {
          noticeId: '00000000-0000-4000-8000-000000000071',
          playback: {
            media: [createMediaId('00000000-0000-4000-8000-000000000072')],
            position: 0,
            interval: 8,
            loop: true,
            targets: [createScreenId('00000000-0000-4000-8000-000000000073')],
            startedAt: 1,
            pausedAt: 5,
          },
        },
      },
    };
    const {store} = mockStore(running);
    let changed = (): void => undefined;
    connectMediaPlayback(
      store,
      {
        get: () => document,
        subscribe: listener => {
          changed = () => listener(document);
          return () => undefined;
        },
      },
      recordingLogger(),
    );
    store.dispatch.mockClear();
    changed();
    expect(store.dispatch.mock.calls.map(([command]) => command)).toEqual([
      {type: 'media.properties.refresh'},
      {type: 'notice.start', noticeId: '00000000-0000-4000-8000-000000000071'},
      {type: 'notice.pause'},
    ]);
  });

  it('stops listening and disconnects the catalog, also when stopping the listener throws', () => {
    const {store, disconnect} = mockStore();
    const stop = connectMediaPlayback(
      store,
      {
        get: () => document,
        subscribe: () => () => {
          throw new Error('Listener gone');
        },
      },
      recordingLogger(),
    );

    expect(stop).toThrow('Listener gone');
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
