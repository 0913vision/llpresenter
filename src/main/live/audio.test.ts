import {describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {audioPositionSeconds} from '@core/schema/audioState';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {parseMediaList} from '@core/schema/mediaList';
import {parseLiveState} from '@core/schema/liveState';
import {recordingLogger} from '../displays/testing';
import {dispatchLogged, LiveStore} from './store';

const FIRST = '00000000-0000-4000-8000-000000000001';
const SECOND = '00000000-0000-4000-8000-000000000002';
const LIST = '00000000-0000-4000-8000-000000000003';

function command(value: unknown): LiveCommand {
  const parsed = parseLiveCommand(value);
  if (!parsed.ok) throw new Error('Invalid audio command fixture');
  return parsed.value;
}

function setup(loop = false) {
  const parsed = parseMediaList(
    JSON.stringify({
      format: 'llmedia',
      schemaVersion: 1,
      items: [FIRST, SECOND].map(id => ({
        id,
        name: 'Fixture',
        kind: 'audio',
        file: `${id}.wav`,
        size: 0,
      })),
      playlists: [],
      audioPlaylists: [
        {id: LIST, name: 'Fixture', items: [FIRST, SECOND, FIRST], loop},
      ],
    }),
    'media.json',
  );
  if (!parsed.ok) throw new Error('Invalid media fixture');
  let now = 1000;
  const store = new LiveStore(undefined, () => now);
  const read = vi.fn(() => parsed.value.data);
  const release = store.connectAudioMedia(read);
  const send = (value: unknown) => store.dispatch(command(value));
  return {
    store,
    read,
    release,
    send,
    advance: (ms: number) => {
      now += ms;
    },
    start: (position = 0) =>
      send({
        type: 'audio.play',
        source: {kind: 'playlist', playlistId: LIST, position},
      }),
  };
}

describe('audio transport', () => {
  it('starts manual fade once, ignores stale completion, and lets play cancel it with a fresh identity', () => {
    const {store, start, send, advance} = setup();
    start();
    send({type: 'audio.fadeOut'});
    const original = store.state.layers.audio?.playback;
    if (original === undefined) throw new Error('Missing fade');
    expect(original.fadeOutSince).toBe(1000);
    expect(send({type: 'audio.fadeOut'})).toBe(false);
    expect(
      send({type: 'audio.next', trackVersion: original.trackVersion}),
    ).toBe(false);
    advance(1000);
    send({type: 'audio.play'});
    expect(store.state.layers.audio?.playback?.fadeOutSince).toBeUndefined();
    const current = store.state.layers.audio?.playback;
    if (current === undefined) throw new Error('Missing playback');
    expect(current.trackVersion).toBeGreaterThan(original.trackVersion);
    send({type: 'audio.fadeOut'});
    expect(
      send({
        type: 'audio.fadeOut.complete',
        trackVersion: original.trackVersion,
        since: 1000,
      }),
    ).toBe(false);
    expect(
      send({
        type: 'audio.fadeOut.complete',
        trackVersion: current.trackVersion,
        since: 1000,
      }),
    ).toBe(false);
    send({
      type: 'audio.fadeOut.complete',
      trackVersion: current.trackVersion,
      since: 2000,
    });
    expect(store.state.layers.audio).toBeNull();
    expect(store.state.canUndo).toBe(false);
  });
  it.each([
    {trackVersion: -1, since: 0},
    {trackVersion: 1, since: NaN},
    {trackVersion: 1, since: Infinity},
    {trackVersion: 1, since: -1},
  ])('rejects malformed fade completion %j', fields => {
    expect(
      parseLiveCommand({type: 'audio.fadeOut.complete', ...fields}).ok,
    ).toBe(false);
  });
  it('never reuses track versions after batched plays, next, or a clear', () => {
    const {store, send, start} = setup();
    send({
      type: 'live.batch',
      commands: [0, 1].map(position => ({
        type: 'audio.play',
        source: {kind: 'playlist', playlistId: LIST, position},
      })),
    });
    const batched = store.state.layers.audio?.playback?.trackVersion;
    if (batched === undefined) throw new Error('Missing playback');
    send({type: 'audio.next'});
    const next = store.state.layers.audio?.playback?.trackVersion;
    if (next === undefined) throw new Error('Missing next playback');
    expect(next).toBeGreaterThan(batched);
    send({type: 'layer.clear', target: 'audio'});
    start();
    expect(store.state.layers.audio?.playback?.trackVersion).toBeGreaterThan(
      next,
    );
    expect(send({type: 'audio.next', trackVersion: batched})).toBe(false);
  });
  it('ignores stale or paused ended notifications, while a matching track can advance', () => {
    const {store, start, send} = setup();
    start();
    const trackVersion = store.state.layers.audio?.playback?.trackVersion;
    expect(send({type: 'audio.next', trackVersion: 0})).toBe(false);
    send({type: 'audio.pause'});
    expect(send({type: 'audio.next', trackVersion})).toBe(false);
    send({type: 'audio.play'});
    send({type: 'audio.next', trackVersion});
    expect(store.state.layers.audio?.mediaId).toBe(SECOND);
    expect(send({type: 'audio.next', trackVersion})).toBe(false);
  });
  it.each([-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid ended track version %s',
    trackVersion => {
      expect(parseLiveCommand({type: 'audio.next', trackVersion}).ok).toBe(
        false,
      );
    },
  );
  it('plays playlist entries in order, including duplicate media, and stops after the last', () => {
    const {store, start, send} = setup();
    start();
    expect(store.state.layers.audio?.mediaId).toBe(FIRST);
    send({type: 'audio.next'});
    expect(store.state.layers.audio?.mediaId).toBe(SECOND);
    send({type: 'audio.next'});
    expect(store.state.layers.audio?.playback?.source).toEqual({
      kind: 'playlist',
      playlistId: LIST,
      position: 2,
    });
    expect(store.state.layers.audio?.mediaId).toBe(FIRST);
    send({type: 'audio.next'});
    expect(store.state.layers.audio).toBeNull();
    expect(store.state.canUndo).toBe(false);
  });

  it('repeats the playlist and restarts the first track on previous', () => {
    const {store, start, send} = setup(true);
    start(2);
    send({type: 'audio.next'});
    const first = store.state.layers.audio?.playback;
    send({type: 'audio.previous'});
    expect(store.state.layers.audio?.playback?.source).toEqual(first?.source);
    expect(store.state.layers.audio?.playback?.trackVersion).not.toBe(
      first?.trackVersion,
    );
  });

  it('holds the pause position, ignores duplicate pause/play, and resumes from it', () => {
    const {store, start, send, advance} = setup();
    start();
    expect(send({type: 'audio.play'})).toBe(false);
    advance(3500);
    send({type: 'audio.pause'});
    expect(store.state.layers.audio?.playback?.positionSeconds).toBe(3.5);
    expect(send({type: 'audio.pause'})).toBe(false);
    advance(10_000);
    send({type: 'audio.play'});
    advance(1500);
    const playback = store.state.layers.audio?.playback;
    if (playback === undefined) throw new Error('Missing playback');
    expect(audioPositionSeconds(playback, 16_000)).toBe(5);
    expect(audioPositionSeconds(playback, 0)).toBe(3.5);
    expect(parseLiveState(store.state).ok).toBe(true);
  });

  it('plays a standalone media once, previous restarts it, and next stops', () => {
    const {store, send} = setup(true);
    send({type: 'audio.play', source: {kind: 'media', mediaId: SECOND}});
    const version = store.state.layers.audio?.playback?.trackVersion;
    send({type: 'audio.previous'});
    expect(store.state.layers.audio?.playback?.trackVersion).not.toBe(version);
    expect(store.state.layers.audio?.mediaId).toBe(SECOND);
    send({type: 'audio.next'});
    expect(store.state.layers.audio).toBeNull();
  });

  it('keeps live volume across clears and accepts transport commands while empty', () => {
    const {store, send, start} = setup();
    for (const type of [
      'audio.pause',
      'audio.play',
      'audio.next',
      'audio.previous',
    ]) {
      expect(send({type})).toBe(false);
    }
    expect(send({type: 'audio.volume.set', volume: 100})).toBe(false);
    start();
    send({type: 'audio.volume.set', volume: 25});
    send({type: 'layer.clear', target: 'all'});
    expect(store.state.audioVolume).toBe(25);
    expect(send({type: 'audio.volume.set', volume: 25})).toBe(false);
  });

  it('logs a missing source or throwing catalog without disturbing the last good state or other output', () => {
    const {store, start, read} = setup();
    start();
    const state = store.state;
    const log = recordingLogger();
    dispatchLogged(
      store,
      command({type: 'audio.play', source: {kind: 'media', mediaId: LIST}}),
      log,
    );
    expect(store.state).toBe(state);
    dispatchLogged(
      store,
      command({
        type: 'audio.play',
        source: {kind: 'playlist', playlistId: LIST, position: 9},
      }),
      log,
    );
    expect(store.state).toBe(state);
    read.mockImplementation(() => {
      throw new Error('Unavailable');
    });
    dispatchLogged(store, {type: 'audio.next'}, log);
    expect(store.state).toBe(state);
    expect(log.entries.some(entry => entry.level === 'error')).toBe(true);
    dispatchLogged(
      store,
      {type: 'output.set', screenId: 'main', on: true},
      log,
    );
    expect(store.state.outputs['main']).toBe(true);
    expect(store.state.layers.audio).toBe(state.layers.audio);
  });

  it('releases the catalog connection without removing a newer owner', () => {
    const {store, start, read, release} = setup();
    store.connectAudioMedia(() => read());
    release();
    start();
    expect(store.state.layers.audio?.mediaId).toBe(FIRST);
  });
});
