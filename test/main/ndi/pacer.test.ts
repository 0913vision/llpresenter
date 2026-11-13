import {afterEach, describe, expect, it, vi} from 'vitest';
import {createPacer} from '../../../src/main/ndi/pacer.cjs';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe('NDI frame pacing', () => {
  it('sends a still frame 30 times per second and stops', () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const pacer = createPacer(send);
    send();
    pacer.sent();
    vi.advanceTimersByTime(967);
    expect(send).toHaveBeenCalledTimes(30);
    pacer.stop();
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(30);
  });
  it('restarts the interval after a new frame', () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const pacer = createPacer(send);
    send();
    pacer.sent();
    vi.advanceTimersByTime(20);
    send();
    pacer.sent();
    vi.advanceTimersByTime(33);
    expect(send).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(3);
    pacer.stop();
  });
  it('sends only once when a timer runs late', () => {
    vi.useFakeTimers();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const send = vi.fn();
    const pacer = createPacer(send);
    pacer.sent();
    now = 300;
    vi.advanceTimersByTime(34);
    expect(send).toHaveBeenCalledTimes(1);
    pacer.stop();
  });
});
