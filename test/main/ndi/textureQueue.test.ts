import {describe, expect, it, vi} from 'vitest';
import {TextureQueue} from '@main/ndi/textureQueue';

const full = {x: 0, y: 0, width: 1920, height: 1080};
function frame(dirty = full) {
  return {dirty, texture: {release: vi.fn()}};
}
function setup() {
  const send = vi.fn();
  const queue = new TextureQueue({send});
  return {queue, send};
}

describe('texture queue', () => {
  it('retains in-flight textures until acknowledgement and hands them off on clear', () => {
    const {queue, send} = setup();
    const first = frame();
    const next = frame();
    queue.push(first);
    queue.push(next);
    expect(first.texture.release).not.toHaveBeenCalled();
    expect(queue.acknowledge()).toBe(true);
    expect(first.texture.release).toHaveBeenCalledOnce();
    expect(send).toHaveBeenLastCalledWith(next);
    expect(queue.clear()).toBe(next);
    expect(next.texture.release).not.toHaveBeenCalled();
    expect(queue.acknowledge()).toBe(false);
  });
  it('sends the newest texture after overflow without another paint, combining all skipped dirty regions', () => {
    const {queue, send} = setup();
    const first = frame({x: 0, y: 0, width: 20, height: 20});
    const older = frame({x: 30, y: 5, width: 10, height: 10});
    const middle = frame({x: 5, y: 40, width: 15, height: 10});
    const newest = frame({x: 50, y: 20, width: 10, height: 10});
    for (const item of [first, older, middle, newest]) queue.push(item);
    expect(older.texture.release).toHaveBeenCalledOnce();
    expect(middle.texture.release).toHaveBeenCalledOnce();
    expect(newest.texture.release).not.toHaveBeenCalled();
    queue.acknowledge();
    expect(send).toHaveBeenLastCalledWith({
      texture: newest.texture,
      dirty: {x: 5, y: 5, width: 55, height: 45},
    });
    queue.acknowledge();
    expect(newest.texture.release).toHaveBeenCalledOnce();
    expect(queue.busy).toBe(false);
  });

  it('preserves coalesced dirty regions through repeated overflows', () => {
    const {queue, send} = setup();
    const frames = Array.from({length: 6}, (_, i) =>
      frame({x: i * 10, y: 0, width: 5, height: 5}),
    );
    for (const item of frames) queue.push(item);
    queue.acknowledge();
    expect(send).toHaveBeenLastCalledWith({
      texture: frames[5]?.texture,
      dirty: {x: 10, y: 0, width: 45, height: 5},
    });
    for (const item of frames.slice(1, 5)) {
      expect(item.texture.release).toHaveBeenCalledOnce();
    }
    queue.acknowledge();
    expect(frames[5]?.texture.release).toHaveBeenCalledOnce();
  });
  it('releases every pending frame on clear', () => {
    const {queue} = setup();
    const running = frame();
    const pending = frame();
    queue.push(running);
    queue.push(pending);
    expect(queue.clear()).toBe(running);
    expect(pending.texture.release).toHaveBeenCalledOnce();
  });
});
