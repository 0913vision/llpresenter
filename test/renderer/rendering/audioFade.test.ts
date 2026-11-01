import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fadeAudio} from '@renderer/rendering/audioFade';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('fadeAudio', () => {
  it('lowers gain and ends at its deadline even if clock sampling stops', () => {
    let now = 0;
    const gain = vi.fn();
    const end = vi.fn();
    fadeAudio({durationMs: 400, now: () => now, gain, end, onError: vi.fn()});
    now = 200;
    vi.advanceTimersByTime(200);
    expect(gain).toHaveBeenLastCalledWith(0.5);
    expect(end).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(gain).toHaveBeenLastCalledWith(0);
    expect(end).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels both timers without later ending a newer track', () => {
    const end = vi.fn();
    const cancel = fadeAudio({
      durationMs: 400,
      now: () => 0,
      gain: vi.fn(),
      end,
      onError: vi.fn(),
    });
    cancel();
    cancel();
    vi.advanceTimersByTime(1000);
    expect(end).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('logs a failing gain update and still stops playback and both timers', () => {
    const end = vi.fn();
    const onError = vi.fn();
    fadeAudio({
      durationMs: 400,
      now: () => 0,
      gain: () => {
        throw new Error('Volume failed');
      },
      end,
      onError,
    });
    expect(() => vi.advanceTimersByTime(20)).not.toThrow();
    expect(end).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports an end that throws and still stops both timers', () => {
    const onError = vi.fn();
    const failure = new Error('End failed');
    fadeAudio({
      durationMs: 400,
      now: () => 0,
      gain: vi.fn(),
      end: () => {
        throw failure;
      },
      onError,
    });
    expect(() => vi.advanceTimersByTime(400)).not.toThrow();
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports the failure of the last gain update and still ends', () => {
    const end = vi.fn();
    const onError = vi.fn();
    const failure = new Error('Last volume failed');
    const fractions: number[] = [];
    fadeAudio({
      durationMs: 40,
      now: () => 0,
      gain: fraction => {
        fractions.push(fraction);
        if (fraction === 0) throw failure;
      },
      end,
      onError,
    });
    vi.advanceTimersByTime(40);
    expect(fractions).toEqual([1, 0]);
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(end).toHaveBeenCalledOnce();
  });
});
