import {describe, expect, it, vi} from 'vitest';
import {
  ackPresenterMirror,
  publishPresenterMirror,
  setPresenterMirror,
  subscribePresenterMirror,
} from '@main/outputs/presenterMirror';

describe('presenter mirror feed', () => {
  it('starts only with a subscriber, acknowledges frames, and ends on hide', () => {
    const pump = {enable: vi.fn(), ack: vi.fn()};
    const sink = vi.fn();
    setPresenterMirror('one', pump);
    expect(pump.enable).not.toHaveBeenCalled();
    const unsubscribe = subscribePresenterMirror('one', sink);
    expect(pump.enable).toHaveBeenCalledWith(true);
    const frame = new Uint8Array(640 * 360 * 4);
    publishPresenterMirror('one', frame);
    expect(sink).toHaveBeenCalledWith(frame);
    expect(pump.ack).not.toHaveBeenCalled();
    ackPresenterMirror('one');
    expect(pump.ack).toHaveBeenCalledOnce();
    setPresenterMirror('one', null);
    expect(pump.enable).toHaveBeenLastCalledWith(false);
    expect(sink).toHaveBeenLastCalledWith(null);
    unsubscribe();
  });

  it('starts a presenter created after its subscriber and stops when unsubscribed', () => {
    const pump = {enable: vi.fn(), ack: vi.fn()};
    const availability = vi.fn();
    const unsubscribe = subscribePresenterMirror('two', vi.fn(), availability);
    expect(availability).toHaveBeenCalledWith(false);
    setPresenterMirror('two', pump);
    expect(availability).toHaveBeenLastCalledWith(true);
    expect(pump.enable).toHaveBeenCalledWith(true);
    unsubscribe();
    expect(pump.enable).toHaveBeenLastCalledWith(false);
    publishPresenterMirror('two', new Uint8Array(1));
    expect(pump.ack).toHaveBeenCalledOnce();
    setPresenterMirror('two', null);
  });
});
