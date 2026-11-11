import {describe, expect, it, vi} from 'vitest';
import {TextureQueue} from '@main/ndi/textureQueue';

const full = {x: 0, y: 0, width: 1920, height: 1080};
function frame(dirty = full) {
  return {dirty, texture: {release: vi.fn()}};
}
function setup() {
  const send = vi.fn();
  const invalidate = vi.fn();
  const overflow = vi.fn();
  const recovered = vi.fn();
  const queue = new TextureQueue({send, invalidate, overflow, recovered});
  return {queue, send, invalidate, overflow, recovered};
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
  it('drops intermediate textures, then waits for a full refresh', () => {
    const {queue, invalidate, overflow, recovered} = setup();
    const frames = Array.from({length: 5}, () => frame());
    for (const item of frames) queue.push(item);
    expect(frames[3]?.texture.release).toHaveBeenCalledOnce();
    expect(frames[4]?.texture.release).toHaveBeenCalledOnce();
    expect(overflow).toHaveBeenCalledOnce();
    for (let i = 0; i < 3; i++) queue.acknowledge();
    expect(invalidate).toHaveBeenCalledOnce();
    const partial = frame({x: 1, y: 0, width: 100, height: 100});
    queue.push(partial);
    expect(partial.texture.release).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledTimes(2);
    const restored = frame();
    queue.push(restored);
    expect(recovered).toHaveBeenCalledOnce();
    queue.acknowledge();
    expect(restored.texture.release).toHaveBeenCalledOnce();
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
