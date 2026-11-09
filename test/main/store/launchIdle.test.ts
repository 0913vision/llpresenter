import {afterEach, expect, it, vi} from 'vitest';
import {LaunchIdle} from '@main/store/launchIdle';

afterEach(() => vi.useRealTimers());

it('waits for both readiness signals and an idle main turn, only once', async () => {
  vi.useFakeTimers();
  const idle = new LaunchIdle();
  const finished = vi.fn();
  void idle.ready.then(finished, finished);
  idle.serviceReady();
  await vi.advanceTimersByTimeAsync(2000);
  expect(finished).not.toHaveBeenCalled();
  idle.outputsReady();
  await vi.advanceTimersByTimeAsync(999);
  expect(finished).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(finished).toHaveBeenCalledWith(true);
  idle.outputsReady();
  idle.dispose();
  expect(finished).toHaveBeenCalledOnce();
});

it('retries a busy main turn and cancels without leaving shutdown waiting', async () => {
  vi.useFakeTimers();
  const now = vi.spyOn(performance, 'now').mockReturnValue(0);
  const idle = new LaunchIdle();
  const finished = vi.fn();
  void idle.ready.then(finished, finished);
  idle.outputsReady();
  idle.serviceReady();
  now.mockReturnValue(1200);
  await vi.advanceTimersByTimeAsync(1000);
  expect(finished).not.toHaveBeenCalled();
  idle.dispose();
  expect(await idle.ready).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
  now.mockRestore();
});
