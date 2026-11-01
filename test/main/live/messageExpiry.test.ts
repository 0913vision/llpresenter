import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {MAX_OVERLAY_TIMER_MS} from '@core/overlays/noticeClock';
import {parseLiveState} from '@core/schema/liveState';
import type {MessageExpiry} from '@core/schema/overlayState';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {MAIN, overlayUuid} from '@fixtures/core/overlays';
import {followMessageExpiry} from '@main/live/messageExpiry';
import type {LiveStore} from '@main/live/store';

const NOW = 100_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

function withMessages(expiries: ReadonlyArray<number | null>): LiveState {
  const empty = emptyLiveState();
  return expectSuccess(
    parseLiveState({
      ...empty,
      layers: {
        ...empty.layers,
        message: {
          messageId: 'summary',
          text: '',
          items: expiries.map((expiresAt, index) => ({
            messageId: overlayUuid(index + 1),
            text: `Message ${index}`,
            targets: [MAIN],
            excludedTargets: [],
            startedAt: NOW,
            expiresAt,
          })),
        },
      },
    }),
  );
}

function setup(initial: LiveState) {
  const listeners = new Set<(state: LiveState) => void>();
  let state = initial;
  const store = {
    get state() {
      return state;
    },
    subscribe: vi.fn<LiveStore['subscribe']>(listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const announce = (next: LiveState) => {
    state = next;
    for (const listener of listeners) listener(state);
  };
  const send = vi.fn<(command: MessageExpiry) => void>();
  const stop = followMessageExpiry({store, send, now: () => Date.now()});
  return {store, listeners, announce, send, stop};
}

describe('followMessageExpiry', () => {
  it('asks to expire the earliest timed message at its deadline', () => {
    const {send} = setup(withMessages([NOW + 30_000, NOW + 10_000, null]));

    vi.advanceTimersByTime(9_999);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledWith({
      type: 'message.expire',
      messageId: overlayUuid(2),
      expiresAt: NOW + 10_000,
    });
  });

  it('wakes after at most the overlay timer limit for a far deadline', () => {
    const {send} = setup(withMessages([NOW + MAX_OVERLAY_TIMER_MS * 2]));

    vi.advanceTimersByTime(MAX_OVERLAY_TIMER_MS);
    expect(send).toHaveBeenCalledOnce();
  });

  it('schedules nothing without a timed message, and follows changed messages', () => {
    const {announce, send} = setup(withMessages([null]));
    expect(vi.getTimerCount()).toBe(0);

    announce(withMessages([NOW + 5_000]));
    expect(vi.getTimerCount()).toBe(1);
    announce(emptyLiveState());
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5_000);
    expect(send).not.toHaveBeenCalled();
  });

  it('releases its timer and listener on dispose', () => {
    const {listeners, send, stop} = setup(withMessages([NOW + 5_000]));

    stop();
    vi.advanceTimersByTime(5_000);
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners.size).toBe(0);
  });
});
