import {describe, expect, it, vi} from 'vitest';
import {
  emptyLiveState,
  type LiveState,
  type MediaLayer,
} from '@core/live/state';
import type {MediaProgress} from '@core/schema/mediaProgress';
import {installMockClock} from '@fixtures/mockClock';
import {startMediaProgress} from '@main/live/mediaProgress';
import type {LiveStore} from '@main/live/store';

const DAWN: MediaLayer = {mediaId: 'dawn', loop: true, startedAt: 0};

function reading(positionSeconds: number): MediaProgress {
  return {
    mediaId: 'dawn',
    startedAt: 0,
    positionSeconds,
    durationSeconds: 3,
  };
}

function mockStore() {
  const listeners = new Set<(state: LiveState) => void>();
  let state = emptyLiveState();
  const store = {
    get state() {
      return state;
    },
    mediaProgress: vi.fn<LiveStore['mediaProgress']>(() => null),
    subscribe: vi.fn<LiveStore['subscribe']>(listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const announce = (next: LiveState) => {
    state = next;
    for (const listener of listeners) listener(state);
  };
  const showMedia = (media: MediaLayer | null) =>
    announce({...state, layers: {...state.layers, media}});
  return {store, listeners, announce, showMedia};
}

function mockLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  };
}

describe('startMediaProgress', () => {
  it('samples twice a second while a background plays, skips repeats and unrelated changes, and cleans up', async () => {
    const clock = installMockClock();
    const {store, listeners, announce, showMedia} = mockStore();
    const publish = vi.fn();
    const stop = startMediaProgress(store, publish, mockLog());
    expect(publish).not.toHaveBeenCalled();

    store.mediaProgress.mockReturnValue(reading(0));
    showMedia(DAWN);
    expect(publish).toHaveBeenLastCalledWith(reading(0));
    await clock.advance(499);
    expect(publish).toHaveBeenCalledOnce();
    store.mediaProgress.mockReturnValue(reading(0.5));
    await clock.advance(1);
    expect(publish).toHaveBeenLastCalledWith(reading(0.5));
    announce({...store.state, stageMessage: 'Invented'});
    await clock.advance(500);
    expect(publish).toHaveBeenCalledTimes(2);

    store.mediaProgress.mockReturnValue(null);
    showMedia(null);
    expect(publish).toHaveBeenLastCalledWith(null);
    expect(vi.getTimerCount()).toBe(0);
    stop();
    expect(listeners.size).toBe(0);
  });

  it('logs a failed publication and still disposes its timer and listener', async () => {
    const clock = installMockClock();
    const {store, listeners, showMedia} = mockStore();
    const publish = vi.fn().mockImplementationOnce(() => {
      throw new Error('Invented send failure');
    });
    const log = mockLog();
    const stop = startMediaProgress(store, publish, log);
    store.mediaProgress.mockReturnValue(reading(0));
    showMedia(DAWN);
    expect(log.warn).toHaveBeenCalledOnce();

    await clock.advance(500);
    expect(publish).toHaveBeenCalledTimes(2);
    stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners.size).toBe(0);
  });
});
