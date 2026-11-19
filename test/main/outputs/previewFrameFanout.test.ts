import {expect, it, vi} from 'vitest';
import {PreviewFrameFanout} from '@main/outputs/previewFrameFanout';

it('shares a producer while bounding each window and seeds new subscribers', () => {
  const fanout = new PreviewFrameFanout();
  const first = vi.fn<(frame: Uint8Array | null) => void>();
  const second = vi.fn<(frame: Uint8Array | null) => void>();
  const third = vi.fn<(frame: Uint8Array | null) => void>();
  const one = new Uint8Array([1]);
  const two = new Uint8Array([2]);
  fanout.add(1, first);
  fanout.add(2, second);
  fanout.publish(one);
  expect(fanout.hasCapacity).toBe(false);
  fanout.ack(1);
  expect(fanout.hasCapacity).toBe(true);
  fanout.publish(two);
  expect(first.mock.calls.map(call => call[0])).toEqual([one, two]);
  expect(second.mock.calls.map(call => call[0])).toEqual([one]);
  fanout.ack(2);
  expect(second.mock.calls.map(call => call[0])).toEqual([one, two]);
  fanout.add(3, third);
  expect(third).toHaveBeenCalledExactlyOnceWith(two);
  fanout.publish(null);
  expect(first).toHaveBeenLastCalledWith(null);
  expect(second).toHaveBeenLastCalledWith(null);
  fanout.remove(1);
  fanout.remove(2);
  fanout.remove(3);
  expect(fanout.empty).toBe(true);
});

it('waits for the old frame acknowledgement across source changes', () => {
  const fanout = new PreviewFrameFanout();
  const send = vi.fn<(frame: Uint8Array | null) => void>();
  const old = new Uint8Array([1]);
  const next = new Uint8Array([2]);
  fanout.add(1, send);
  fanout.publish(old);
  fanout.publish(null);
  fanout.publish(next);
  expect(send.mock.calls.map(call => call[0])).toEqual([old, null]);
  fanout.ack(1);
  expect(send.mock.calls.map(call => call[0])).toEqual([old, null, next]);
});
