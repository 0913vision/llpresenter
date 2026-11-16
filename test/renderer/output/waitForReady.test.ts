import {expect, it, vi} from 'vitest';
import {afterTwoFrames, waitForReady} from '@renderer/output/waitForReady';

it('starts only after two frames and cancels a pending start', () => {
  let callback: FrameRequestCallback = () => undefined;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(next => {
    callback = next;
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  const start = vi.fn();
  afterTwoFrames(start);
  callback(0);
  expect(start).not.toHaveBeenCalled();
  callback(16);
  expect(start).toHaveBeenCalledOnce();
  const cancel = afterTwoFrames(start);
  callback(32);
  cancel();
  callback(48);
  expect(start).toHaveBeenCalledOnce();
  vi.restoreAllMocks();
});

it('reveals the incoming picture as soon as loading completes', () => {
  let callback: FrameRequestCallback = () => undefined;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(next => {
    callback = next;
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  let ready = false;
  const reveal = vi.fn();
  const deadline = vi.fn();
  const cancel = waitForReady(() => ready, reveal, deadline);
  callback(0);
  callback(500);
  expect(reveal).not.toHaveBeenCalled();
  ready = true;
  callback(516);
  expect(reveal).toHaveBeenCalledOnce();
  expect(deadline).not.toHaveBeenCalled();
  cancel();
  vi.restoreAllMocks();
});

it('reveals at the deadline without animation frames and cancels superseded waits', () => {
  vi.useFakeTimers();
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  const reveal = vi.fn();
  const deadline = vi.fn();
  const cancel = waitForReady(() => false, reveal, deadline);
  vi.advanceTimersByTime(1499);
  expect(reveal).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(deadline).toHaveBeenCalledOnce();
  expect(reveal).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(3000);
  expect(deadline).toHaveBeenCalledOnce();
  cancel();
  const cancelNew = waitForReady(() => false, reveal, deadline);
  cancelNew();
  vi.advanceTimersByTime(1500);
  expect(reveal).toHaveBeenCalledOnce();
  expect(deadline).toHaveBeenCalledOnce();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
