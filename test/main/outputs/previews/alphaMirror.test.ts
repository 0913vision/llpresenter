import {EventEmitter} from 'node:events';
import {describe, expect, it, vi} from 'vitest';
import {
  createAlphaMirror,
  unpremultiplyBgra,
} from '@main/outputs/previews/alphaMirror';

describe('transparent output preview', () => {
  it('preserves transparency and converts premultiplied BGRA to RGBA', () => {
    const source = new Uint8Array([
      0, 0, 0, 0, 0, 0, 128, 128, 20, 40, 60, 255,
    ]);
    expect([...unpremultiplyBgra(source)]).toEqual([
      0, 0, 0, 0, 255, 0, 0, 128, 60, 40, 20, 255,
    ]);
  });

  it('reuses paint frames, limits delivery and keeps only one frame in flight', async () => {
    const events = new EventEmitter();
    const capturePage = vi.fn();
    const startPainting = vi.fn();
    const source = {
      isDestroyed: () => false,
      capturePage,
      startPainting,
      invalidate: vi.fn(),
      on: events.on.bind(events),
      removeListener: events.removeListener.bind(events),
    };
    const pixels = new Uint8Array(640 * 360 * 4);
    pixels.set([0, 0, 128, 128]);
    const image = {
      isEmpty: () => false,
      getSize: () => ({width: 640, height: 360}),
      resize: () => ({toBitmap: () => pixels}),
    };
    const sentAt: number[] = [];
    const send = vi.fn<(frame: Uint8Array) => void>(() => {
      sentAt.push(performance.now());
    });
    const mirror = createAlphaMirror({
      source: () => source,
      outputActive: () => true,
      send,
    });
    try {
      events.emit('paint', {}, {}, image);
      await vi.waitFor(() => expect(send).toHaveBeenCalledOnce(), {
        timeout: 5000,
      });
      expect(send.mock.calls[0]?.[0].slice(0, 4)).toEqual(
        new Uint8Array([255, 0, 0, 128]),
      );
      events.emit('paint', {}, {}, image);
      events.emit('paint', {}, {}, image);
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(send).toHaveBeenCalledOnce();
      mirror.ack();
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2), {
        timeout: 5000,
      });
      mirror.ack();
      events.emit('paint', {}, {}, image);
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(3), {
        timeout: 5000,
      });
      expect((sentAt[2] ?? 0) - (sentAt[1] ?? 0)).toBeGreaterThanOrEqual(95);
      expect(capturePage).not.toHaveBeenCalled();
      expect(startPainting).not.toHaveBeenCalled();
    } finally {
      mirror.stop();
    }
    expect(events.listenerCount('paint')).toBe(0);
  });

  it('never subscribes to or wakes an inactive output', () => {
    const events = new EventEmitter();
    const startPainting = vi.fn();
    const source = {
      isDestroyed: () => false,
      startPainting,
      invalidate: vi.fn(),
      on: events.on.bind(events),
      removeListener: events.removeListener.bind(events),
    };
    const send = vi.fn();
    const mirror = createAlphaMirror({
      source: () => source,
      outputActive: () => false,
      send,
    });
    expect(events.listenerCount('paint')).toBe(0);
    expect(startPainting).not.toHaveBeenCalled();
    expect(source.invalidate).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    mirror.stop();
  });

  it('requests one paint when attaching to an active static output', async () => {
    const events = new EventEmitter();
    const image = {
      isEmpty: () => false,
      getSize: () => ({width: 640, height: 360}),
      resize: () => ({toBitmap: () => new Uint8Array(640 * 360 * 4)}),
    };
    const source = {
      isDestroyed: () => false,
      on: events.on.bind(events),
      removeListener: events.removeListener.bind(events),
      invalidate: vi.fn(() => events.emit('paint', {}, {}, image)),
    };
    const send = vi.fn();
    const mirror = createAlphaMirror({
      source: () => source,
      outputActive: () => true,
      send,
    });
    try {
      await vi.waitFor(() => expect(send).toHaveBeenCalledOnce(), {
        timeout: 5000,
      });
      expect(source.invalidate).toHaveBeenCalledOnce();
    } finally {
      mirror.stop();
    }
  });
});
