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
  const cancel = waitForReady(() => ready, reveal);
  callback(0);
  callback(500);
  expect(reveal).not.toHaveBeenCalled();
  ready = true;
  callback(516);
  expect(reveal).toHaveBeenCalledOnce();
  cancel();
  vi.restoreAllMocks();
});
