import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {parseLiveState} from '@shared/schema/liveState';
import {audioPositionSeconds} from '@shared/schema/audioState';
import {LiveStore} from './store';

function setup(
  paused = false,
  audioTrackVersion?: number,
  fadeOutSince?: number,
) {
  const mediaId = '00000000-0000-4000-8000-000000000001';
  const initial = emptyLiveState();
  const parsed = parseLiveState({
    ...initial,
    version: 7,
    audioVolume: 43,
    ...(audioTrackVersion === undefined ? {} : {audioTrackVersion}),
    layers: {
      ...initial.layers,
      message: {messageId: 'fixture', text: 'Fixture'},
      audio: {
        mediaId,
        playback: {
          source: {kind: 'media', mediaId},
          trackVersion: 7,
          since: paused ? null : 1000,
          positionSeconds: 2,
          ...(fadeOutSince === undefined ? {} : {fadeOutSince}),
        },
      },
    },
  });
  if (!parsed.ok) throw new Error('Invalid playback fixture');
  let wall = Date.now();
  let timer = 5000;
  const store = new LiveStore(parsed.value, {
    wall: () => wall,
    timer: () => timer,
  });
  return {
    store,
    later: () => {
      wall -= 3600_000;
      timer += 20_000;
    },
  };
}
describe('audio clear undo', () => {
  it('restores F1 audio on the monotonic clock with a fresh playback identity', () => {
    const {store, later} = setup();
    store.dispatch({type: 'layer.clear.toggle', target: 'all'});
    later();
    store.dispatch({type: 'layer.clear.toggle', target: 'all'});
    expect(store.state.layers.audio?.playback).toMatchObject({
      positionSeconds: 6,
      since: 25_000,
    });
    expect(store.state.layers.audio?.playback?.trackVersion).toBeGreaterThan(7);
    expect(store.state.layers.message?.text).toBe('Fixture');
  });

  it('keeps another key capture through audio pause and resume', () => {
    const {store} = setup();
    store.dispatch({type: 'layer.clear.toggle', target: 'message'});
    store.dispatch({type: 'audio.pause'});
    store.dispatch({type: 'audio.play'});
    expect(store.state.clearToggles).toEqual(['message']);
    store.dispatch({type: 'layer.clear.toggle', target: 'message'});
    expect(store.state.layers.message?.text).toBe('Fixture');
  });

  it('restores a manual fade with the same remaining time after undo', () => {
    const {store, later} = setup(false, undefined, 4000);
    store.dispatch({type: 'layer.clear', target: 'audio'});
    later();
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers.audio?.playback).toMatchObject({
      fadeOutSince: 24_000,
      since: 25_000,
      positionSeconds: 6,
    });
    expect(
      store.dispatch({
        type: 'audio.fadeOut.complete',
        trackVersion: 7,
        since: 4000,
      }),
    ).toBe(false);
  });
  it('allocates undo identity after the retained counter rather than the batch-compressed state version', () => {
    const {store, later} = setup(false, 100);
    store.dispatch({type: 'layer.clear', target: 'audio'});
    later();
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers.audio?.playback?.trackVersion).toBe(101);
    expect(store.state.audioTrackVersion).toBe(101);
  });
  it('keeps the audio clear position when a batch clears another layer first', () => {
    const {store, later} = setup();
    store.dispatch({
      type: 'live.batch',
      commands: [
        {type: 'layer.clear', target: 'message'},
        {type: 'layer.clear', target: 'audio'},
      ],
    });
    later();
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers.audio?.playback).toMatchObject({
      positionSeconds: 6,
      since: 25_000,
    });
  });
  it.each(['audio', 'all'] as const)(
    'restores the position at %s clear on the monotonic clock',
    target => {
      const {store, later} = setup();
      store.dispatch({type: 'layer.clear', target});
      expect(store.state.layers.audio).toBeNull();
      expect(store.state.canUndo).toBe(true);
      later();
      store.dispatch({type: 'clear.undo'});
      expect(store.state.layers.audio?.playback).toMatchObject({
        positionSeconds: 6,
        since: 25_000,
      });
      expect(store.state.layers.audio?.playback?.trackVersion).toBeGreaterThan(
        7,
      );
      expect(store.state.audioVolume).toBe(43);
      expect(store.dispatch({type: 'audio.next', trackVersion: 7})).toBe(false);
    },
  );
  it('restores paused audio as paused', () => {
    const {store, later} = setup(true);
    store.dispatch({type: 'layer.clear', target: 'audio'});
    later();
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers.audio?.playback).toMatchObject({
      positionSeconds: 2,
      since: null,
    });
  });
  it('does not freeze audio when undoing another layer clear', () => {
    const {store, later} = setup();
    const audio = store.state.layers.audio;
    store.dispatch({type: 'layer.clear', target: 'message'});
    later();
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers.audio).toBe(audio);
    const playback = store.state.layers.audio?.playback;
    if (playback === undefined) throw new Error('Missing playback');
    expect(audioPositionSeconds(playback, 25_000)).toBe(26);
  });
});
