import {themeOutput} from '@fixtures/core/themeOutput';
import {
  emptyLiveState,
  type MediaLayer,
  type LiveState,
} from '@core/schema/live/live';
import {beforeEach, expect, it, vi} from 'vitest';
import type {MediaDocument} from '@core/schema/media/mediaEdit';
import {createMediaId} from '@core/schema/common/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {BackgroundAudio} from '@renderer/output/backgroundAudio';
import {BackgroundLayerView} from '@renderer/rendering/backgroundLayer';
import {backgroundAudible, overlayAudio} from '@core/live/overlays';

const layer = vi.hoisted(() => ({show: vi.fn()}));

vi.mock('@renderer/rendering/backgroundLayer', () => ({
  BackgroundLayerView: vi.fn(
    class {
      show = layer.show;
      dispose = vi.fn();
      setSink = vi.fn();
      setAudioGain = vi.fn();
    },
  ),
}));
vi.mock('@core/live/overlays', () => ({
  backgroundAudible: vi.fn(),
  overlayAudio: vi.fn(),
}));

const media: MediaLayer = {
  mediaId: '00000000-0000-4000-8000-000000000004',
  loop: true,
  startedAt: 1000,
  properties: {audio: true, fit: 'fill', volume: 40, speed: 1},
};

function document(
  kind: 'image' | 'video' | 'audio',
  revision = 1,
): MediaDocument {
  return {
    name: 'media',
    revision,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {
          id: createMediaId(media.mediaId),
          name: 'Background',
          kind,
          file: 'background',
          size: 100,
        },
      ],
      playlists: [],
      audioPlaylists: [],
    },
  };
}

function setup() {
  let resolve: (value: MediaDocument) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<MediaDocument>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  const initial = {promise, resolve, reject};
  const stop = vi.fn();
  let receive: (document: MediaDocument) => void = () => undefined;
  const api = mockLlpApi({
    media: {
      get: () => initial.promise,
      subscribe: callback => {
        receive = callback;
        return stop;
      },
    },
  });
  const report = vi.fn();
  const player = new BackgroundAudio({
    root: documentRoot(),
    api,
    muted: false,
    report,
    now: () => 1000,
  });
  const state: LiveState = {
    ...emptyLiveState(),
    item: {id: 'media', kind: 'media', source: 'external'},
    themeOutput: themeOutput(),
    layers: {...emptyLiveState().layers, media},
  };
  return {
    initial,
    stop,
    receive: (value: MediaDocument) => receive(value),
    player,
    state,
    report,
  };
}

function documentRoot(): HTMLElement {
  return globalThis.document.createElement('div');
}

beforeEach(() => {
  layer.show.mockClear();
  vi.mocked(BackgroundLayerView).mockClear();
  vi.mocked(backgroundAudible).mockReturnValue(true);
  vi.mocked(overlayAudio).mockReturnValue(null);
});

it('waits for media metadata and never loads a picture as background sound or overlay sound', async () => {
  const {initial, player, state, stop} = setup();
  const view = layer;
  vi.mocked(overlayAudio).mockReturnValue(media);
  player.show(state);
  expect(view.show).not.toHaveBeenCalled();
  initial.resolve(document('image'));
  await initial.promise;
  expect(view.show).toHaveBeenLastCalledWith(null);
  expect(BackgroundLayerView).toHaveBeenCalledTimes(1);
  player.dispose();
  expect(stop).toHaveBeenCalledOnce();
});

it.each(['video', 'audio'] as const)(
  'keeps %s sound and ignores a stale read after a pushed picture revision',
  async kind => {
    const {initial, receive, player, state} = setup();
    const view = layer;
    player.show(state);
    receive(document(kind, 2));
    expect(view.show).toHaveBeenLastCalledWith(media);
    receive(document('image', 3));
    expect(view.show).toHaveBeenLastCalledWith(null);
    initial.resolve(document(kind, 1));
    await initial.promise;
    expect(view.show).toHaveBeenLastCalledWith(null);
    receive(document(kind, 4));
    expect(view.show).toHaveBeenLastCalledWith(media);
    player.dispose();
  },
);

it('does not load a stale item when metadata arrives, or revive audio after disposal', async () => {
  const {initial, receive, player, state} = setup();
  const view = layer;
  player.show(state);
  player.show({...state, layers: {...state.layers, media: null}});
  initial.resolve(document('video'));
  await initial.promise;
  expect(view.show).toHaveBeenLastCalledWith(null);
  player.dispose();
  vi.mocked(view.show).mockClear();
  receive(document('video', 2));
  player.show(state);
  expect(view.show).not.toHaveBeenCalled();
});

it('recovers background and overlay playback after metadata failure without a catalog push', async () => {
  const {initial, receive, player, state, report} = setup();
  const view = layer;
  vi.mocked(overlayAudio).mockReturnValue(media);
  player.show(state);
  const error = new Error('Unavailable');
  initial.reject(error);
  await initial.promise.catch(() => undefined);
  expect(report).toHaveBeenCalledWith(
    'could not read background audio media',
    error,
  );
  expect(view.show.mock.calls).toEqual([[media], [media]]);
  expect(BackgroundLayerView).toHaveBeenCalledTimes(2);
  view.show.mockClear();
  player.show({...state, layers: {...state.layers, media: null}});
  expect(view.show.mock.calls).toEqual([[media], [null]]);
  view.show.mockClear();
  receive(document('image'));
  expect(view.show.mock.calls).toEqual([[null], [null]]);
  player.dispose();
});

it('plays a later live update when metadata failed before any state arrived', async () => {
  const {initial, player, state} = setup();
  initial.reject(new Error('Unavailable'));
  await initial.promise.catch(() => undefined);
  expect(layer.show).not.toHaveBeenCalled();
  player.show(state);
  expect(layer.show).toHaveBeenLastCalledWith(media);
  player.dispose();
});

it('keeps pushed picture filtering when the initial read later rejects', async () => {
  const {initial, receive, player, state} = setup();
  vi.mocked(overlayAudio).mockReturnValue(media);
  player.show(state);
  receive(document('image'));
  layer.show.mockClear();
  initial.reject(new Error('Unavailable'));
  await initial.promise.catch(() => undefined);
  expect(layer.show.mock.calls).toEqual([[null]]);
  expect(BackgroundLayerView).toHaveBeenCalledTimes(1);
  player.dispose();
});

it('does not revive playback or report a late metadata failure after disposal', async () => {
  const {initial, player, state, report} = setup();
  player.show(state);
  player.dispose();
  initial.reject(new Error('Unavailable'));
  await initial.promise.catch(() => undefined);
  expect(layer.show).not.toHaveBeenCalled();
  expect(report).not.toHaveBeenCalled();
});
