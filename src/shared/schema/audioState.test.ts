import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '../live';
import {parseLiveState} from './liveState';

const playback = {
  source: {kind: 'media', mediaId: '00000000-0000-4000-8000-000000000001'},
  trackVersion: 1,
  positionSeconds: 0,
  since: 1000,
};

function state(change: object = {}) {
  const initial = emptyLiveState();
  return {
    ...initial,
    audioVolume: 75,
    layers: {
      ...initial.layers,
      audio: {
        mediaId: playback.source.mediaId,
        playback: {...playback, ...change},
      },
    },
  };
}

describe('audio playback state', () => {
  it.each([-1, NaN, Infinity])(
    'rejects invalid fade start %s',
    fadeOutSince => {
      expect(parseLiveState(state({fadeOutSince})).ok).toBe(false);
    },
  );
  it.each([0, 7, Number.MAX_SAFE_INTEGER])(
    'accepts allocated track version %s',
    audioTrackVersion => {
      expect(parseLiveState({...state(), audioTrackVersion}).ok).toBe(true);
    },
  );
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid allocated version %s',
    audioTrackVersion => {
      expect(parseLiveState({...state(), audioTrackVersion}).ok).toBe(false);
    },
  );
  it('accepts running, paused and legacy playback and default volume', () => {
    for (const value of [state(), state({since: null}), emptyLiveState()]) {
      expect(parseLiveState(value)).toEqual({ok: true, value});
    }
  });
  it.each([
    {since: NaN},
    {since: -1},
    {positionSeconds: -1},
    {positionSeconds: Infinity},
    {positionSeconds: Number.MAX_SAFE_INTEGER + 1},
    {trackVersion: -1},
    {trackVersion: 0.5},
    {source: {kind: 'media', mediaId: 'invalid'}},
    {
      source: {
        kind: 'playlist',
        playlistId: playback.source.mediaId,
        position: -1,
      },
    },
  ])('rejects malformed or unbounded playback %j', change =>
    expect(parseLiveState(state(change)).ok).toBe(false),
  );
  it.each([-1, 101, NaN, Infinity])(
    'rejects invalid volume %s',
    audioVolume => {
      expect(parseLiveState({...state(), audioVolume}).ok).toBe(false);
    },
  );
});
