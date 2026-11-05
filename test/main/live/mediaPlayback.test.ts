import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
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
