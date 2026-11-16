import {afterEach, describe, expect, it, vi} from 'vitest';
import {GpuWipe} from '@renderer/rendering/gpuWipe';

const getContext = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  'getContext',
);
const decode = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  'decode',
);

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  Reflect.deleteProperty(HTMLCanvasElement.prototype, 'requestPaint');
  if (getContext !== undefined) {
    Object.defineProperty(
      HTMLCanvasElement.prototype,
      'getContext',
      getContext,
    );
  }
  if (decode === undefined) {
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
  } else Object.defineProperty(HTMLImageElement.prototype, 'decode', decode);
});

function setup() {
  vi.useFakeTimers();
  const parent = document.createElement('div');
  const old = document.createElement('div');
  const next = document.createElement('div');
  parent.append(old, next);
  document.body.append(parent);
  for (const element of [old, next]) {
    Object.defineProperty(element, 'clientWidth', {value: 1920});
    Object.defineProperty(element, 'clientHeight', {value: 1080});
  }
  next.style.opacity = '1';
  const context = {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    drawElementImage: vi.fn(),
    getImageData: vi.fn(() => ({data: new Uint8ClampedArray([0, 0, 0, 255])})),
  };
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    UNPACK_FLIP_Y_WEBGL: 5,
    TEXTURE0: 6,
    TEXTURE_2D: 7,
    RGBA: 8,
    TEXTURE_MIN_FILTER: 9,
    TEXTURE_MAG_FILTER: 10,
    LINEAR: 11,
    TEXTURE_WRAP_S: 12,
    TEXTURE_WRAP_T: 13,
    CLAMP_TO_EDGE: 14,
    UNSIGNED_BYTE: 15,
    NO_ERROR: 0,
    TRIANGLES: 16,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    deleteProgram: vi.fn(),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    uniform2f: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn<(location: unknown, value: number) => void>(),
    pixelStorei: vi.fn(),
    createTexture: vi.fn(() => ({})),
    activeTexture: vi.fn(),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    getError: vi.fn(() => 0),
    viewport: vi.fn(),
    drawArrays: vi.fn(),
    deleteTexture: vi.fn(),
    getExtension: vi.fn(() => ({loseContext})),
  };
  const loseContext = vi.fn();
  const requestPaint = vi.fn();
  Object.defineProperty(HTMLCanvasElement.prototype, 'requestPaint', {
    configurable: true,
    value: requestPaint,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: (kind: string) => (kind === '2d' ? context : gl),
  });
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const tick = (time: number) => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(time);
  };
  const paint = async () => {
    await Promise.resolve();
    await Promise.resolve();
    parent
      .querySelector('canvas[layoutsubtree]')
      ?.dispatchEvent(new Event('paint'));
  };
  return {old, next, parent, context, gl, loseContext, frames, tick, paint};
}

describe('GPU wipe', () => {
  it('leaves the native surface untouched when DOM capture is unavailable', () => {
    const {old, next, parent, gl} = setup();
    Reflect.deleteProperty(HTMLCanvasElement.prototype, 'requestPaint');
    expect(GpuWipe.create(old, next, {kind: 'wipe', sec: 4})).toBeNull();
    expect(gl.createProgram).not.toHaveBeenCalled();
    expect(parent.children).toHaveLength(2);
    expect(next.style.opacity).toBe('1');
  });

  it('reports a failed image capture and restores the incoming picture', async () => {
    const {old, next, parent, gl} = setup();
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: () => Promise.reject(new Error('Image is unreadable')),
    });
    const image = document.createElement('img');
    image.src = 'llp-media://media/unreadable';
    next.append(image);
    const wipe = GpuWipe.create(old, next, {kind: 'wipe', sec: 4});
    await expect(wipe?.finished).rejects.toThrow('Image is unreadable');
    expect(next.style.opacity).toBe('1');
    expect(parent.children).toHaveLength(2);
    expect(gl.texImage2D).not.toHaveBeenCalled();
  });

  it('captures each picture once and derives progress only from the rAF clock', async () => {
    const {old, next, parent, gl, context, tick, paint} = setup();
    const wipe = GpuWipe.create(old, next, {kind: 'wipe', sec: 4});
    expect(wipe).not.toBeNull();
    wipe?.pause();
    await paint();
    expect(context.drawElementImage).toHaveBeenCalledTimes(2);
    expect(gl.texImage2D).toHaveBeenCalledTimes(2);
    expect(old.parentElement).toBe(parent);
    expect(next.parentElement).toBe(parent);
    expect(next.style.opacity).toBe('0');
    wipe?.start();
    tick(20_000);
    tick(20_016.667);
    vi.advanceTimersByTime(10_000);
    tick(20_050);
    expect(gl.uniform1f.mock.calls.map(call => call[1])).toEqual([
      0,
      0,
      (20_016.667 - 20_000) / 4000,
      50 / 4000,
    ]);
    expect(context.drawElementImage).toHaveBeenCalledTimes(2);
    tick(24_000);
    await expect(wipe?.finished).resolves.toBeUndefined();
    wipe?.cancel();
    expect(next.style.opacity).toBe('1');
    expect(parent.querySelector('canvas')).toBeNull();
    expect(gl.deleteTexture).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['left', 1, 0],
    ['right', -1, 0],
    ['up', 0, 1],
    ['down', 0, -1],
  ] as const)('reflects the same feather for %s', (dir, x, y) => {
    const {old, next, gl} = setup();
    const wipe = GpuWipe.create(old, next, {kind: 'wipe', sec: 4, dir});
    expect(gl.uniform2f).toHaveBeenCalledWith(expect.any(Object), x, y);
    wipe?.cancel();
  });

  it('cancels an unready capture without a late animation or retained context', async () => {
    const {old, next, parent, gl, loseContext, frames, paint} = setup();
    const wipe = GpuWipe.create(old, next, {kind: 'wipe', sec: 4});
    wipe?.cancel();
    wipe?.cancel();
    await paint();
    expect(frames.size).toBe(0);
    expect(gl.texImage2D).not.toHaveBeenCalled();
    expect(loseContext).toHaveBeenCalledOnce();
    expect(next.style.opacity).toBe('1');
    expect(parent.children).toHaveLength(2);
  });

  it('reveals the incoming picture and releases resources when the GPU is lost', async () => {
    const {old, next, parent, paint, frames} = setup();
    const wipe = GpuWipe.create(old, next, {kind: 'wipe', sec: 4});
    await paint();
    const completion = expect(wipe?.finished).rejects.toThrow(
      'context was lost',
    );
    parent
      .querySelector('[data-slide-wipe]')
      ?.dispatchEvent(new Event('webglcontextlost'));
    await completion;
    expect(next.style.opacity).toBe('1');
    expect(frames.size).toBe(0);
    expect(parent.children).toHaveLength(2);
  });

  it('bounds the wait for a snapshot and preserves the visible incoming surface', async () => {
    const {old, next} = setup();
    const wipe = GpuWipe.create(old, next, {kind: 'wipe', sec: 4});
    const completion = expect(wipe?.finished).rejects.toThrow(
      'not captured in time',
    );
    vi.advanceTimersByTime(1500);
    await completion;
    expect(next.style.opacity).toBe('1');
  });

  it('rejects an incomplete DOM picture instead of animating a blank texture', async () => {
    const {old, next, context, paint} = setup();
    context.getImageData.mockReturnValueOnce({data: new Uint8ClampedArray(4)});
    const wipe = GpuWipe.create(old, next, {kind: 'wipe', sec: 4});
    const completion = expect(wipe?.finished).rejects.toThrow(
      'capture is incomplete',
    );
    await paint();
    await completion;
    expect(next.style.opacity).toBe('1');
  });

  it.each(['canvas', 'video'] as const)(
    'keeps native animation for %s content',
    kind => {
      const {old, next, gl} = setup();
      const media = document.createElement(kind);
      if (media instanceof HTMLVideoElement) {
        media.src = 'llp-media://media/test';
      }
      old.append(media);
      expect(GpuWipe.create(old, next, {kind: 'wipe', sec: 4})).toBeNull();
      expect(gl.createProgram).not.toHaveBeenCalled();
      expect(next.style.opacity).toBe('1');
    },
  );
});
