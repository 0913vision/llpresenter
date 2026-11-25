import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  PRESENTER_STALL_MS,
  PresenterFrames,
  type FrameMessage,
} from '@main/outputs/presenter/presenterFrames';

afterEach(() => {
  vi.useRealTimers();
});

function texture(handleBytes = 8) {
  const handle = Buffer.alloc(handleBytes);
  if (handleBytes === 8) handle.writeBigUInt64LE(0xabcn);
  const release = vi.fn();
  return {value: {textureInfo: {handle: {ntHandle: handle}}, release}, release};
}

function setup() {
  const posted: FrameMessage[] = [];
  const stalled = vi.fn();
  const failed = vi.fn();
  const frames = new PresenterFrames({
    post: message => posted.push(message),
    stalled,
    failed,
  });
  return {frames, posted, stalled, failed};
}

describe('PresenterFrames', () => {
  it('keeps one frame with the presenter, the newest painted one waiting, and frees each when done', () => {
    const {frames, posted} = setup();
    const first = texture();
    const second = texture();
    const third = texture();

    frames.take(first.value, true);
    frames.take(second.value, true);
    frames.take(third.value, true);

    expect(posted).toEqual([
      {type: 'frame', pid: process.pid, handle: 'abc', id: 1},
    ]);
    expect(second.release).toHaveBeenCalledOnce();
    frames.copied(7);
    expect(first.release).not.toHaveBeenCalled();
    frames.copied(1);
    expect(first.release).toHaveBeenCalledOnce();
    expect(posted.at(-1)).toMatchObject({id: 2});
    expect(third.release).not.toHaveBeenCalled();
  });

  it('holds frames while the presenter cannot take them and sends the newest once it can', () => {
    const {frames, posted} = setup();
    frames.take(texture().value, false);
    expect(frames.idle).toBe(false);
    expect(posted).toHaveLength(0);

    expect(frames.sendWaiting()).toBe(true);
    expect(posted).toHaveLength(1);
    frames.copied(1);
    expect(frames.idle).toBe(true);
    expect(frames.sendWaiting()).toBe(false);
  });

  it('tells a presenter that took no frame for the stall time, and not one that did', () => {
    vi.useFakeTimers();
    const {frames, stalled} = setup();
    frames.take(texture().value, true);
    vi.advanceTimersByTime(PRESENTER_STALL_MS - 1);
    frames.copied(1);
    frames.take(texture().value, true);
    vi.advanceTimersByTime(PRESENTER_STALL_MS - 1);
    expect(stalled).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(stalled).toHaveBeenCalledOnce();
  });

  it('refuses a frame it cannot hand over, and frees everything on close', () => {
    const {frames, failed} = setup();
    const odd = texture(4);
    frames.take(odd.value, true);
    expect(odd.release).toHaveBeenCalledOnce();
    expect(failed).toHaveBeenCalledWith('unsupported texture handle');

    const sent = texture();
    const waiting = texture();
    frames.take(sent.value, true);
    frames.take(waiting.value, true);
    frames.close();
    expect(sent.release).toHaveBeenCalledOnce();
    expect(waiting.release).toHaveBeenCalledOnce();
    expect(frames.idle).toBe(true);
  });
});
