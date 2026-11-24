import {describe, expect, it, vi} from 'vitest';
import {
  ackNativeMirror,
  publishNativeMirror,
  setNativeMirror,
  subscribeNativeMirror,
} from '@main/outputs/previews/nativeMirror';

describe('native mirror feed', () => {
  it('starts only with a subscriber, acknowledges frames, and ends on hide', () => {
    const pump = {enable: vi.fn(), ack: vi.fn()};
    const sink = vi.fn();
    setNativeMirror('one', pump);
    expect(pump.enable).not.toHaveBeenCalled();
    const unsubscribe = subscribeNativeMirror('one', sink);
    expect(pump.enable).toHaveBeenCalledWith(true);
    const frame = new Uint8Array(640 * 360 * 4);
    publishNativeMirror('one', frame);
    expect(sink).toHaveBeenCalledWith(frame);
    expect(pump.ack).not.toHaveBeenCalled();
    ackNativeMirror('one');
    expect(pump.ack).toHaveBeenCalledOnce();
    setNativeMirror('one', null);
    expect(pump.enable).toHaveBeenLastCalledWith(false);
    expect(sink).toHaveBeenLastCalledWith(null);
    unsubscribe();
  });

  it('starts a presenter created after its subscriber and stops when unsubscribed', () => {
    const pump = {enable: vi.fn(), ack: vi.fn()};
    const availability = vi.fn();
    const unsubscribe = subscribeNativeMirror('two', vi.fn(), availability);
    expect(availability).toHaveBeenCalledWith(false);
    setNativeMirror('two', pump);
    expect(availability).toHaveBeenLastCalledWith(true);
    expect(pump.enable).toHaveBeenCalledWith(true);
    unsubscribe();
    expect(pump.enable).toHaveBeenLastCalledWith(false);
    publishNativeMirror('two', new Uint8Array(1));
    expect(pump.ack).toHaveBeenCalledOnce();
    setNativeMirror('two', null);
  });
});
