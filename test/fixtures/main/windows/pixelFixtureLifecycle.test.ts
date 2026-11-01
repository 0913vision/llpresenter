import {afterEach, expect, it, vi} from 'vitest';
import {
  ELECTRON_STARTUP_DEADLINE_MS,
  PIXEL_CHECK_DEADLINE_MS,
  ownPixelFixture,
  watchPixelFixture,
} from './pixelFixtureLifecycle.mts';

afterEach(() => vi.useRealTimers());

it('lets a loaded Electron start take longer than the old 30 second limit', () => {
  vi.useFakeTimers();
  const expired = vi.fn();
  const deadline = watchPixelFixture(expired);
  vi.advanceTimersByTime(30_001);
  expect(expired).not.toHaveBeenCalled();
  deadline.checking();
  vi.advanceTimersByTime(PIXEL_CHECK_DEADLINE_MS - 1);
  expect(expired).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(expired).toHaveBeenCalledExactlyOnceWith('pixels');
  expect(vi.getTimerCount()).toBe(0);
  deadline.dispose();
});

it('expires a stalled start once and cancels the startup timer when ready', () => {
  vi.useFakeTimers();
  const expired = vi.fn();
  const stalled = watchPixelFixture(expired);
  vi.advanceTimersByTime(ELECTRON_STARTUP_DEADLINE_MS);
  expect(expired).toHaveBeenCalledExactlyOnceWith('startup');
  stalled.checking();
  expect(vi.getTimerCount()).toBe(0);

  expired.mockClear();
  const ready = watchPixelFixture(expired);
  vi.advanceTimersByTime(ELECTRON_STARTUP_DEADLINE_MS - 1);
  ready.checking();
  vi.advanceTimersByTime(1);
  expect(expired).not.toHaveBeenCalled();
  ready.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it('gives the second viewport a fresh startup budget and cancels all deadlines on disposal', () => {
  vi.useFakeTimers();
  const expired = vi.fn();
  const deadline = watchPixelFixture(expired);
  deadline.checking();
  vi.advanceTimersByTime(PIXEL_CHECK_DEADLINE_MS - 1);
  deadline.starting();
  vi.advanceTimersByTime(ELECTRON_STARTUP_DEADLINE_MS - 1);
  expect(expired).not.toHaveBeenCalled();
  deadline.dispose();
  deadline.starting();
  vi.runAllTimers();
  expect(expired).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('aborts an unfinished fixture and waits for its close before teardown finishes', async () => {
  let signal: AbortSignal | null = null;
  let close = (): void => {
    throw new Error('No fixture process');
  };
  const fixture = ownPixelFixture(interrupt => {
    signal = interrupt;
    return new Promise<{leftRunning: boolean}>(resolve => {
      close = () => resolve({leftRunning: false});
    });
  });
  let stopped = false;
  const stopping = fixture.stop().then(() => {
    stopped = true;
  });
  expect(signal).toHaveProperty('aborted', true);
  await Promise.resolve();
  expect(stopped).toBe(false);
  close();
  await stopping;
  expect(stopped).toBe(true);
  await fixture.stop();
});

it('still tears down a fixture when a pixel assertion fails', async () => {
  let signal: AbortSignal | null = null;
  const fixture = ownPixelFixture(async interrupt => {
    signal = interrupt;
    return {leftRunning: false};
  });
  const check = async (): Promise<void> => {
    try {
      await fixture.running;
      throw new Error('pixel mismatch');
    } finally {
      await fixture.stop();
    }
  };
  await expect(check()).rejects.toThrow('pixel mismatch');
  expect(signal).toHaveProperty('aborted', true);
});

it('reports a process tree that could not be closed instead of hiding it', async () => {
  const fixture = ownPixelFixture(async () => ({leftRunning: true}));
  await expect(fixture.stop()).rejects.toThrow(
    'did not close its process tree',
  );
});
