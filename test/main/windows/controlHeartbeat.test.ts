import {afterEach, describe, expect, it, vi} from 'vitest';
import {ControlHeartbeat} from '@main/windows/controlHeartbeat';

afterEach(() => vi.useRealTimers());

describe('control heartbeat', () => {
  it('keeps checking an answering renderer without reporting a hang', async () => {
    vi.useFakeTimers();
    const ping = vi.fn().mockResolvedValue(undefined);
    const timeout = vi.fn();
    const watch = new ControlHeartbeat(ping, timeout);
    watch.start();
    await vi.advanceTimersByTimeAsync(10000);
    expect(ping.mock.calls.length).toBeGreaterThan(5);
    expect(timeout).not.toHaveBeenCalled();
    watch.stop();
  });

  it('reports an unanswered ping once after five seconds and ignores late replies', async () => {
    vi.useFakeTimers();
    let answer: (() => void) | undefined;
    const ping = vi.fn(
      () =>
        new Promise<void>(resolve => {
          answer = resolve;
        }),
    );
    const timeout = vi.fn();
    const watch = new ControlHeartbeat(ping, timeout);
    watch.start();
    await vi.advanceTimersByTimeAsync(4999);
    expect(timeout).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(timeout).toHaveBeenCalledTimes(1);
    answer?.();
    await vi.advanceTimersByTimeAsync(10000);
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(ping).toHaveBeenCalledTimes(1);
    watch.stop();
  });

  it('discards the old reply after stop and restart', async () => {
    vi.useFakeTimers();
    let answer: (() => void) | undefined;
    const ping = vi.fn(
      () =>
        new Promise<void>(resolve => {
          answer = resolve;
        }),
    );
    const timeout = vi.fn();
    const watch = new ControlHeartbeat(ping, timeout);
    watch.start();
    await vi.advanceTimersByTimeAsync(0);
    const oldAnswer = answer;
    watch.stop();
    watch.start();
    await vi.advanceTimersByTimeAsync(0);
    oldAnswer?.();
    await vi.advanceTimersByTimeAsync(5000);
    expect(timeout).toHaveBeenCalledTimes(1);
    watch.stop();
  });
});
