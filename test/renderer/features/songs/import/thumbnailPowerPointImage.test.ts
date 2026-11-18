import {afterEach, expect, it, vi} from 'vitest';
import {thumbnailPowerPointImage} from '@renderer/features/songs/import/thumbnailPowerPointImage';

afterEach(() => vi.unstubAllGlobals());

it('scales a background and releases its bitmap and canvas', async () => {
  const close = vi.fn();
  const bitmap = {close};
  const drawImage = vi.fn();
  const output = new Blob(['thumbnail'], {type: 'image/webp'});
  const convertToBlob = vi.fn(async () => output);
  const canvases: Canvas[] = [];
  class Canvas {
    constructor(
      public width: number,
      public height: number,
    ) {
      canvases.push(this);
    }
    getContext() {
      return {drawImage};
    }
    convertToBlob = convertToBlob;
  }
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => bitmap),
  );
  vi.stubGlobal('OffscreenCanvas', Canvas);
  expect(await thumbnailPowerPointImage(new Blob(['source']))).toBe(output);
  expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 640, 360);
  expect(convertToBlob).toHaveBeenCalledWith({
    type: 'image/webp',
    quality: 0.92,
  });
  expect(close).toHaveBeenCalledOnce();
  expect(canvases[0]?.width).toBe(1);
  expect(canvases[0]?.height).toBe(1);
});

it('releases resources when the preview canvas is unavailable', async () => {
  const close = vi.fn();
  const canvases: Canvas[] = [];
  class Canvas {
    constructor(
      public width: number,
      public height: number,
    ) {
      canvases.push(this);
    }
    getContext() {
      return null;
    }
  }
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({close})),
  );
  vi.stubGlobal('OffscreenCanvas', Canvas);
  await expect(thumbnailPowerPointImage(new Blob(['source']))).rejects.toThrow(
    'PowerPoint preview canvas unavailable',
  );
  expect(close).toHaveBeenCalledOnce();
  expect(canvases[0]?.width).toBe(1);
  expect(canvases[0]?.height).toBe(1);
});
