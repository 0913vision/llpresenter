import {expect, it, vi} from 'vitest';
import {waitForPaint} from '@renderer/output/waitForPaint';

it('holds the outgoing picture until two consecutive completed paints, however long loading takes', () => {
  let callback: FrameRequestCallback = () => undefined;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(next => {
    callback = next;
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  let ready = false;
  const reveal = vi.fn();
  const cancel = waitForPaint(() => ready, reveal);
  callback(0);
  callback(500);
  expect(reveal).not.toHaveBeenCalled();
  ready = true;
  callback(516);
  ready = false;
  callback(532);
  ready = true;
  callback(548);
  expect(reveal).not.toHaveBeenCalled();
  callback(564);
  expect(reveal).toHaveBeenCalledOnce();
  cancel();
  vi.restoreAllMocks();
});
