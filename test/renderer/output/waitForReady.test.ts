import {expect, it, vi} from 'vitest';
import {waitForReady} from '@renderer/output/waitForReady';

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
