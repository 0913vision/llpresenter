import {EventEmitter} from 'node:events';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createAlphaMirror, unpremultiplyBgra} from '@main/outputs/alphaMirror';

afterEach(() => vi.useRealTimers());

describe('transparent NDI preview', () => {
  it('preserves transparency and converts premultiplied BGRA to canvas RGBA', () => {
    const source = new Uint8Array([
      0, 0, 0, 0, 0, 0, 128, 128, 20, 40, 60, 255,
    ]);
    expect([...unpremultiplyBgra(source)]).toEqual([
      0, 0, 0, 0, 255, 0, 0, 128, 60, 40, 20, 255,
    ]);
  });

  it('keeps one frame in flight and stops sampling when hidden', async () => {
    vi.useFakeTimers();
    const image = {
      isEmpty: () => false,
      getSize: () => ({width: 1920, height: 1080}),
      resize: () => ({toBitmap: () => new Uint8Array(640 * 360 * 4)}),
    };
    const source = {
      isDestroyed: () => false,
      capturePage: vi.fn().mockResolvedValue(image),
    };
    const send = vi.fn();
    const mirror = createAlphaMirror({source: () => source, send});
    await vi.advanceTimersByTimeAsync(0);
    expect(source.capturePage).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(200);
    expect(source.capturePage).toHaveBeenCalledOnce();
    mirror.ack();
    await vi.advanceTimersByTimeAsync(50);
    expect(source.capturePage).toHaveBeenCalledTimes(2);
    mirror.stop();
    mirror.ack();
    await vi.advanceTimersByTimeAsync(200);
    expect(source.capturePage).toHaveBeenCalledTimes(2);
  });

  it('paints only on changes while previewing an inactive output', async () => {
    vi.useFakeTimers();
    const events = new EventEmitter();
    let painting = false;
    const image = {
      isEmpty: () => false,
      getSize: () => ({width: 640, height: 360}),
      resize: () => ({toBitmap: () => new Uint8Array(640 * 360 * 4)}),
    };
    const source = {
      isDestroyed: () => false,
      isPainting: () => painting,
      startPainting: vi.fn(() => {
        painting = true;
      }),
      stopPainting: vi.fn(() => {
        painting = false;
      }),
      capturePage: vi.fn().mockResolvedValue(image),
      on: events.on.bind(events),
      removeListener: events.removeListener.bind(events),
    };
    let active = false;
    const mirror = createAlphaMirror({
      source: () => source,
      send: vi.fn(),
      outputActive: () => active,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(source.startPainting).toHaveBeenCalledOnce();
    expect(source.capturePage).toHaveBeenCalledOnce();
    mirror.ack();
    await vi.advanceTimersByTimeAsync(1000);
    expect(source.capturePage).toHaveBeenCalledOnce();
    events.emit('paint');
    await vi.advanceTimersByTimeAsync(50);
    expect(source.capturePage).toHaveBeenCalledTimes(2);
    active = true;
    mirror.stop();
    expect(source.stopPainting).not.toHaveBeenCalled();
    expect(events.listenerCount('paint')).toBe(0);

    painting = false;
    active = false;
    const hidden = createAlphaMirror({
      source: () => source,
      send: vi.fn(),
      outputActive: () => active,
    });
    await vi.advanceTimersByTimeAsync(0);
    hidden.stop();
    expect(source.stopPainting).toHaveBeenCalledOnce();
    expect(events.listenerCount('paint')).toBe(0);
  });

  it('contains a wide output inside the preview without stretching it', async () => {
    vi.useFakeTimers();
    const bitmap = new Uint8Array(640 * 320 * 4);
    for (let i = 0; i < bitmap.length; i += 4) {
      bitmap[i + 2] = 255;
      bitmap[i + 3] = 255;
    }
    const resize = vi.fn().mockReturnValue({toBitmap: () => bitmap});
    const image = {
      isEmpty: () => false,
      getSize: () => ({width: 2000, height: 1000}),
      resize,
    };
    const send = vi.fn<(frame: Uint8Array) => void>();
    const mirror = createAlphaMirror({
      source: () => ({
        isDestroyed: () => false,
        capturePage: async () => image,
      }),
      send,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(resize).toHaveBeenCalledWith({
      width: 640,
      height: 320,
      quality: 'good',
    });
    const frame = send.mock.calls[0]?.[0];
    expect(frame?.slice(0, 4)).toEqual(new Uint8Array([0, 0, 0, 0]));
    expect(frame?.slice(20 * 640 * 4, 20 * 640 * 4 + 4)).toEqual(
      new Uint8Array([255, 0, 0, 255]),
    );
    mirror.stop();
  });
});
